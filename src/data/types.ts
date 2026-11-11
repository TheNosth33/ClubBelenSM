// Modelo de datos de la app Club Belén SM.
// Las fechas se guardan como texto 'AAAA-MM-DD' y las horas como 'HH:MM'.

export type ClubId = 'aventureros' | 'conquistadores' | 'guias';

export type Role =
  | 'miembro'
  | 'director'
  | 'director_asociado'
  | 'consejero'
  | 'instructor'
  | 'secretario'
  | 'tesorero'
  | 'capellan';

export type Sex = 'M' | 'F';

export type Permission =
  | 'create_users'
  | 'edit_users'
  | 'manage_club'
  | 'manage_activities'
  | 'manage_notices'
  | 'assign_tasks'
  | 'review_tasks'
  | 'manage_members'
  | 'record_attendance'
  | 'manage_achievements'
  | 'approve_changes';

export interface User {
  id: string;
  fullName: string;
  username: string;
  passwordHash: string;
  salt: string;
  sex: Sex;
  birthDate: string;
  phone: string;
  clubs: ClubId[]; // máximo 2
  roles: Role[]; // máximo 3
  isGeneralDirector?: boolean;
  photoUri?: string;
  coverUri?: string;
  extraPermissions: Permission[];
  revokedPermissions: Permission[];
  active: boolean;
  createdAt: string;
}

export interface Club {
  id: ClubId;
  name: string;
  motto: string;
  color: string;
  logoUri?: string;
  coverUri?: string;
  cardBackgroundUri?: string;
}

export interface Activity {
  id: string;
  clubIds: ClubId[];
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime?: string;
  location: string;
  cancelled?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Notice {
  id: string;
  clubIds: ClubId[];
  title: string;
  body: string;
  urgent: boolean;
  activityId?: string;
  createdBy: string;
  createdAt: string;
}

export type AssignmentStatus = 'pendiente' | 'en_revision' | 'hecha';

export interface Assignment {
  status: AssignmentStatus;
  seen: boolean;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface Task {
  id: string;
  clubId: ClubId;
  title: string;
  description: string;
  dueDate: string;
  createdBy: string;
  createdAt: string;
  assignments: Record<string, Assignment>;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

export interface Meeting {
  id: string;
  clubId: ClubId;
  date: string;
  title: string;
  presentIds: string[];
  absentIds: string[];
  createdBy: string;
}

export interface Achievement {
  id: string;
  userId: string;
  kind: 'clase' | 'especialidad';
  name: string;
  date: string;
  grantedBy: string;
}

// Datos de un usuario nuevo (antes de calcular la contraseña cifrada).
export interface NewUserInput {
  fullName: string;
  username: string;
  sex: Sex;
  birthDate: string;
  phone: string;
  clubs: ClubId[];
  roles: Role[];
  passwordHash: string;
  salt: string;
}

export type UserPatch = Partial<
  Pick<
    User,
    | 'fullName'
    | 'sex'
    | 'birthDate'
    | 'phone'
    | 'clubs'
    | 'roles'
    | 'photoUri'
    | 'coverUri'
    | 'extraPermissions'
    | 'revokedPermissions'
    | 'active'
    | 'username'
    | 'passwordHash'
    | 'salt'
  >
>;

// Acciones que pasan por el control de permisos. Si quien las hace es
// Director Asociado, quedan pendientes hasta que un Director las apruebe.
export type Action =
  | { type: 'createActivity'; data: Omit<Activity, 'id' | 'createdBy' | 'createdAt'> }
  | { type: 'updateActivity'; id: string; data: Partial<Omit<Activity, 'id'>>; notify: boolean }
  | { type: 'deleteActivity'; id: string }
  | { type: 'createNotice'; data: Omit<Notice, 'id' | 'createdBy' | 'createdAt'> }
  | { type: 'deleteNotice'; id: string }
  | { type: 'createTask'; data: Omit<Task, 'id' | 'createdBy' | 'createdAt'> }
  | { type: 'deleteTask'; id: string }
  | { type: 'reviewTask'; taskId: string; userId: string; status: 'hecha' | 'pendiente' }
  | { type: 'addMember'; userId: string; clubId: ClubId }
  | { type: 'removeMember'; userId: string; clubId: ClubId }
  | { type: 'updateClub'; clubId: ClubId; data: Partial<Omit<Club, 'id'>> }
  | { type: 'createUser'; data: NewUserInput }
  | { type: 'updateUser'; userId: string; data: UserPatch }
  | { type: 'recordMeeting'; data: Omit<Meeting, 'id' | 'createdBy'> }
  | { type: 'addAchievement'; data: Omit<Achievement, 'id' | 'grantedBy'> }
  | { type: 'removeAchievement'; id: string }
  // Solo desde aprobaciones: activa un usuario creado por un Director Asociado.
  | { type: 'activateUser'; userId: string };

export type PerformResult = 'done' | 'pending' | 'denied' | 'error';

/** Datos para crear un usuario (la contraseña se envía al servidor, nunca se guarda en texto). */
export interface NewUserRequest {
  fullName: string;
  username: string;
  sex: Sex;
  birthDate: string;
  phone: string;
  clubs: ClubId[];
  roles: Role[];
  password: string;
}

/** Primera configuración: cuenta del Director General. */
export interface SetupRequest {
  fullName: string;
  username: string;
  sex: Sex;
  birthDate: string;
  clubs: ClubId[];
  password: string;
}

export interface PendingChange {
  id: string;
  action: Action;
  clubId: ClubId;
  summary: string;
  createdBy: string;
  createdAt: string;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface DB {
  version: number;
  users: User[];
  clubs: Record<ClubId, Club>;
  activities: Activity[];
  notices: Notice[];
  tasks: Task[];
  notifications: AppNotification[];
  meetings: Meeting[];
  achievements: Achievement[];
  pending: PendingChange[];
}
