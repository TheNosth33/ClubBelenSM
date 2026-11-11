import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useData, useMe } from '../../data/DataContext';
import { nextActivity, noticesFor, recentSince, pendingApprovalsFor, submissionsToReview, tasksAssignedTo, visibleClubs } from '../../data/selectors';
import { Avatar } from '../../components/Avatar';
import { NotificationBell } from '../../components/Header';
import { HeroActivity, NoticeRow, TaskRow } from '../../components/Items';
import { EmptyState, Screen, SectionTitle } from '../../components/ui';
import { colors, radius } from '../../theme';
import { capitalize, formatLong, todayISO } from '../../utils/dates';
import { firstName } from '../../utils/users';

export default function Home() {
  const { db } = useData();
  const me = useMe();
  const clubs = visibleClubs(me);
  const mainClub = db.clubs[me.clubs[0] ?? 'conquistadores'];

  const myTasks = tasksAssignedTo(db, me.id).filter((t) => t.assignments[me.id].status !== 'hecha');
  const unseen = myTasks.filter((t) => !t.assignments[me.id].seen);
  const opened = myTasks.filter((t) => t.assignments[me.id].seen);

  const [openedAt] = useState(() => Date.now());
  const recentLimit = recentSince(14, openedAt);
  const notices = noticesFor(db, clubs)
    .filter((n) => n.createdAt >= recentLimit)
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  const toReview = submissionsToReview(db, me).length;
  const approvals = pendingApprovalsFor(db, me).length;

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.navigate('/perfil')}>
        <Avatar name={me.fullName} uri={me.photoUri} size={52} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.date}>{capitalize(formatLong(todayISO()))}</Text>
        <Text style={styles.name} numberOfLines={1}>
          ¡Hola, {firstName(me)}!
        </Text>
        <Text style={styles.motto} numberOfLines={2}>
          “{mainClub.motto}”
        </Text>
      </View>
      <NotificationBell />
    </View>
  );

  return (
    <Screen header={header}>
      <HeroActivity activity={nextActivity(db, clubs)} db={db} />

      {toReview > 0 || approvals > 0 ? (
        <View style={styles.quickRow}>
          {toReview > 0 ? (
            <Pressable style={styles.quick} onPress={() => router.push('/revisar')}>
              <Ionicons name="checkmark-done-outline" size={22} color={colors.primary} />
              <Text style={styles.quickNum}>{toReview}</Text>
              <Text style={styles.quickText}>Entregas por revisar</Text>
            </Pressable>
          ) : null}
          {approvals > 0 ? (
            <Pressable style={styles.quick} onPress={() => router.push('/aprobaciones')}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.warning} />
              <Text style={styles.quickNum}>{approvals}</Text>
              <Text style={styles.quickText}>Cambios por aprobar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <SectionTitle title="Mis tareas" action="Ver todas" onAction={() => router.navigate('/tareas')} />
      {myTasks.length === 0 ? (
        <EmptyState icon="checkmark-done-circle-outline" text="No tienes tareas pendientes. ¡Buen trabajo!" />
      ) : (
        <>
          {unseen.length > 0 ? (
            <>
              <Text style={styles.subhead}>
                Sin ver <Text style={{ color: colors.danger }}>({unseen.length})</Text>
              </Text>
              {unseen.slice(0, 3).map((t) => (
                <TaskRow key={t.id} task={t} assignment={t.assignments[me.id]} db={db} />
              ))}
            </>
          ) : null}
          {opened.length > 0 ? (
            <>
              <Text style={styles.subhead}>Abiertas ({opened.length})</Text>
              {opened.slice(0, 3).map((t) => (
                <TaskRow key={t.id} task={t} assignment={t.assignments[me.id]} db={db} />
              ))}
            </>
          ) : null}
        </>
      )}

      <SectionTitle title="Avisos" action="Ver todos" onAction={() => router.push('/club/avisos')} />
      {notices.length === 0 ? (
        <EmptyState icon="megaphone-outline" text="No hay avisos recientes." />
      ) : (
        notices.map((n) => <NoticeRow key={n.id} notice={n} db={db} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  date: { fontSize: 13, color: colors.textMuted },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  motto: { fontSize: 13, color: colors.primary, fontStyle: 'italic', marginTop: 1 },
  subhead: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  quick: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 2 },
  quickNum: { fontSize: 22, fontWeight: '800', color: colors.text },
  quickText: { fontSize: 12, color: colors.textMuted },
});
