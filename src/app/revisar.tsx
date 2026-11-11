import React from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useData, useMe } from '../data/DataContext';
import { submissionsToReview, userById } from '../data/selectors';
import { MemberRow } from '../components/Items';
import { Button, Card, EmptyState, Screen } from '../components/ui';
import { colors } from '../theme';
import { timeAgo } from '../utils/dates';
import { handleResult } from '../utils/alerts';

/** Entregas de miembros que esperan ser marcadas como hechas o devueltas a pendiente. */
export default function Review() {
  const { db, perform } = useData();
  const me = useMe();
  const items = submissionsToReview(db, me);

  return (
    <Screen edges={['bottom']}>
      <View style={{ height: 12 }} />
      {items.length === 0 ? <EmptyState icon="checkmark-done-circle-outline" text="No hay entregas por revisar." /> : null}
      {items.map(({ task, userId }) => {
        const u = userById(db, userId);
        if (!u) return null;
        const a = task.assignments[userId];
        return (
          <Card key={task.id + userId} style={{ marginBottom: 12, gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }} onPress={() => router.push(`/tarea/${task.id}`)}>
              {task.title}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              {db.clubs[task.clubId].name} · entregada {a.submittedAt ? timeAgo(a.submittedAt) : ''}
            </Text>
            <MemberRow user={u} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Hecha" icon="checkmark" variant="success" small style={{ flex: 1 }} onPress={() => handleResult(perform({ type: 'reviewTask', taskId: task.id, userId, status: 'hecha' }), '', false)} />
              <Button title="Devolver a pendiente" icon="arrow-undo" variant="ghost" small style={{ flex: 1 }} onPress={() => handleResult(perform({ type: 'reviewTask', taskId: task.id, userId, status: 'pendiente' }), '', false)} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
