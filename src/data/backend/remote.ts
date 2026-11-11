import { AppState } from 'react-native';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { Backend, BackendState } from './types';
import { Action, Activity, Assignment, ClubId, DB, PerformResult, Task, User } from '../types';
import { CLUB_IDS, CLUB_INFO } from '../constants';
import { DB_VERSION } from '../seed';
import { validatePassword, newId } from '../../utils/users';
import { extensionOf, mimeOf, readBytes } from '../../utils/images';

type Row = Record<string, any>;

const PAGE = 1000;
const BUCKET = 'imagenes';
const DENIED = '42501';

export function emptyDB(): DB {
  const clubs = {} as DB['clubs'];
  for (const id of CLUB_IDS) clubs[id] = { id, name: CLUB_INFO[id].name, motto: CLUB_INFO[id].motto, color: CLUB_INFO[id].color };
  return { version: DB_VERSION, users: [], clubs, activities: [], notices: [], tasks: [], notifications: [], meetings: [], achievements: [], pending: [] };
}

/** Convierte undefined en null para que el servidor reciba los campos que se borran. */
function toJson<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (_k, v) => (v === undefined ? null : v)));
}

const opt = <T,>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);

/** Base de datos compartida en Supabase. Los permisos se validan en el servidor. */
export function createRemoteBackend(sb: SupabaseClient): Backend {
  let db: DB = emptyDB();
  let userId: string | null = null;
  let channel: RealtimeChannel | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<(s: BackendState) => void>();
  const emit = () => listeners.forEach((cb) => cb({ db, userId }));

  async function selectAll(table: string, orderBy: string[]): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = sb.from(table).select('*');
      for (const col of orderBy) q = q.order(col);
      const { data, error } = await q.range(from, from + PAGE - 1);
      if (error) throw error;
      out.push(...(data ?? []));
      if (!data || data.length < PAGE) return out;
    }
  }

  async function fetchAll(): Promise<DB> {
    const [clubs, profiles, priv, activities, notices, tasks, assignments, meetings, achievements, pending, notifs] = await Promise.all([
      selectAll('clubs', ['id']),
      selectAll('profiles', ['id']),
      selectAll('profile_private', ['id']),
      selectAll('activities', ['id']),
      selectAll('notices', ['id']),
      selectAll('tasks', ['id']),
      selectAll('task_assignments', ['task_id', 'user_id']),
      selectAll('meetings', ['id']),
      selectAll('achievements', ['id']),
      selectAll('pending_changes', ['id']),
      sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(300).then(({ data, error }) => {
        if (error) throw error;
        return data ?? [];
      }),
    ]);

    const phones = new Map(priv.map((p) => [p.id as string, p.phone as string]));
    const byTask = new Map<string, Record<string, Assignment>>();
    for (const a of assignments) {
      const rec = byTask.get(a.task_id) ?? {};
      rec[a.user_id] = { status: a.status, seen: a.seen, submittedAt: opt(a.submitted_at), reviewedAt: opt(a.reviewed_at), reviewedBy: opt(a.reviewed_by) };
      byTask.set(a.task_id, rec);
    }

    const next = emptyDB();
    for (const c of clubs) {
      next.clubs[c.id as ClubId] = { id: c.id, name: c.name, motto: c.motto, color: c.color, logoUri: opt(c.logo_url), coverUri: opt(c.cover_url), cardBackgroundUri: opt(c.card_background_url) };
    }
    next.users = profiles.map(
      (p): User => ({
        id: p.id,
        fullName: p.full_name,
        username: p.username,
        passwordHash: '',
        salt: '',
        sex: p.sex,
        birthDate: p.birth_date,
        phone: phones.get(p.id) ?? '',
        clubs: p.clubs,
        roles: p.roles,
        isGeneralDirector: p.is_general_director,
        photoUri: opt(p.photo_url),
        coverUri: opt(p.cover_url),
        extraPermissions: p.extra_permissions,
        revokedPermissions: p.revoked_permissions,
        active: p.active,
        createdAt: p.created_at,
      }),
    );
    next.activities = activities.map(
      (a): Activity => ({
        id: a.id,
        clubIds: a.club_ids,
        title: a.title,
        description: a.description,
        date: a.date,
        startTime: a.start_time,
        endTime: opt(a.end_time),
        location: a.location,
        cancelled: a.cancelled,
        createdBy: a.created_by ?? '',
        createdAt: a.created_at,
        updatedAt: opt(a.updated_at),
      }),
    );
    next.notices = notices.map((n) => ({
      id: n.id, clubIds: n.club_ids, title: n.title, body: n.body, urgent: n.urgent, activityId: opt(n.activity_id), createdBy: n.created_by ?? '', createdAt: n.created_at,
    }));
    next.tasks = tasks.map(
      (t): Task => ({
        id: t.id, clubId: t.club_id, title: t.title, description: t.description, dueDate: t.due_date, createdBy: t.created_by ?? '', createdAt: t.created_at, assignments: byTask.get(t.id) ?? {},
      }),
    );
    next.notifications = notifs.map((n: Row) => ({ id: n.id, userId: n.user_id, title: n.title, body: n.body, href: opt(n.href), read: n.read, createdAt: n.created_at }));
    next.meetings = meetings.map((m) => ({ id: m.id, clubId: m.club_id, date: m.date, title: m.title, presentIds: m.present_ids, absentIds: m.absent_ids, createdBy: m.created_by ?? '' }));
    next.achievements = achievements.map((a) => ({ id: a.id, userId: a.user_id, kind: a.kind, name: a.name, date: a.date, grantedBy: a.granted_by ?? '' }));
    next.pending = pending.map((p) => ({
      id: p.id, action: p.action, clubId: p.club_id, summary: p.summary, createdBy: p.created_by, createdAt: p.created_at, status: p.status, reviewedBy: opt(p.reviewed_by), reviewedAt: opt(p.reviewed_at),
    }));
    return next;
  }

  async function refresh() {
    if (!userId) return;
    try {
      db = await fetchAll();
      emit();
    } catch (e) {
      console.warn('No se pudieron cargar los datos', e);
    }
  }

  // Varios cambios seguidos (p. ej. una tarea para 20 miembros) se agrupan en una sola recarga.
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 400);
  }

  function listen() {
    if (channel) return;
    channel = sb
      .channel('club-belen-cambios')
      .on('postgres_changes', { event: '*', schema: 'public' }, scheduleRefresh)
      .subscribe();
  }

  async function stopListening() {
    if (channel) await sb.removeChannel(channel);
    channel = null;
  }

  AppState.addEventListener('change', (s) => {
    if (s === 'active') scheduleRefresh();
  });

  // Si la sesión vence o se cierra en otro lado, vuelve al inicio de sesión.
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && userId) {
      userId = null;
      db = emptyDB();
      stopListening();
      emit();
    }
  });

  /** Carga los datos del usuario que inició sesión; lo rechaza si está inactivo. */
  async function enter(id: string): Promise<string | null> {
    userId = id;
    try {
      db = await fetchAll();
    } catch {
      userId = null;
      return 'No se pudo conectar. Revisa tu internet.';
    }
    const me = db.users.find((u) => u.id === id);
    if (!me || !me.active) {
      userId = null;
      db = emptyDB();
      await sb.auth.signOut();
      return me ? 'Tu usuario está desactivado o pendiente de aprobación. Habla con tu director.' : 'Tu usuario no tiene perfil en el club.';
    }
    listen();
    emit();
    return null;
  }

  async function rpc(fn: string, args: Record<string, unknown>): Promise<string | null> {
    const { error } = await sb.rpc(fn, args);
    if (error) return error.code === DENIED ? 'No tienes permiso para hacer este cambio.' : 'No se pudo guardar. Revisa tu internet e intenta de nuevo.';
    await refresh();
    return null;
  }

  async function adminFunction(body: Record<string, unknown>): Promise<{ result: PerformResult; error?: string }> {
    const { data, error } = await sb.functions.invoke('admin-users', { body });
    if (error) return { result: 'error', error: 'No se pudo conectar con el servidor.' };
    if (data?.error) return { result: data.result === 'denied' ? 'denied' : 'error', error: data.error };
    await refresh();
    return { result: data?.result === 'pending' ? 'pending' : 'done' };
  }

  async function loginEmail(username: string): Promise<string | null> {
    const { data, error } = await sb.rpc('login_email', { p_username: username });
    return error ? null : (data as string);
  }

  const backend: Backend = {
    mode: 'supabase',

    async start() {
      const { data } = await sb.auth.getSession();
      if (data.session) await enter(data.session.user.id);
      return { db, userId };
    },

    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async needsSetup() {
      const { data, error } = await sb.rpc('needs_setup');
      return !error && data === true;
    },

    async setup(req) {
      const { password, ...user } = req;
      const res = await adminFunction({ action: 'bootstrap', user: { ...user, roles: ['director'] }, password });
      if (res.error) return res.error;
      const login = await backend.login(req.username, password);
      return 'error' in login ? login.error : null;
    },

    async login(username, password) {
      const email = await loginEmail(username.trim());
      if (!email) return { error: 'No se pudo conectar. Revisa tu internet.' };
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        return { error: error?.status === 400 || error?.code === 'invalid_credentials' ? 'Usuario o contraseña incorrectos.' : 'No se pudo iniciar sesión. Revisa tu internet.' };
      }
      const err = await enter(data.user.id);
      return err ? { error: err } : { userId: data.user.id };
    },

    async logout() {
      userId = null;
      db = emptyDB();
      await stopListening();
      emit();
      await sb.auth.signOut();
    },

    async perform(_me, action: Action, summary) {
      const { data, error } = await sb.rpc('perform_action', { p_action: toJson(action), p_summary: summary });
      if (error) return error.code === DENIED ? 'denied' : 'error';
      await refresh();
      return data === 'pending' ? 'pending' : 'done';
    },

    async createUser(_me, req, summary) {
      const { password, ...user } = req;
      return adminFunction({ action: 'create', user, password, summary });
    },

    async submitTask(_me, taskId) {
      await rpc('submit_task', { p_task: taskId });
    },

    async markTaskSeen(_me, taskId) {
      await rpc('mark_task_seen', { p_task: taskId });
    },

    async markNotificationsRead(_me, ids) {
      await rpc('mark_notifications_read', { p_ids: ids });
    },

    async updateMyProfile(_me, p) {
      return rpc('update_my_profile', {
        p_full_name: p.fullName,
        p_birth_date: p.birthDate,
        p_photo_url: p.photoUri ?? null,
        p_cover_url: p.coverUri ?? null,
      });
    },

    async changeMyPassword(me, current, next) {
      const err = validatePassword(next);
      if (err) return err;
      const email = await loginEmail(me.username);
      if (!email) return 'No se pudo conectar. Revisa tu internet.';
      // Confirma la contraseña actual antes de cambiarla.
      const check = await sb.auth.signInWithPassword({ email, password: current });
      if (check.error) return 'La contraseña actual no es correcta.';
      const { error } = await sb.auth.updateUser({ password: next });
      return error ? 'No se pudo cambiar la contraseña.' : null;
    },

    async resetUserPassword(_me, targetId, next) {
      const err = validatePassword(next);
      if (err) return { result: 'error', error: err };
      return adminFunction({ action: 'reset_password', userId: targetId, password: next });
    },

    async reviewPending(_me, id, approve) {
      return rpc('review_pending', { p_id: id, p_approve: approve });
    },

    async adminUpdateUser(_me, targetId, patch) {
      return rpc('admin_update_user', { p_user: targetId, p_patch: toJson(patch) });
    },

    async deleteUser(_me, targetId) {
      const res = await adminFunction({ action: 'delete', userId: targetId });
      return res.error ?? null;
    },

    async registerPushToken(token, platform) {
      const { error } = await sb.rpc('register_push_token', { p_token: token, p_platform: platform });
      if (error) console.warn('No se pudo registrar el teléfono para push', error.message);
    },

    async unregisterPushToken(token) {
      await sb.rpc('unregister_push_token', { p_token: token });
    },

    async uploadImage(_me, localUri, folder) {
      const ext = extensionOf(localUri);
      const path = `${folder.join('/')}/${newId()}.${ext}`;
      const bytes = await readBytes(localUri);
      const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: mimeOf(ext), upsert: false });
      if (error) throw error;
      return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    },
  };
  return backend;
}
