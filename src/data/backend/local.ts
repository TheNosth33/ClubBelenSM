import AsyncStorage from '@react-native-async-storage/async-storage';
import { Backend, BackendState } from './types';
import { DB, PendingChange, User } from '../types';
import { createDemoDB, createEmptyDB, DB_VERSION } from '../seed';
import { applyAction, approversOf, notifyUsers } from '../engine';
import { actionRequirements, can, canPerform, needsApproval } from '../permissions';
import { hashPassword, newId, newSalt, validatePassword } from '../../utils/users';
import { nowISO } from '../../utils/dates';
import { persistLocally } from '../../utils/images';

const DB_KEY = 'clubbelen:db';
const SESSION_KEY = 'clubbelen:session';

/** Modo demostración: todos los datos viven en este teléfono. */
export function createLocalBackend(): Backend {
  let db: DB;
  let userId: string | null = null;
  const listeners = new Set<(s: BackendState) => void>();
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const emit = () => listeners.forEach((cb) => cb({ db, userId }));
  const commit = (next: DB) => {
    db = next;
    emit();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      AsyncStorage.setItem(DB_KEY, JSON.stringify(db)).catch(() => {});
    }, 300);
  };
  const setSession = (id: string | null) => {
    userId = id;
    if (id) AsyncStorage.setItem(SESSION_KEY, id).catch(() => {});
    else AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
    emit();
  };

  const backend: Backend = {
    mode: 'local',

    async start() {
      let loaded: DB | null = null;
      try {
        const raw = await AsyncStorage.getItem(DB_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as DB;
          if (parsed.version === DB_VERSION) loaded = parsed;
        }
      } catch {}
      if (loaded) {
        db = loaded;
      } else {
        // Primera vez: se crean los datos de ejemplo y se guardan de inmediato.
        db = await createDemoDB();
        await AsyncStorage.setItem(DB_KEY, JSON.stringify(db)).catch(() => {});
      }
      try {
        const sid = await AsyncStorage.getItem(SESSION_KEY);
        if (sid && db.users.some((u) => u.id === sid && u.active)) userId = sid;
      } catch {}
      return { db, userId };
    },

    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async needsSetup() {
      return false;
    },

    async setup() {
      return 'No disponible en modo demostración.';
    },

    async login(username, password) {
      const user = db.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
      if (!user) return { error: 'Usuario o contraseña incorrectos.' };
      if (!user.active) return { error: 'Este usuario está desactivado. Habla con tu director.' };
      if ((await hashPassword(password, user.salt)) !== user.passwordHash) return { error: 'Usuario o contraseña incorrectos.' };
      setSession(user.id);
      return { userId: user.id };
    },

    async logout() {
      setSession(null);
    },

    async perform(me, action, summary) {
      if (!canPerform(db, me, action)) return 'denied';
      const req = actionRequirements(db, action)!;
      if (needsApproval(me, req.perm)) {
        const clubId = req.clubs[0] ?? me.clubs[0];
        const pending: PendingChange = { id: newId(), action, clubId, summary, createdBy: me.id, createdAt: nowISO(), status: 'pendiente' };
        commit(
          notifyUsers(
            { ...db, pending: [pending, ...db.pending] },
            approversOf(db, clubId).map((u) => u.id),
            'Cambio pendiente de aprobación',
            `${me.fullName}: ${summary}`,
            '/aprobaciones',
            me.id,
          ),
        );
        return 'pending';
      }
      commit(applyAction(db, action, me.id));
      return 'done';
    },

    async createUser(me, req, summary) {
      const salt = newSalt();
      const passwordHash = await hashPassword(req.password, salt);
      const { password: _pw, ...rest } = req;
      const result = await backend.perform(me, { type: 'createUser', data: { ...rest, salt, passwordHash } }, summary);
      return { result, error: result === 'denied' ? 'No tienes permiso para crear este usuario.' : undefined };
    },

    async submitTask(me, taskId) {
      const task = db.tasks.find((t) => t.id === taskId);
      const a = task?.assignments[me.id];
      if (!task || !a || a.status !== 'pendiente') return;
      const next = {
        ...db,
        tasks: db.tasks.map((t) =>
          t.id === taskId ? { ...t, assignments: { ...t.assignments, [me.id]: { ...a, status: 'en_revision' as const, seen: true, submittedAt: nowISO() } } } : t,
        ),
      };
      const reviewers = db.users.filter((u) => u.id !== me.id && (u.id === task.createdBy || can(u, 'review_tasks', task.clubId)));
      commit(notifyUsers(next, reviewers.map((u) => u.id), 'Tarea entregada para revisión', `${me.fullName}: ${task.title}`, `/tarea/${task.id}`, me.id));
    },

    async markTaskSeen(me, taskId) {
      const task = db.tasks.find((t) => t.id === taskId);
      const a = task?.assignments[me.id];
      if (!task || !a || a.seen) return;
      commit({ ...db, tasks: db.tasks.map((t) => (t.id === taskId ? { ...t, assignments: { ...t.assignments, [me.id]: { ...a, seen: true } } } : t)) });
    },

    async markNotificationsRead(me, ids) {
      commit({
        ...db,
        notifications: db.notifications.map((n) => (n.userId === me.id && (!ids || ids.includes(n.id)) ? { ...n, read: true } : n)),
      });
    },

    async updateMyProfile(me, p) {
      commit({
        ...db,
        users: db.users.map((u) => (u.id === me.id ? { ...u, fullName: p.fullName.trim(), birthDate: p.birthDate, photoUri: p.photoUri, coverUri: p.coverUri } : u)),
      });
      return null;
    },

    async changeMyPassword(me, current, next) {
      if ((await hashPassword(current, me.salt)) !== me.passwordHash) return 'La contraseña actual no es correcta.';
      const err = validatePassword(next);
      if (err) return err;
      const salt = newSalt();
      const passwordHash = await hashPassword(next, salt);
      commit({ ...db, users: db.users.map((u) => (u.id === me.id ? { ...u, salt, passwordHash } : u)) });
      return null;
    },

    async resetUserPassword(me, targetId, next) {
      const err = validatePassword(next);
      if (err) return { result: 'error', error: err };
      const salt = newSalt();
      const passwordHash = await hashPassword(next, salt);
      const result = await backend.perform(me, { type: 'updateUser', userId: targetId, data: { salt, passwordHash } }, 'Restablecer contraseña');
      return { result, error: result === 'denied' ? 'No tienes permiso para cambiar esta contraseña.' : undefined };
    },

    async reviewPending(me, id, approve) {
      const p = db.pending.find((x) => x.id === id);
      if (!p || p.status !== 'pendiente') return null;
      if (!(me.isGeneralDirector || can(me, 'approve_changes', p.clubId))) return 'No tienes permiso para aprobar este cambio.';
      let next: DB = {
        ...db,
        pending: db.pending.map((x) => (x.id === id ? { ...x, status: approve ? 'aprobado' : 'rechazado', reviewedBy: me.id, reviewedAt: nowISO() } : x)),
      };
      if (approve) next = applyAction(next, p.action, p.createdBy);
      commit(notifyUsers(next, [p.createdBy], approve ? '✅ Cambio aprobado' : '❌ Cambio rechazado', p.summary, undefined, me.id));
      return null;
    },

    async adminUpdateUser(me, targetId, patch) {
      if (!me.isGeneralDirector) return 'Solo el Director General.';
      commit({ ...db, users: db.users.map((u) => (u.id === targetId && !u.isGeneralDirector ? { ...u, ...patch } : u)) });
      return null;
    },

    async deleteUser(me, targetId) {
      if (!me.isGeneralDirector || targetId === me.id) return 'Solo el Director General.';
      commit({
        ...db,
        users: db.users.filter((u) => u.id !== targetId),
        notifications: db.notifications.filter((n) => n.userId !== targetId),
        achievements: db.achievements.filter((a) => a.userId !== targetId),
        tasks: db.tasks.map((t) => {
          if (!t.assignments[targetId]) return t;
          const { [targetId]: _removed, ...rest } = t.assignments;
          return { ...t, assignments: rest };
        }),
      });
      return null;
    },

    async uploadImage(_me, localUri) {
      return persistLocally(localUri);
    },

    async resetData(me: User, withDemo: boolean) {
      if (!me.isGeneralDirector) return;
      const fresh = withDemo ? await createDemoDB() : await createEmptyDB();
      // Conserva la cuenta del Director General actual
      const admin = fresh.users.find((u) => u.isGeneralDirector)!;
      const keepMe = { ...me, id: admin.id };
      fresh.users = fresh.users.map((u) => (u.isGeneralDirector ? keepMe : u));
      userId = keepMe.id;
      AsyncStorage.setItem(SESSION_KEY, keepMe.id).catch(() => {});
      commit(fresh);
    },
  };
  return backend;
}
