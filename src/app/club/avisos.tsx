import React from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useData, useMe } from '../../data/DataContext';
import { can, clubsWith } from '../../data/permissions';
import { noticesFor, visibleClubs } from '../../data/selectors';
import { ClubId } from '../../data/types';
import { NoticeRow } from '../../components/Items';
import { Button, EmptyState, Screen } from '../../components/ui';
import { confirmAction, handleResult } from '../../utils/alerts';

export default function Notices() {
  const params = useLocalSearchParams<{ club?: ClubId }>();
  const { db, perform } = useData();
  const me = useMe();
  const clubs = params.club ? [params.club] : visibleClubs(me);
  const notices = noticesFor(db, clubs);
  const canCreate = clubsWith(me, 'manage_notices').some((c) => clubs.includes(c));

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: params.club ? `Avisos · ${db.clubs[params.club].name}` : 'Avisos' }} />
      <View style={{ height: 12 }} />
      {canCreate ? (
        <Button title="Nuevo aviso" icon="add" small onPress={() => router.push({ pathname: '/crear/aviso', params: params.club ? { club: params.club } : {} })} style={{ marginBottom: 14 }} />
      ) : null}
      {notices.length === 0 ? <EmptyState icon="megaphone-outline" text="No hay avisos." /> : null}
      {notices.map((n) => (
        <NoticeRow
          key={n.id}
          notice={n}
          db={db}
          onDelete={
            n.clubIds.every((c) => can(me, 'manage_notices', c))
              ? () => confirmAction('Eliminar aviso', `¿Eliminar "${n.title}"?`, () => handleResult(perform({ type: 'deleteNotice', id: n.id }), '', false), 'Eliminar')
              : undefined
          }
        />
      ))}
    </Screen>
  );
}
