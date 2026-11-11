import { ATTENDANCE_RED_MIN, ATTENDANCE_YELLOW_MIN, CLUB_IDS } from './constants';
import { Activity, ClubId, DB, Notice, Task, User } from './types';
import { todayISO } from '../utils/dates';
import { colors } from '../theme';
import { can } from './permissions';

/** Clubes que el usuario puede ver. El Director General ve todos. */
export function visibleClubs(user: User): ClubId[] {
  return user.isGeneralDirector ? CLUB_IDS : user.clubs;
}

/** Avisos de los últimos `days` días. */
export function recentSince(days: number, now: number): string {
  return new Date(now - days * 86400000).toISOString();
}

export function activitiesFor(db: DB, clubIds: ClubId[]): Activity[] {
  return db.activities
    .filter((a) => a.clubIds.some((c) => clubIds.includes(c)))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}

export function nextActivity(db: DB, clubIds: ClubId[]): Activity | undefined {
  const today = todayISO();
  return activitiesFor(db, clubIds).find((a) => a.date >= today && !a.cancelled) ?? activitiesFor(db, clubIds).find((a) => a.date >= today);
}

export function noticesFor(db: DB, clubIds: ClubId[]): Notice[] {
  return db.notices.filter((n) => n.clubIds.some((c) => clubIds.includes(c))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function tasksAssignedTo(db: DB, userId: string): Task[] {
  return db.tasks.filter((t) => t.assignments[userId]).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Entregas que el usuario puede revisar (estado "en revisión"). */
export function submissionsToReview(db: DB, user: User): { task: Task; userId: string }[] {
  const out: { task: Task; userId: string }[] = [];
  for (const t of db.tasks) {
    if (!can(user, 'review_tasks', t.clubId) && t.createdBy !== user.id) continue;
    for (const [uid, a] of Object.entries(t.assignments)) {
      if (a.status === 'en_revision' && uid !== user.id) out.push({ task: t, userId: uid });
    }
  }
  return out;
}

export function attendanceStats(db: DB, user: User, year = new Date().getFullYear()) {
  const today = todayISO();
  // Si el usuario está en 2 clubes y ambos se reúnen el mismo día, cuenta como una sola reunión.
  const byDate = new Map<string, boolean>();
  for (const m of db.meetings) {
    if (!m.date.startsWith(String(year)) || m.date > today) continue;
    const present = m.presentIds.includes(user.id);
    if (!present && !m.absentIds.includes(user.id)) continue;
    byDate.set(m.date, (byDate.get(m.date) ?? false) || present);
  }
  const meetings = byDate.size;
  const attended = [...byDate.values()].filter(Boolean).length;
  return { meetings, attended, absences: meetings - attended };
}

export function attendanceColor(absences: number): string {
  if (absences === 0) return colors.success;
  if (absences >= ATTENDANCE_RED_MIN) return colors.danger;
  if (absences >= ATTENDANCE_YELLOW_MIN) return colors.warning;
  return colors.text;
}

export function latestAchievements(db: DB, userId: string, kind: 'clase' | 'especialidad', n = 3) {
  return db.achievements
    .filter((a) => a.userId === userId && a.kind === kind)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);
}

export function userById(db: DB, id: string) {
  return db.users.find((u) => u.id === id);
}

export function pendingApprovalsFor(db: DB, user: User) {
  return db.pending.filter((p) => p.status === 'pendiente' && (user.isGeneralDirector || can(user, 'approve_changes', p.clubId)));
}
