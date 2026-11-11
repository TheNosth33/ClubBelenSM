import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useData, useMe } from '../../data/DataContext';
import { can } from '../../data/permissions';
import { membersOf } from '../../data/engine';
import { nextActivity, noticesFor, pendingApprovalsFor, visibleClubs } from '../../data/selectors';
import { ClubId } from '../../data/types';
import { ORG_NAME } from '../../data/constants';
import { TabHeader } from '../../components/Header';
import { ClubLogo, Cover } from '../../components/ClubVisuals';
import { HeroActivity, MemberRow, NoticeRow } from '../../components/Items';
import { Card, Chip, EmptyState, IconName, ListRow, Screen, SectionTitle } from '../../components/ui';
import { colors, radius, shadow } from '../../theme';

export default function MyClub() {
  const { db } = useData();
  const me = useMe();
  const clubs = visibleClubs(me);
  const [clubId, setClubId] = useState<ClubId>(me.clubs[0] ?? clubs[0]);
  const club = db.clubs[clubId];
  const members = membersOf(db, [clubId]).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const notices = noticesFor(db, [clubId]).slice(0, 3);
  const approvals = pendingApprovalsFor(db, me).filter((p) => p.clubId === clubId).length;

  const shortcuts: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'calendar', label: 'Calendario', onPress: () => router.navigate('/calendario') },
    { icon: 'people', label: 'Miembros', onPress: () => router.push({ pathname: '/club/miembros', params: { club: clubId } }) },
    { icon: 'megaphone', label: 'Avisos', onPress: () => router.push({ pathname: '/club/avisos', params: { club: clubId } }) },
    { icon: 'checkbox', label: 'Tareas', onPress: () => router.navigate('/tareas') },
  ];

  const tools: { icon: IconName; title: string; subtitle: string; onPress: () => void; show: boolean }[] = [
    { icon: 'add-circle-outline', title: 'Crear actividad', subtitle: 'Agregar al calendario del club', onPress: () => router.push({ pathname: '/crear/actividad', params: { club: clubId } }), show: can(me, 'manage_activities', clubId) },
    { icon: 'megaphone-outline', title: 'Publicar aviso', subtitle: 'Cambios de último momento y anuncios', onPress: () => router.push({ pathname: '/crear/aviso', params: { club: clubId } }), show: can(me, 'manage_notices', clubId) },
    { icon: 'clipboard-outline', title: 'Asignar tarea', subtitle: 'A uno o varios miembros', onPress: () => router.push({ pathname: '/crear/tarea', params: { club: clubId } }), show: can(me, 'assign_tasks', clubId) },
    { icon: 'checkmark-done-outline', title: 'Revisar tareas', subtitle: 'Marcar como hechas o pendientes', onPress: () => router.push('/revisar'), show: can(me, 'review_tasks', clubId) },
    { icon: 'list-outline', title: 'Registrar asistencia', subtitle: 'Reunión del club', onPress: () => router.push({ pathname: '/asistencia', params: { club: clubId } }), show: can(me, 'record_attendance', clubId) },
    { icon: 'person-add-outline', title: 'Crear usuario', subtitle: 'Nuevo miembro del club', onPress: () => router.push({ pathname: '/usuario/nuevo', params: { club: clubId } }), show: can(me, 'create_users', clubId) },
    { icon: 'shield-checkmark-outline', title: 'Aprobaciones', subtitle: approvals ? `${approvals} cambio(s) esperando` : 'Cambios de directores asociados', onPress: () => router.push('/aprobaciones'), show: can(me, 'approve_changes', clubId) },
  ];
  const visibleTools = tools.filter((t) => t.show);

  return (
    <Screen header={<TabHeader title="Mi Club" subtitle={ORG_NAME} />}>
      {clubs.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
          {clubs.map((c) => (
            <Chip key={c} label={db.clubs[c].name} selected={c === clubId} onPress={() => setClubId(c)} color={db.clubs[c].color} />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.clubCard}>
        <Cover uri={club.coverUri} color={club.color} height={150}>
          {can(me, 'manage_club', clubId) ? (
            <Pressable style={styles.editBtn} onPress={() => router.push({ pathname: '/club/editar', params: { club: clubId } })}>
              <Ionicons name="create-outline" size={18} color={colors.white} />
            </Pressable>
          ) : null}
        </Cover>
        <View style={styles.clubInfo}>
          <View style={{ marginTop: -40 }}>
            <ClubLogo club={club} size={76} />
          </View>
          <View style={{ flex: 1, paddingTop: 8 }}>
            <Text style={styles.clubName}>{club.name}</Text>
            <Text style={styles.clubSub}>
              {ORG_NAME} · {members.length} miembros
            </Text>
          </View>
        </View>
        <Text style={styles.motto}>“{club.motto}”</Text>
      </View>

      <View style={styles.shortcuts}>
        {shortcuts.map((s) => (
          <Pressable key={s.label} style={styles.shortcut} onPress={s.onPress}>
            <View style={[styles.shortcutIcon, { backgroundColor: club.color + '1A' }]}>
              <Ionicons name={s.icon} size={24} color={club.color} />
            </View>
            <Text style={styles.shortcutText}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {visibleTools.length > 0 ? (
        <>
          <SectionTitle title="Herramientas de dirección" />
          <Card style={{ paddingVertical: 4 }}>
            {visibleTools.map((t) => (
              <ListRow key={t.title} icon={t.icon} title={t.title} subtitle={t.subtitle} onPress={t.onPress} />
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle title="Próxima actividad" />
      <HeroActivity activity={nextActivity(db, [clubId])} db={db} />

      <SectionTitle title="Últimos avisos" action="Ver todos" onAction={() => router.push({ pathname: '/club/avisos', params: { club: clubId } })} />
      {notices.length === 0 ? <EmptyState icon="megaphone-outline" text="Sin avisos." /> : notices.map((n) => <NoticeRow key={n.id} notice={n} db={db} />)}

      <SectionTitle title={`Miembros (${members.length})`} action="Ver todos" onAction={() => router.push({ pathname: '/club/miembros', params: { club: clubId } })} />
      <Card style={{ paddingVertical: 4 }}>
        {members.length === 0 ? (
          <EmptyState icon="people-outline" text="Este club aún no tiene miembros." />
        ) : (
          members.map((u) => <MemberRow key={u.id} user={u} onPress={() => router.push(`/usuario/${u.id}`)} />)
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  clubCard: { backgroundColor: colors.card, borderRadius: radius.xl, overflow: 'hidden', ...shadow },
  editBtn: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  clubInfo: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  clubName: { fontSize: 22, fontWeight: '800', color: colors.text },
  clubSub: { fontSize: 13, color: colors.textMuted },
  motto: { fontStyle: 'italic', color: colors.textMuted, paddingHorizontal: 16, paddingVertical: 12 },
  shortcuts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 8 },
  shortcut: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: colors.card, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  shortcutIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  shortcutText: { fontSize: 12, fontWeight: '700', color: colors.text },
});
