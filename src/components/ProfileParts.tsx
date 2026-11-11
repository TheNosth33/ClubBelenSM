import React from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Achievement, Club, DB, User } from '../data/types';
import { ASSOCIATION_NAME, ORG_NAME, ROLE_LABELS } from '../data/constants';
import { attendanceColor, attendanceStats, latestAchievements } from '../data/selectors';
import { colors, radius, shadow } from '../theme';
import { ageFromBirthDate, formatShort } from '../utils/dates';
import { Avatar } from './Avatar';
import { ClubBadge, ClubLogo, Cover, shade } from './ClubVisuals';
import { Button, Tag } from './ui';

export function roleLabels(user: User): string[] {
  const labels = user.roles.map((r) => ROLE_LABELS[r]);
  return user.isGeneralDirector ? ['Director General', ...labels.filter((l) => l !== 'Director')] : labels;
}

export function ProfileCard({ user, db, onEdit }: { user: User; db: DB; onEdit?: () => void }) {
  const age = ageFromBirthDate(user.birthDate);
  return (
    <View style={styles.card}>
      <Cover uri={user.coverUri} color={db.clubs[user.clubs[0] ?? 'conquistadores'].color} height={130} />
      <View style={{ alignItems: 'center', marginTop: -50 }}>
        <Avatar name={user.fullName} uri={user.photoUri} size={100} ring />
      </View>
      <View style={{ alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
        <Text style={styles.name}>{user.fullName}</Text>
        <Text style={styles.meta}>
          @{user.username}
          {age !== null ? ` · ${age} años` : ''}
        </Text>
        <View style={styles.wrap}>
          {roleLabels(user).map((r) => (
            <Tag key={r} label={r} color={colors.primary} />
          ))}
        </View>
        <View style={styles.wrap}>
          {user.clubs.map((c) => (
            <ClubBadge key={c} club={db.clubs[c]} />
          ))}
        </View>
        {onEdit ? <Button title="Editar perfil" icon="create-outline" variant="secondary" small onPress={onEdit} style={{ marginTop: 4 }} /> : null}
      </View>
    </View>
  );
}

export function StatCards({ user, db }: { user: User; db: DB }) {
  const s = attendanceStats(db, user);
  // Sin reuniones registradas aún no hay asistencia que calificar.
  const color = s.meetings === 0 ? colors.text : attendanceColor(s.absences);
  return (
    <View style={styles.stats}>
      <View style={styles.stat}>
        <Ionicons name="people-outline" size={20} color={colors.primary} />
        <Text style={styles.statNum}>{s.meetings}</Text>
        <Text style={styles.statLabel}>Reuniones este año</Text>
      </View>
      <View style={styles.stat}>
        <Ionicons name="checkmark-circle-outline" size={20} color={color} />
        <Text style={[styles.statNum, { color }]}>{s.attended}</Text>
        <Text style={styles.statLabel}>Asistencias en el año</Text>
      </View>
      <View style={styles.stat}>
        <Ionicons name="close-circle-outline" size={20} color={color} />
        <Text style={[styles.statNum, { color }]}>{s.absences}</Text>
        <Text style={styles.statLabel}>{s.absences === 0 && s.meetings > 0 ? '¡Asistencia perfecta!' : 'Faltas'}</Text>
      </View>
    </View>
  );
}

function AchievementColumn({ title, icon, items }: { title: string; icon: React.ComponentProps<typeof Ionicons>['name']; items: Achievement[] }) {
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={18} color={colors.accent} />
        <Text style={styles.colTitle}>{title}</Text>
      </View>
      {items.length === 0 ? <Text style={styles.meta}>Ninguna aún</Text> : null}
      {items.map((a) => (
        <View key={a.id}>
          <Text style={styles.achName}>{a.name}</Text>
          <Text style={styles.achDate}>{formatShort(a.date)}</Text>
        </View>
      ))}
    </View>
  );
}

export function AchievementsCard({ user, db, footer }: { user: User; db: DB; footer?: React.ReactNode }) {
  const classes = latestAchievements(db, user.id, 'clase');
  const specs = latestAchievements(db, user.id, 'especialidad');
  return (
    <View style={[styles.box, { gap: 12 }]}>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <AchievementColumn title="Últimas clases" icon="ribbon-outline" items={classes} />
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <AchievementColumn title="Últimas especialidades" icon="medal-outline" items={specs} />
      </View>
      {footer}
    </View>
  );
}

/** Carnet del miembro con el fondo elegido por el director del club. */
export function IdCard({ user, club }: { user: User; club: Club }) {
  const isDirector = user.isGeneralDirector || user.roles.includes('director') || user.roles.includes('director_asociado');
  const content = (
    <View style={styles.idInner}>
      <View style={styles.idTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.idOrg}>{ORG_NAME}</Text>
          <Text style={styles.idAssoc}>{ASSOCIATION_NAME}</Text>
        </View>
        <ClubLogo club={club} size={44} />
      </View>
      <View style={styles.idBody}>
        <Avatar name={user.fullName} uri={user.photoUri} size={84} ring />
        <View style={{ flex: 1 }}>
          <Text style={styles.idName}>{user.fullName}</Text>
          <Text style={styles.idClub}>{club.name}</Text>
        </View>
      </View>
      <View style={styles.idBottom}>
        <View style={styles.idRole}>
          <Text style={styles.idRoleText}>{isDirector ? 'DIRECTOR' : 'MIEMBRO'}</Text>
        </View>
        <Text style={styles.idUser}>@{user.username}</Text>
      </View>
    </View>
  );
  if (club.cardBackgroundUri) {
    return (
      <ImageBackground source={{ uri: club.cardBackgroundUri }} style={styles.idCard} imageStyle={{ borderRadius: radius.lg }}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: radius.lg }]} />
        {content}
      </ImageBackground>
    );
  }
  return (
    <LinearGradient colors={[shade(club.color, -10), shade(club.color, -55)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.idCard}>
      <View style={styles.idStripe} />
      {content}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.xl, overflow: 'hidden', ...shadow },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  meta: { fontSize: 13, color: colors.textMuted },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 2 },
  statNum: { fontSize: 26, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  box: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border },
  colTitle: { fontSize: 14, fontWeight: '800', color: colors.text, flexShrink: 1 },
  achName: { fontSize: 14, fontWeight: '600', color: colors.text },
  achDate: { fontSize: 12, color: colors.textMuted },
  idCard: { borderRadius: radius.lg, overflow: 'hidden', aspectRatio: 1.586, ...shadow },
  idStripe: { position: 'absolute', width: 400, height: 80, backgroundColor: 'rgba(255,255,255,0.07)', transform: [{ rotate: '-20deg' }], top: 110, left: -40 },
  idInner: { flex: 1, padding: 16, justifyContent: 'space-between' },
  idTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  idOrg: { color: colors.white, fontSize: 18, fontWeight: '800' },
  idAssoc: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  idBody: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  idName: { color: colors.white, fontSize: 17, fontWeight: '800' },
  idClub: { color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 2 },
  idBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  idRole: { backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  idRoleText: { color: colors.primaryDark, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  idUser: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
});
