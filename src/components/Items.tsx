import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Activity, Assignment, DB, Notice, Task, User } from '../data/types';
import { colors, radius, shadow } from '../theme';
import { DAYS_SHORT, MONTHS_SHORT, formatLong, formatTime, parseISO, timeAgo, todayISO } from '../utils/dates';
import { ROLE_LABELS } from '../data/constants';
import { Avatar } from './Avatar';
import { shade } from './ClubVisuals';
import { Tag } from './ui';

function daysUntil(iso: string) {
  const t = parseISO(todayISO()).getTime();
  return Math.round((parseISO(iso).getTime() - t) / 86400000);
}

function relativeDay(iso: string) {
  const n = daysUntil(iso);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n > 1 && n < 7) return `En ${n} días`;
  if (n < 0 && n > -2) return 'Ayer';
  return formatLong(iso);
}

/** Tarjeta grande de la próxima actividad. */
export function HeroActivity({ activity, db }: { activity?: Activity; db: DB }) {
  if (!activity) {
    return (
      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.hero}>
        <Text style={styles.heroLabel}>PRÓXIMA ACTIVIDAD</Text>
        <Text style={styles.heroTitle}>No hay actividades programadas</Text>
        <Text style={styles.heroMeta}>Cuando tu director publique una actividad aparecerá aquí.</Text>
      </LinearGradient>
    );
  }
  const color = db.clubs[activity.clubIds[0]].color;
  const d = parseISO(activity.date);
  const allClubs = activity.clubIds.length === 3;
  return (
    <Pressable onPress={() => router.push(`/actividad/${activity.id}`)}>
      <LinearGradient colors={[shade(color, -10), shade(color, -45)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroCircle} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={styles.heroLabel}>PRÓXIMA ACTIVIDAD · {relativeDay(activity.date).toUpperCase()}</Text>
          <View style={styles.heroDate}>
            <Text style={styles.heroDateMonth}>{MONTHS_SHORT[d.getMonth()].toUpperCase()}</Text>
            <Text style={styles.heroDateDay}>{d.getDate()}</Text>
            <Text style={styles.heroDateMonth}>{DAYS_SHORT[d.getDay()]}</Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>{activity.title}</Text>
        {activity.cancelled ? <Tag label="CANCELADA" color={colors.white} bg={colors.danger} /> : null}
        <View style={styles.heroRow}>
          <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.9)" />
          <Text style={styles.heroMeta}>
            {formatTime(activity.startTime)}
            {activity.endTime ? ` – ${formatTime(activity.endTime)}` : ''}
          </Text>
        </View>
        <View style={styles.heroRow}>
          <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.9)" />
          <Text style={styles.heroMeta} numberOfLines={1}>
            {activity.location}
          </Text>
        </View>
        <View style={styles.heroRow}>
          <Ionicons name="people-outline" size={16} color="rgba(255,255,255,0.9)" />
          <Text style={styles.heroMeta}>{allClubs ? 'Todo el Club Belén SM' : activity.clubIds.map((c) => db.clubs[c].name).join(' · ')}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export function ActivityRow({ activity, db }: { activity: Activity; db: DB }) {
  const d = parseISO(activity.date);
  const color = db.clubs[activity.clubIds[0]].color;
  const past = activity.date < todayISO();
  return (
    <Pressable onPress={() => router.push(`/actividad/${activity.id}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }, past && { opacity: 0.6 }]}>
      <View style={[styles.dateBox, { backgroundColor: color + '1A' }]}>
        <Text style={[styles.dateBoxDay, { color }]}>{d.getDate()}</Text>
        <Text style={[styles.dateBoxDow, { color }]}>{DAYS_SHORT[d.getDay()]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, activity.cancelled && { textDecorationLine: 'line-through' }]} numberOfLines={1}>
          {activity.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {formatTime(activity.startTime)} · {activity.location}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {activity.cancelled ? <Tag label="Cancelada" color={colors.danger} /> : null}
          {activity.clubIds.map((c) => (
            <Tag key={c} label={db.clubs[c].name} color={db.clubs[c].color} />
          ))}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const STATUS_INFO: Record<Assignment['status'], { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  pendiente: { label: 'Pendiente', color: colors.warning, icon: 'ellipse-outline' },
  en_revision: { label: 'En revisión', color: colors.primary, icon: 'hourglass-outline' },
  hecha: { label: 'Hecha', color: colors.success, icon: 'checkmark-circle' },
};

export function statusInfo(s: Assignment['status']) {
  return STATUS_INFO[s];
}

export function TaskRow({ task, assignment, db, subtitle }: { task: Task; assignment?: Assignment; db: DB; subtitle?: string }) {
  const n = daysUntil(task.dueDate);
  const overdue = n < 0 && assignment?.status === 'pendiente';
  const st = assignment ? STATUS_INFO[assignment.status] : null;
  const isNew = assignment && !assignment.seen;
  return (
    <Pressable onPress={() => router.push(`/tarea/${task.id}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
      <Ionicons name={st?.icon ?? 'clipboard-outline'} size={26} color={st?.color ?? colors.primary} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {isNew ? <View style={styles.newDot} /> : null}
          <Text style={[styles.rowTitle, { flex: 1 }, isNew && { fontWeight: '800' }]} numberOfLines={1}>
            {task.title}
          </Text>
        </View>
        <Text style={[styles.rowMeta, overdue && { color: colors.danger, fontWeight: '600' }]}>
          {subtitle ?? (overdue ? `Venció: ${formatLong(task.dueDate)}` : `Entrega: ${relativeDay(task.dueDate)}`)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          {isNew ? <Tag label="Nueva" color={colors.danger} /> : null}
          {st ? <Tag label={st.label} color={st.color} /> : null}
          <Tag label={db.clubs[task.clubId].name} color={db.clubs[task.clubId].color} />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function NoticeRow({ notice, db, onDelete }: { notice: Notice; db: DB; onDelete?: () => void }) {
  const author = db.users.find((u) => u.id === notice.createdBy);
  return (
    <View style={[styles.notice, notice.urgent && styles.noticeUrgent]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={notice.urgent ? 'alert-circle' : 'megaphone-outline'} size={20} color={notice.urgent ? colors.danger : colors.primary} />
        <Text style={[styles.rowTitle, { flex: 1 }]}>{notice.title}</Text>
        {onDelete ? (
          <Pressable onPress={onDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.noticeBody}>{notice.body}</Text>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {notice.urgent ? <Tag label="Último momento" color={colors.danger} /> : null}
        {notice.clubIds.length === 3 ? (
          <Tag label="Todos los clubes" color={colors.primary} />
        ) : (
          notice.clubIds.map((c) => <Tag key={c} label={db.clubs[c].name} color={db.clubs[c].color} />)
        )}
        <Text style={styles.rowMeta}>
          {timeAgo(notice.createdAt)}
          {author ? ` · ${author.fullName.split(' ')[0]}` : ''}
        </Text>
      </View>
    </View>
  );
}

export function MemberRow({ user, onPress, right }: { user: User; onPress?: () => void; right?: React.ReactNode }) {
  const roles = user.isGeneralDirector ? ['Director General'] : user.roles.map((r) => ROLE_LABELS[r]);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.member, pressed && { opacity: 0.8 }]}>
      <Avatar name={user.fullName} uri={user.photoUri} size={42} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {user.fullName}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {roles.join(' · ')}
        </Text>
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 20, gap: 8, overflow: 'hidden', minHeight: 210, ...shadow },
  heroCircle: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)', right: -70, bottom: -90 },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '800', letterSpacing: 1, flex: 1, paddingRight: 8 },
  heroTitle: { color: colors.white, fontSize: 26, fontWeight: '800', lineHeight: 31 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMeta: { color: 'rgba(255,255,255,0.92)', fontSize: 15, flexShrink: 1 },
  heroDate: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  heroDateMonth: { color: colors.white, fontSize: 11, fontWeight: '700' },
  heroDateDay: { color: colors.white, fontSize: 26, fontWeight: '800', lineHeight: 30 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  dateBox: { width: 52, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dateBoxDay: { fontSize: 20, fontWeight: '800' },
  dateBoxDow: { fontSize: 11, fontWeight: '700' },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  notice: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginBottom: 10, gap: 8, borderWidth: 1, borderColor: colors.border },
  noticeUrgent: { borderColor: colors.danger + '55', backgroundColor: '#FFF8F8', borderLeftWidth: 4, borderLeftColor: colors.danger },
  noticeBody: { fontSize: 14, color: colors.text, lineHeight: 20 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
});
