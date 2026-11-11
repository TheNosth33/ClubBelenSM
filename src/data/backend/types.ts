import { Action, DB, NewUserRequest, PerformResult, SetupRequest, User, UserPatch } from '../types';

export interface BackendState {
  db: DB;
  userId: string | null;
}

/**
 * Dónde viven los datos. Hay dos implementaciones:
 * - local: datos de demostración guardados en el teléfono.
 * - supabase: base de datos compartida en la nube (permisos validados en el servidor).
 */
export interface Backend {
  mode: 'local' | 'supabase';
  start(): Promise<BackendState>;
  /** Avisa cuando cambian los datos o la sesión (también por cambios de otros usuarios). */
  subscribe(cb: (state: BackendState) => void): () => void;
  needsSetup(): Promise<boolean>;
  setup(req: SetupRequest): Promise<string | null>;
  login(username: string, password: string): Promise<{ userId: string } | { error: string }>;
  logout(): Promise<void>;
  perform(me: User, action: Action, summary: string): Promise<PerformResult>;
  createUser(me: User, req: NewUserRequest, summary: string): Promise<{ result: PerformResult; error?: string }>;
  submitTask(me: User, taskId: string): Promise<void>;
  markTaskSeen(me: User, taskId: string): Promise<void>;
  markNotificationsRead(me: User, ids: string[] | null): Promise<void>;
  updateMyProfile(me: User, p: { fullName: string; birthDate: string; photoUri?: string; coverUri?: string }): Promise<string | null>;
  changeMyPassword(me: User, current: string, next: string): Promise<string | null>;
  resetUserPassword(me: User, userId: string, next: string): Promise<{ result: PerformResult; error?: string }>;
  reviewPending(me: User, id: string, approve: boolean): Promise<string | null>;
  adminUpdateUser(me: User, userId: string, patch: Pick<UserPatch, 'extraPermissions' | 'revokedPermissions' | 'roles' | 'clubs' | 'active'>): Promise<string | null>;
  deleteUser(me: User, userId: string): Promise<string | null>;
  /** Guarda una imagen elegida y devuelve la URI/URL que se debe usar. */
  uploadImage(me: User, localUri: string, folder: string[]): Promise<string>;
  /** Solo con Supabase: registra o quita el teléfono para recibir notificaciones push. */
  registerPushToken?(token: string, platform: string): Promise<void>;
  unregisterPushToken?(token: string): Promise<void>;
  /** Solo en modo demostración. */
  resetData?(me: User, withDemo: boolean): Promise<void>;
}
