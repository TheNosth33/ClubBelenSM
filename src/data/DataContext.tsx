import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { Action, AppNotification, DB, NewUserRequest, PerformResult, SetupRequest, User, UserPatch } from './types';
import { summarizeAction } from './engine';
import { canPerform } from './permissions';
import { Backend } from './backend/types';
import { createLocalBackend } from './backend/local';
import { createRemoteBackend } from './backend/remote';
import { supabase } from '../lib/supabase';
import { pickImageUri } from '../utils/images';
import { getPushToken, PushStatus, setAppBadge } from '../lib/push';

export type { PerformResult } from './types';

// Con Supabase configurado en .env se usa la nube; si no, modo demostración.
const backend: Backend = supabase ? createRemoteBackend(supabase) : createLocalBackend();

// Token push de este teléfono (hay una sola sesión por app).
let currentPushToken: string | null = null;

interface DataContextValue {
  mode: Backend['mode'];
  db: DB;
  me: User | null;
  /** Último usuario con sesión (evita errores mientras se cierra la sesión). */
  lastMe: User | null;
  /** Primera vez con Supabase: falta crear la cuenta del Director General. */
  needsSetup: boolean;
  setup: (req: SetupRequest) => Promise<string | null>;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  perform: (action: Action) => Promise<PerformResult>;
  createUser: (req: NewUserRequest) => Promise<{ result: PerformResult; error?: string }>;
  submitTask: (taskId: string) => Promise<void>;
  markTaskSeen: (taskId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateMyProfile: (patch: { fullName: string; birthDate: string; photoUri?: string; coverUri?: string }) => Promise<string | null>;
  changeMyPassword: (current: string, next: string) => Promise<string | null>;
  resetUserPassword: (userId: string, next: string) => Promise<{ result: PerformResult; error?: string }>;
  approvePending: (id: string) => Promise<string | null>;
  rejectPending: (id: string) => Promise<string | null>;
  setUserPermissions: (userId: string, patch: Pick<UserPatch, 'extraPermissions' | 'revokedPermissions' | 'roles' | 'clubs' | 'active'>) => Promise<string | null>;
  deleteUser: (userId: string) => Promise<string | null>;
  /** Abre la galería y guarda la imagen (en la nube con Supabase). `folder`: p. ej. ['usuarios', id]. */
  pickImage: (aspect: [number, number], folder: string[]) => Promise<string | null>;
  resetData?: (withDemo: boolean) => Promise<void>;
  myNotifications: AppNotification[];
  unreadCount: number;
  /** Estado de las notificaciones push en este teléfono (null: no aplica / cargando). */
  pushStatus: PushStatus | null;
  retryPush: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [db, setDb] = useState<DB | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  // Se conserva al cerrar sesión para que las pantallas que se cierran no fallen.
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    const unsubscribe = backend.subscribe((s) => {
      setDb(s.db);
      setSessionUserId(s.userId);
      if (s.userId) setLastUserId(s.userId);
    });
    (async () => {
      const s = await backend.start();
      setDb(s.db);
      setSessionUserId(s.userId);
      if (s.userId) setLastUserId(s.userId);
      else setNeedsSetup(await backend.needsSetup());
      setReady(true);
    })();
    return unsubscribe;
  }, []);

  const me = useMemo(() => db?.users.find((u) => u.id === sessionUserId && u.active) ?? null, [db, sessionUserId]);
  const lastMe = useMemo(() => db?.users.find((u) => u.id === lastUserId) ?? null, [db, lastUserId]);
  const actor = me ?? lastMe;

  // ----- Notificaciones push (solo con Supabase) -----
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [pushAttempt, setPushAttempt] = useState(0);
  const meId = me?.id;
  useEffect(() => {
    if (!meId || !backend.registerPushToken) return;
    let cancelled = false;
    getPushToken()
      .then(async (status) => {
        if (cancelled) return;
        setPushStatus(status);
        if (status.state === 'activo') {
          currentPushToken = status.token;
          await backend.registerPushToken!(status.token, Platform.OS);
        }
      })
      .catch((e) => console.warn('Push no disponible', e));
    return () => {
      cancelled = true;
    };
  }, [meId, pushAttempt]);

  const logout = useCallback(async () => {
    // El teléfono deja de recibir notificaciones de este usuario.
    if (currentPushToken && backend.unregisterPushToken) {
      await backend.unregisterPushToken(currentPushToken).catch(() => {});
    }
    currentPushToken = null;
    setPushStatus(null);
    await backend.logout();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await backend.login(username, password);
    return 'error' in res ? res.error : null;
  }, []);

  const setup = useCallback(async (req: SetupRequest) => {
    const err = await backend.setup(req);
    if (!err) setNeedsSetup(false);
    return err;
  }, []);

  const perform = useCallback(
    async (action: Action): Promise<PerformResult> => {
      if (!db || !me) return 'denied';
      // Revisión rápida en el teléfono; el servidor vuelve a validar todo.
      if (!canPerform(db, me, action)) return 'denied';
      return backend.perform(me, action, summarizeAction(db, action));
    },
    [db, me],
  );

  const createUser = useCallback(
    async (req: NewUserRequest) => {
      if (!me) return { result: 'denied' as const };
      return backend.createUser(me, req, `Crear usuario ${req.fullName}`);
    },
    [me],
  );

  const myNotifications = useMemo(
    () => (db && me ? db.notifications.filter((n) => n.userId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []),
    [db, me],
  );
  const unreadCount = myNotifications.filter((n) => !n.read).length;

  // Número en el ícono de la app
  useEffect(() => {
    setAppBadge(meId ? unreadCount : 0);
  }, [meId, unreadCount]);

  const value = useMemo<DataContextValue | null>(() => {
    if (!db) return null;
    const need = <T,>(fallback: T, fn: (u: User) => Promise<T>) => (actor ? fn(actor) : Promise.resolve(fallback));
    return {
      mode: backend.mode,
      db,
      me,
      lastMe,
      needsSetup,
      setup,
      login,
      logout,
      perform,
      createUser,
      submitTask: (taskId) => need(undefined, (u) => backend.submitTask(u, taskId)),
      markTaskSeen: (taskId) => void need(undefined, (u) => backend.markTaskSeen(u, taskId)),
      markNotificationRead: (id) => void need(undefined, (u) => backend.markNotificationsRead(u, [id])),
      markAllNotificationsRead: () => void need(undefined, (u) => backend.markNotificationsRead(u, null)),
      updateMyProfile: (p) => need<string | null>('Sin sesión', (u) => backend.updateMyProfile(u, p)),
      changeMyPassword: (current, next) => need<string | null>('Sin sesión', (u) => backend.changeMyPassword(u, current, next)),
      resetUserPassword: (userId, next) => need({ result: 'denied' as PerformResult }, (u) => backend.resetUserPassword(u, userId, next)),
      approvePending: (id) => need<string | null>('Sin sesión', (u) => backend.reviewPending(u, id, true)),
      rejectPending: (id) => need<string | null>('Sin sesión', (u) => backend.reviewPending(u, id, false)),
      setUserPermissions: (userId, patch) => need<string | null>('Sin sesión', (u) => backend.adminUpdateUser(u, userId, patch)),
      deleteUser: (userId) => need<string | null>('Sin sesión', (u) => backend.deleteUser(u, userId)),
      pickImage: async (aspect, folder) => {
        const uri = await pickImageUri(aspect);
        if (!uri || !actor) return null;
        return backend.uploadImage(actor, uri, folder);
      },
      resetData: backend.resetData ? (withDemo) => need(undefined, (u) => backend.resetData!(u, withDemo)) : undefined,
      myNotifications,
      unreadCount,
      pushStatus,
      retryPush: () => setPushAttempt((n) => n + 1),
    };
  }, [db, me, lastMe, actor, needsSetup, setup, login, logout, perform, createUser, myNotifications, unreadCount, pushStatus]);

  if (!value || !ready) return null;
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de DataProvider');
  return ctx;
}

/** El usuario con sesión iniciada (las pantallas con pestañas siempre tienen uno). */
export function useMe(): User {
  const { me, lastMe } = useData();
  const u = me ?? lastMe;
  if (!u) throw new Error('No hay sesión iniciada');
  return u;
}
