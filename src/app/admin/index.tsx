import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useData, useMe } from '../../data/DataContext';
import { CLUB_IDS } from '../../data/constants';
import { membersOf } from '../../data/engine';
import { pendingApprovalsFor } from '../../data/selectors';
import { ClubId } from '../../data/types';
import { MemberRow } from '../../components/Items';
import { ClubLogo } from '../../components/ClubVisuals';
import { Button, Card, Chip, EmptyState, Field, ListRow, Screen, SectionTitle, Tag } from '../../components/ui';
import { colors, radius } from '../../theme';
import { normalize } from '../../utils/users';
import { confirmAction } from '../../utils/alerts';

export default function Admin() {
  const { db, resetData } = useData();
  const me = useMe();
  const [q, setQ] = useState('');
  const [club, setClub] = useState<ClubId | 'todos' | 'sin'>('todos');

  if (!me.isGeneralDirector) return <Screen edges={['bottom']}><EmptyState icon="lock-closed-outline" text="Solo el Director General puede ver este panel." /></Screen>;

  const users = db.users
    .filter((u) => (club === 'todos' ? true : club === 'sin' ? u.clubs.length === 0 : u.clubs.includes(club)))
    .filter((u) => !q || normalize(u.fullName + ' ' + u.username).includes(normalize(q)))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  const approvals = pendingApprovalsFor(db, me).length;

  return (
    <Screen edges={['bottom']}>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{db.users.filter((u) => u.active).length}</Text>
          <Text style={styles.statLabel}>Usuarios activos</Text>
        </View>
        {CLUB_IDS.map((c) => (
          <View key={c} style={styles.stat}>
            <Text style={[styles.statNum, { color: db.clubs[c].color }]}>{membersOf(db, [c]).length}</Text>
            <Text style={styles.statLabel}>{db.clubs[c].name}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Button title="Crear usuario" icon="person-add-outline" small style={{ flex: 1 }} onPress={() => router.push('/usuario/nuevo')} />
        <Button title={`Aprobaciones (${approvals})`} icon="shield-checkmark-outline" variant="secondary" small style={{ flex: 1 }} onPress={() => router.push('/aprobaciones')} />
      </View>

      <SectionTitle title="Clubes" />
      <Card style={{ paddingVertical: 4 }}>
        {CLUB_IDS.map((c) => (
          <ListRow
            key={c}
            title={db.clubs[c].name}
            subtitle={`Portada, logo, lema y fondo del carnet · ${membersOf(db, [c]).length} miembros`}
            onPress={() => router.push({ pathname: '/club/editar', params: { club: c } })}
            right={<ClubLogo club={db.clubs[c]} size={36} />}
          />
        ))}
      </Card>

      <SectionTitle title={`Usuarios (${users.length})`} />
      <Field label="Buscar" value={q} onChangeText={setQ} placeholder="Nombre o usuario" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
        <Chip label="Todos" selected={club === 'todos'} onPress={() => setClub('todos')} color={colors.text} />
        {CLUB_IDS.map((c) => (
          <Chip key={c} label={db.clubs[c].name} selected={club === c} onPress={() => setClub(c)} color={db.clubs[c].color} />
        ))}
        <Chip label="Sin club" selected={club === 'sin'} onPress={() => setClub('sin')} color={colors.textMuted} />
      </ScrollView>
      <Card style={{ paddingVertical: 4 }}>
        {users.length === 0 ? <EmptyState text="Sin resultados." /> : null}
        {users.map((u) => (
          <MemberRow
            key={u.id}
            user={u}
            onPress={() => router.push(u.id === me.id ? '/perfil' : { pathname: '/admin/usuario', params: { id: u.id } })}
            right={!u.active ? <Tag label="Inactivo" color={colors.danger} /> : undefined}
          />
        ))}
      </Card>

      {resetData ? (
        <>
          <SectionTitle title="Datos de la aplicación" />
          <Card style={{ gap: 10 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              Estás en modo demostración: los datos se guardan solo en este teléfono. Para usar la app con todo el club, conéctala a Supabase (ver README).
            </Text>
            <Button
              title="Borrar datos de ejemplo y empezar"
              icon="trash-outline"
              variant="danger"
              small
              onPress={() => confirmAction('Empezar de cero', 'Se borrarán todos los usuarios, actividades, tareas y avisos. Solo quedará tu cuenta.', () => resetData(false), 'Borrar todo')}
            />
            <Button
              title="Restaurar datos de ejemplo"
              icon="refresh"
              variant="ghost"
              small
              onPress={() => confirmAction('Restaurar ejemplo', 'Se reemplazarán todos los datos por los de ejemplo.', () => resetData(true), 'Restaurar')}
            />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.card, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border },
  statNum: { fontSize: 24, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
});
