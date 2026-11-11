import { CLUB_INFO } from './constants';
import { Action, AppNotification, ClubId, DB, User } from './types';
import { formatLong, nowISO } from '../utils/dates';
import { newId } from '../utils/users';

export function membersOf(db: DB, clubIds: ClubId[]): User[] {
  return db.users.filter((u) => u.active && u.clubs.some((c) => clubIds.includes(c)));
}

/** Directores (y el Director General) que pueden aprobar cambios de un club. */
export function approversOf(db: DB, clubId: ClubId): User[] {
  return db.users.filter(
    (u) => u.active && (u.isGeneralDirector || (u.roles.includes('director') && u.clubs.includes(clubId))),
  );
}

function notify(db: DB, userIds: string[], title: string, body: string, href?: string, exclude?: string): DB {
  const created = nowISO();
  const unique = [...new Set(userIds)].filter((id) => id !== exclude);
  const notifs: AppNotification[] = unique.map((userId) => ({
    id: newId(),
    userId,
    title,
    body,
    href,
    read: false,
    createdAt: created,
  }));
  return { ...db, notifications: [...notifs, ...db.notifications].slice(0, 2000) };
}

export function notifyUsers(db: DB, userIds: string[], title: string, body: string, href?: string, exclude?: string) {
  return notify(db, userIds, title, body, href, exclude);
}

const clubNames = (ids: ClubId[]) => ids.map((c) => CLUB_INFO[c].name).join(', ');

/** Texto corto para mostrar una acción pendiente de aprobación. */
export function summarizeAction(db: DB, action: Action): string {
  const userName = (id: string) => db.users.find((u) => u.id === id)?.fullName ?? 'usuario';
  switch (action.type) {
    case 'createActivity':
      return `Crear actividad "${action.data.title}" (${formatLong(action.data.date)})`;
    case 'updateActivity':
      return `Modificar actividad "${db.activities.find((a) => a.id === action.id)?.title ?? ''}"`;
    case 'deleteActivity':
      return `Eliminar actividad "${db.activities.find((a) => a.id === action.id)?.title ?? ''}"`;
    case 'createNotice':
      return `Publicar aviso "${action.data.title}"`;
    case 'deleteNotice':
      return `Eliminar aviso "${db.notices.find((n) => n.id === action.id)?.title ?? ''}"`;
    case 'createTask':
      return `Asignar tarea "${action.data.title}" a ${Object.keys(action.data.assignments).length} miembro(s)`;
    case 'deleteTask':
      return `Eliminar tarea "${db.tasks.find((t) => t.id === action.id)?.title ?? ''}"`;
    case 'reviewTask':
      return `Marcar como ${action.status} la tarea "${db.tasks.find((t) => t.id === action.taskId)?.title ?? ''}" de ${userName(action.userId)}`;
    case 'addMember':
      return `Agregar a ${userName(action.userId)} a ${CLUB_INFO[action.clubId].name}`;
    case 'removeMember':
      return `Quitar a ${userName(action.userId)} de ${CLUB_INFO[action.clubId].name}`;
    case 'updateClub':
      return `Modificar datos del club ${CLUB_INFO[action.clubId].name}`;
    case 'createUser':
      return `Crear usuario ${action.data.fullName} (${clubNames(action.data.clubs)})`;
    case 'updateUser':
      return `Modificar datos de ${userName(action.userId)}`;
    case 'recordMeeting':
      return `Registrar asistencia: ${action.data.title} (${formatLong(action.data.date)})`;
    case 'addAchievement':
      return `Registrar ${action.data.kind} "${action.data.name}" a ${userName(action.data.userId)}`;
    case 'activateUser':
      return `Activar usuario ${userName(action.userId)}`;
    case 'removeAchievement':
      return `Quitar ${db.achievements.find((a) => a.id === action.id)?.kind ?? 'logro'} a ${userName(db.achievements.find((a) => a.id === action.id)?.userId ?? '')}`;
  }
}

