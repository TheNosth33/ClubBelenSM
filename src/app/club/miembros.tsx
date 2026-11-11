import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useData, useMe } from '../../data/DataContext';
import { can } from '../../data/permissions';
import { membersOf } from '../../data/engine';
import { ClubId } from '../../data/types';
import { MAX_CLUBS } from '../../data/constants';
import { MemberRow } from '../../components/Items';
import { Button, Card, EmptyState, Field, Screen } from '../../components/ui';
import { colors } from '../../theme';
import { ageFromBirthDate } from '../../utils/dates';
import { allowedClubsForAge, normalize } from '../../utils/users';
import { confirmAction, handleResult } from '../../utils/alerts';

export default function Members() {
  const params = useLocalSearchParams<{ club?: ClubId }>();
  const { db, perform } = useData();
  const me = useMe();
  const clubId: ClubId = params.club ?? me.clubs[0] ?? 'conquistadores';
  const club = db.clubs[clubId];
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [q2, setQ2] = useState('');
  const canManage = can(me, 'manage_members', clubId);

  const match = (name: string, query: string) => normalize(name).includes(normalize(query));
  const members = membersOf(db, [clubId])
    .filter((u) => !q || match(u.fullName, q))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const candidates = db.users
    .filter((u) => u.active && !u.clubs.includes(clubId) && u.clubs.length < MAX_CLUBS && allowedClubsForAge(ageFromBirthDate(u.birthDate)).includes(clubId))
    .filter((u) => !q2 || match(u.fullName, q2))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: `Miembros · ${club.name}` }} />
      <View style={{ height: 12 }} />
      <Field label="Buscar" value={q} onChangeText={setQ} placeholder="Nombre del miembro" />
      {canManage ? (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <Button title="Agregar existente" icon="person-add-outline" variant="secondary" small onPress={() => setAdding(true)} style={{ flex: 1 }} />
          {can(me, 'create_users', clubId) ? (
            <Button title="Crear usuario" icon="add" small onPress={() => router.push({ pathname: '/usuario/nuevo', params: { club: clubId } })} style={{ flex: 1 }} />
          ) : null}
        </View>
      ) : null}
      <Card style={{ paddingVertical: 4 }}>
        {members.length === 0 ? <EmptyState icon="people-outline" text="No hay miembros." /> : null}
        {members.map((u) => (
          <MemberRow
            key={u.id}
            user={u}
            onPress={() => router.push(`/usuario/${u.id}`)}
            right={
              canManage && !u.isGeneralDirector && u.id !== me.id ? (
                <Pressable
                  hitSlop={10}
                  onPress={() =>
                    confirmAction('Quitar del club', `¿Quitar a ${u.fullName} de ${club.name}? Su usuario no se elimina.`, () =>
                      handleResult(perform({ type: 'removeMember', userId: u.id, clubId }), 'Miembro quitado del club', false),
                    'Quitar')
                  }
                >
                  <Ionicons name="remove-circle-outline" size={22} color={colors.danger} />
                </Pressable>
              ) : undefined
            }
          />
        ))}
      </Card>

      <Modal visible={adding} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAdding(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.text }}>Agregar a {club.name}</Text>
            <Pressable onPress={() => setAdding(false)} hitSlop={10}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            <Field label="Buscar" value={q2} onChangeText={setQ2} placeholder="Nombre" hint="Solo aparecen usuarios con la edad adecuada y menos de 2 clubes." />
            <Card style={{ paddingVertical: 4 }}>
              {candidates.length === 0 ? <EmptyState text="No hay usuarios disponibles para agregar." /> : null}
              {candidates.map((u) => (
                <MemberRow
                  key={u.id}
                  user={u}
                  onPress={() => {
                    setAdding(false);
                    handleResult(perform({ type: 'addMember', userId: u.id, clubId }), `${u.fullName} agregado`, false);
                  }}
                  right={<Ionicons name="add-circle" size={24} color={colors.primary} />}
                />
              ))}
            </Card>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}
