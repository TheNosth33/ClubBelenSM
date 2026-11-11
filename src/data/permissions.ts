import { CLUB_IDS, ROLE_PERMISSIONS } from './constants';
import { Action, ClubId, DB, Permission, Role, User } from './types';

export function isLeaderRole(r: Role) {
  return r === 'director' || r === 'director_asociado';
}

/** Permisos efectivos: los de sus roles + los dados por el Director General − los quitados. */
export function effectivePermissions(user: User): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of user.roles) ROLE_PERMISSIONS[r].forEach((p) => set.add(p));
  user.extraPermissions.forEach((p) => set.add(p));
  user.revokedPermissions.forEach((p) => set.delete(p));
  return set;
}

export function rolePermissions(roles: Role[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of roles) ROLE_PERMISSIONS[r].forEach((p) => set.add(p));
  return set;
}

/** ¿Puede el usuario hacer `perm` en el club indicado (o en alguno, si no se indica)? */
export function can(user: User | null | undefined, perm: Permission, clubId?: ClubId): boolean {
  if (!user || !user.active) return false;
  if (user.isGeneralDirector) return true;
  if (!effectivePermissions(user).has(perm)) return false;
  return clubId ? user.clubs.includes(clubId) : true;
}

/** Clubes en los que el usuario tiene ese permiso. */
export function clubsWith(user: User | null | undefined, perm: Permission): ClubId[] {
  if (!user) return [];
  if (user.isGeneralDirector) return CLUB_IDS;
  return user.clubs.filter((c) => can(user, perm, c));
}

/**
 * Los Directores Asociados necesitan aprobación para todos sus cambios,
 * salvo que el permiso también les venga de otro rol (p. ej. Consejero asignando tareas)
 * o que además sean Director.
 */
export function needsApproval(user: User, perm: Permission): boolean {
  if (user.isGeneralDirector) return false;
  if (!user.roles.includes('director_asociado')) return false;
  if (user.roles.includes('director')) return false;
  const otherRoles = user.roles.filter((r) => r !== 'director_asociado');
  return !rolePermissions(otherRoles).has(perm);
}

/** Qué permiso y en qué clubes requiere cada acción. */
export function actionRequirements(db: DB, action: Action): { perm: Permission; clubs: ClubId[] } | null {
  switch (action.type) {
    case 'createActivity':
      return { perm: 'manage_activities', clubs: action.data.clubIds };
    case 'updateActivity':
    case 'deleteActivity': {
      const a = db.activities.find((x) => x.id === action.id);
      if (!a) return null;
      const clubs = action.type === 'updateActivity' && action.data.clubIds ? [...new Set([...a.clubIds, ...action.data.clubIds])] : a.clubIds;
      return { perm: 'manage_activities', clubs };
    }
    case 'createNotice':
      return { perm: 'manage_notices', clubs: action.data.clubIds };
    case 'deleteNotice': {
      const n = db.notices.find((x) => x.id === action.id);
      return n ? { perm: 'manage_notices', clubs: n.clubIds } : null;
    }
    case 'createTask':
      return { perm: 'assign_tasks', clubs: [action.data.clubId] };
    case 'deleteTask': {
      const t = db.tasks.find((x) => x.id === action.id);
      return t ? { perm: 'assign_tasks', clubs: [t.clubId] } : null;
    }
    case 'reviewTask': {
      const t = db.tasks.find((x) => x.id === action.taskId);
      return t ? { perm: 'review_tasks', clubs: [t.clubId] } : null;
    }
    case 'addMember':
    case 'removeMember':
      return { perm: 'manage_members', clubs: [action.clubId] };
    case 'updateClub':
      return { perm: 'manage_club', clubs: [action.clubId] };
    case 'createUser':
      return { perm: 'create_users', clubs: action.data.clubs };
    case 'updateUser': {
      const u = db.users.find((x) => x.id === action.userId);
      if (!u) return null;
      return { perm: 'edit_users', clubs: [...new Set([...u.clubs, ...(action.data.clubs ?? [])])] };
    }
    case 'recordMeeting':
      return { perm: 'record_attendance', clubs: [action.data.clubId] };
    case 'addAchievement': {
      const u = db.users.find((x) => x.id === action.data.userId);
      return u ? { perm: 'manage_achievements', clubs: u.clubs.slice(0, 1) } : null;
    }
    case 'removeAchievement': {
      const a = db.achievements.find((x) => x.id === action.id);
      const u = a && db.users.find((x) => x.id === a.userId);
      return u ? { perm: 'manage_achievements', clubs: u.clubs.slice(0, 1) } : null;
    }
    case 'activateUser': {
      const u = db.users.find((x) => x.id === action.userId);
      return u ? { perm: 'create_users', clubs: u.clubs } : null;
    }
  }
}

/**
 * Para editar usuarios de un club, basta tener el permiso en al menos uno de
 * los clubes del usuario (el usuario puede estar en dos clubes).
 */
export function canPerform(db: DB, user: User, action: Action): boolean {
  const req = actionRequirements(db, action);
  if (!req) return false;
  if (user.isGeneralDirector) return true;
  if (action.type === 'updateUser' || action.type === 'addAchievement' || action.type === 'removeAchievement') {
    const target = db.users.find((u) =>
      u.id === (action.type === 'updateUser' ? action.userId : action.type === 'addAchievement' ? action.data.userId : db.achievements.find((a) => a.id === action.id)?.userId),
    );
    if (!target) return false;
    if (target.isGeneralDirector) return false;
    // Cambios de rol de liderazgo y de permisos: solo el Director General.
    if (action.type === 'updateUser') {
      const d = action.data;
      if (d.extraPermissions || d.revokedPermissions) return false;
      if (d.roles && d.roles.some((r) => isLeaderRole(r) && !target.roles.includes(r))) return false;
      if (d.roles && target.roles.some((r) => isLeaderRole(r) && !d.roles!.includes(r))) return false;
      const newClubs = d.clubs ?? target.clubs;
      if (!newClubs.every((c) => target.clubs.includes(c) || can(user, req.perm, c))) return false;
    }
    return target.clubs.some((c) => can(user, req.perm, c));
  }
  if (action.type === 'createUser' && action.data.roles.some(isLeaderRole)) return false;
  if (action.type === 'activateUser') return false; // solo mediante aprobación
  return req.clubs.length > 0 && req.clubs.every((c) => can(user, req.perm, c));
}