/** Aplica una acción ya autorizada y genera las notificaciones correspondientes. */
export function applyAction(db: DB, action: Action, actorId: string): DB {
  const now = nowISO();
  switch (action.type) {
    case 'createActivity': {
      const id = newId();
      const next = { ...db, activities: [...db.activities, { ...action.data, id, createdBy: actorId, createdAt: now }] };
      return notify(
        next,
        membersOf(db, action.data.clubIds).map((u) => u.id),
        'Nueva actividad',
        `${action.data.title} · ${formatLong(action.data.date)}`,
        `/actividad/${id}`,
        actorId,
      );
    }
    case 'updateActivity': {
      const prev = db.activities.find((a) => a.id === action.id);
      if (!prev) return db;
      const updated = { ...prev, ...action.data, updatedAt: now };
      let next: DB = { ...db, activities: db.activities.map((a) => (a.id === action.id ? updated : a)) };
      if (action.notify) {
        // Cambio de último momento: se publica un aviso urgente automáticamente.
        const changes: string[] = [];
        if (prev.date !== updated.date) changes.push(`nueva fecha: ${formatLong(updated.date)}`);
        if (prev.startTime !== updated.startTime) changes.push(`nueva hora: ${updated.startTime}`);
        if (prev.location !== updated.location) changes.push(`nuevo lugar: ${updated.location}`);
        if (!prev.cancelled && updated.cancelled) changes.push('la actividad fue cancelada');
        if (prev.cancelled && !updated.cancelled) changes.push('la actividad vuelve a estar programada');
        const body = changes.length ? `Cambio en "${updated.title}": ${changes.join(', ')}.` : `Se actualizó la información de "${updated.title}".`;
        next = {
          ...next,
          notices: [
            { id: newId(), clubIds: updated.clubIds, title: updated.cancelled ? 'Actividad cancelada' : 'Cambio de actividad', body, urgent: true, activityId: updated.id, createdBy: actorId, createdAt: now },
            ...next.notices,
          ],
        };
        next = notify(next, membersOf(db, updated.clubIds).map((u) => u.id), '⚠️ Cambio de último momento', body, `/actividad/${updated.id}`, actorId);
      }
      return next;
    }
    case 'deleteActivity':
      return { ...db, activities: db.activities.filter((a) => a.id !== action.id) };
    case 'createNotice': {
      const id = newId();
      const next = { ...db, notices: [{ ...action.data, id, createdBy: actorId, createdAt: now }, ...db.notices] };
      return notify(next, membersOf(db, action.data.clubIds).map((u) => u.id), action.data.urgent ? '⚠️ Aviso urgente' : 'Nuevo aviso', action.data.title, `/club/avisos`, actorId);
    }
    case 'deleteNotice':
      return { ...db, notices: db.notices.filter((n) => n.id !== action.id) };
    case 'createTask': {
      const id = newId();
      const next = { ...db, tasks: [...db.tasks, { ...action.data, id, createdBy: actorId, createdAt: now }] };
      return notify(next, Object.keys(action.data.assignments), 'Nueva tarea asignada', action.data.title, `/tarea/${id}`, actorId);
    }
    case 'deleteTask':
      return { ...db, tasks: db.tasks.filter((t) => t.id !== action.id) };
    case 'reviewTask': {
      const task = db.tasks.find((t) => t.id === action.taskId);
      if (!task || !task.assignments[action.userId]) return db;
      const a = task.assignments[action.userId];
      const updated = {
        ...task,
        assignments: { ...task.assignments, [action.userId]: { ...a, status: action.status, reviewedAt: now, reviewedBy: actorId } },
      };
      const next = { ...db, tasks: db.tasks.map((t) => (t.id === task.id ? updated : t)) };
      return notify(
        next,
        [action.userId],
        action.status === 'hecha' ? '✅ Tarea aprobada' : 'Tarea devuelta a pendiente',
        task.title,
        `/tarea/${task.id}`,
        actorId,
      );
    }
    case 'addMember':
      return {
        ...db,
        users: db.users.map((u) => (u.id === action.userId && !u.clubs.includes(action.clubId) ? { ...u, clubs: [...u.clubs, action.clubId] } : u)),
      };
    case 'removeMember':
      return {
        ...db,
        users: db.users.map((u) => (u.id === action.userId ? { ...u, clubs: u.clubs.filter((c) => c !== action.clubId) } : u)),
      };
    case 'updateClub':
      return { ...db, clubs: { ...db.clubs, [action.clubId]: { ...db.clubs[action.clubId], ...action.data } } };
    case 'createUser': {
      if (db.users.some((u) => u.username.toLowerCase() === action.data.username.toLowerCase())) return db;
      return {
        ...db,
        users: [
          ...db.users,
          { ...action.data, id: newId(), extraPermissions: [], revokedPermissions: [], active: true, createdAt: now },
        ],
      };
    }
    case 'updateUser':
      return { ...db, users: db.users.map((u) => (u.id === action.userId ? { ...u, ...action.data } : u)) };
    case 'recordMeeting': {
      const existing = db.meetings.find((m) => m.clubId === action.data.clubId && m.date === action.data.date);
      if (existing) {
        return { ...db, meetings: db.meetings.map((m) => (m.id === existing.id ? { ...m, ...action.data } : m)) };
      }
      return { ...db, meetings: [...db.meetings, { ...action.data, id: newId(), createdBy: actorId }] };
    }
    case 'addAchievement': {
      const next = { ...db, achievements: [...db.achievements, { ...action.data, id: newId(), grantedBy: actorId }] };
      return notify(next, [action.data.userId], action.data.kind === 'clase' ? '🎖️ Nueva clase obtenida' : '🏅 Nueva especialidad', action.data.name, '/perfil', actorId);
    }
    case 'removeAchievement':
      return { ...db, achievements: db.achievements.filter((a) => a.id !== action.id) };
    case 'activateUser':
      return { ...db, users: db.users.map((u) => (u.id === action.userId ? { ...u, active: true } : u)) };
  }
}
