import { ClubId, Permission, Role } from './types';

export const ORG_NAME = 'Club Belén SM';
export const ASSOCIATION_NAME = 'Asociación Oriental Salvadoreña';

export const MAX_ROLES = 3;
export const MAX_CLUBS = 2;

export const CLUB_IDS: ClubId[] = ['aventureros', 'conquistadores', 'guias'];

export const CLUB_INFO: Record<
  ClubId,
  { name: string; short: string; memberLabel: string; minAge: number; maxAge: number | null; color: string; motto: string }
> = {
  aventureros: {
    name: 'Aventureros',
    short: 'AV',
    memberLabel: 'Aventurero',
    minAge: 4,
    maxAge: 9,
    color: '#E4572E',
    motto: 'Porque Jesús me ama, siempre haré lo mejor',
  },
  conquistadores: {
    name: 'Conquistadores',
    short: 'CQ',
    memberLabel: 'Conquistador',
    minAge: 10,
    maxAge: 15,
    color: '#1E5AA8',
    motto: 'El amor de Cristo me motiva',
  },
  guias: {
    name: 'Guías Mayores',
    short: 'GM',
    memberLabel: 'Guía Mayor',
    minAge: 16,
    maxAge: null,
    color: '#7A1F3D',
    motto: 'El amor de Cristo nos constriñe',
  },
};

export const ROLE_LABELS: Record<Role, string> = {
  miembro: 'Miembro',
  director: 'Director',
  director_asociado: 'Director Asociado',
  consejero: 'Consejero',
  instructor: 'Instructor',
  secretario: 'Secretario',
  tesorero: 'Tesorero',
  capellan: 'Capellán',
};

export const ALL_ROLES: Role[] = [
  'miembro',
  'director',
  'director_asociado',
  'consejero',
  'instructor',
  'secretario',
  'tesorero',
  'capellan',
];

// Roles que un Director (no el Director General) puede asignar en su club.
export const ROLES_DIRECTOR_CAN_ASSIGN: Role[] = [
  'miembro',
  'consejero',
  'instructor',
  'secretario',
  'tesorero',
  'capellan',
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  create_users: 'Crear usuarios',
  edit_users: 'Editar datos de usuarios',
  manage_club: 'Editar el club (portada, logo, carnet, lema)',
  manage_activities: 'Crear y editar actividades',
  manage_notices: 'Crear avisos',
  assign_tasks: 'Asignar tareas',
  review_tasks: 'Revisar tareas (hecha / pendiente)',
  manage_members: 'Agregar y quitar miembros',
  record_attendance: 'Registrar asistencia',
  manage_achievements: 'Registrar clases y especialidades',
  approve_changes: 'Aprobar cambios de Directores Asociados',
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

const DIRECTOR_PERMISSIONS: Permission[] = [
  'create_users',
  'edit_users',
  'manage_club',
  'manage_activities',
  'manage_notices',
  'assign_tasks',
  'review_tasks',
  'manage_members',
  'record_attendance',
  'manage_achievements',
  'approve_changes',
];

// Permisos que trae cada rol. El Director General puede dar o quitar
// permisos individuales a cada usuario además de estos.
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  miembro: [],
  director: DIRECTOR_PERMISSIONS,
  // Igual que el Director, pero sus cambios requieren aprobación.
  // Crear usuarios solo si el Director General le da el permiso.
  director_asociado: DIRECTOR_PERMISSIONS.filter(
    (p) => p !== 'create_users' && p !== 'approve_changes',
  ),
  consejero: ['assign_tasks', 'review_tasks'],
  instructor: ['assign_tasks', 'review_tasks'],
  secretario: [],
  tesorero: [],
  capellan: [],
};

// Colores de la tarjeta de asistencia: 0 faltas = verde, 3-4 = amarillo, 5 o más = rojo.
export const ATTENDANCE_YELLOW_MIN = 3;
export const ATTENDANCE_RED_MIN = 5;

export const CLASSES_BY_CLUB: Record<ClubId, string[]> = {
  aventureros: ['Corderitos', 'Aves Madrugadoras', 'Abejitas Laboriosas', 'Rayitos de Sol', 'Constructores', 'Manos Ayudadoras'],
  conquistadores: ['Amigo', 'Compañero', 'Explorador', 'Orientador', 'Viajero', 'Guía'],
  guias: ['Guía Mayor', 'Guía Mayor Avanzado', 'Guía Mayor Instructor'],
};

export const PASSWORD_MIN_LENGTH = 8;
