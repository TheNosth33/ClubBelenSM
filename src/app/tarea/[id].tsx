import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useData, useMe } from '../../data/DataContext';
import { can } from '../../data/permissions';
import { userById } from '../../data/selectors';
import { MemberRow, statusInfo } from '../../components/Items';
import { Button, Card, EmptyState, Screen, SectionTitle, Tag } from '../../components/ui';
import { colors } from '../../theme';
import { formatLong, timeAgo } from '../../utils/dates';
import { confirmAction, handleResult } from '../../utils/alerts';

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, submitTask, markTaskSeen, perform } = useData();
  const me = useMe();
  const task = db.tasks.find((t) => t.id === id);
  const mine = task?.assignments[me.id];

  useEffect(() => {
    if (task && mine && !mine.seen) markTaskSeen(task.id);
  }, [task, mine, markTaskSeen]);

  if (!task) return <Screen edges={['bottom']}><EmptyState text="Esta tarea ya no existe." /></Screen>;

  const club = db.clubs[task.clubId];
  const author = userById(db, task.createdBy);
  const canReview = can(me, 'review_tasks', task.clubId) || task.createdBy === me.id;
  const canDelete = can(me, 'assign_tasks', task.clubId);
  const entries = Object.entries(task.assignments)
    .map(([uid, a]) => ({ user: userById(db, uid), a }))
    .filter((e) => e.user)
    .sort((x, y) => ['en_revision', 'pendiente', 'hecha'].indexOf(x.a.status) - ['en_revision', 'pendiente', 'hecha'].indexOf(y.a.status));
  const doneCount = entries.filter((e) => e.a.status === 'hecha').length;

  const review = (userId: string, status: 'hecha' | 'pendiente') => {
    const res = perform({ type: 'reviewTask', taskId: task.id, userId, status });
    handleResult(res, '', false);
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: club.name }} />
      <Card style={{ marginTop: 10, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Tag label={club.name} color={club.color} />
          {mine ? <Tag label={statusInfo(mine.status).label} color={statusInfo(mine.status).color} /> : null}
        </View>
        <Text style={styles.title}>{task.title}</Text>
        <Text style={styles.desc}>{task.description || 'Sin descripción.'}</Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>📅 Entrega: {formatLong(task.dueDate, true)}</Text>
          <Text style={styles.metaText}>👤 Asignada por {author?.fullName ?? '—'} · {timeAgo(task.createdAt)}</Text>
        </View>
      </Card>

      {mine ? (
        <View style={{ marginTop: 16 }}>
          {mine.status === 'pendiente' ? (
            <>
              <Button title="Marcar como hecha" icon="checkmark-circle-outline" variant="success" onPress={() => submitTask(task.id)} />
              <Text style={styles.hint}>Tu entrega será revisada por un consejero, instructor o director antes de marcarse como hecha.</Text>
            </>
          ) : mine.status === 'en_revision' ? (
            <Card style={{ backgroundColor: colors.primarySoft }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>⏳ Entregada — esperando aprobación</Text>
              <Text style={styles.hint}>Te avisaremos cuando sea revisada.</Text>
            </Card>
          ) : (
            <Card style={{ backgroundColor: colors.successSoft }}>
              <Text style={{ color: colors.success, fontWeight: '700' }}>✅ ¡Tarea completada y aprobada!</Text>
            </Card>
          )}
        </View>
      ) : null}

      {canReview ? (
        <>
          <SectionTitle title={`Miembros asignados (${doneCount}/${entries.length} hechas)`} />
          <Card style={{ paddingVertical: 4 }}>
            {entries.map(({ user, a }) => (
              <View key={user!.id} style={styles.reviewRow}>
                <MemberRow
                  user={user!}
                  right={<Tag label={statusInfo(a.status).label} color={statusInfo(a.status).color} />}
                />
                {user!.id !== me.id ? (
                  <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 10 }}>
                    {a.status !== 'hecha' ? (
                      <Button title="Marcar hecha" icon="checkmark" variant="success" small onPress={() => review(user!.id, 'hecha')} style={{ flex: 1 }} />
                    ) : null}
                    {a.status !== 'pendiente' ? (
                      <Button title="Marcar pendiente" icon="arrow-undo" variant="ghost" small onPress={() => review(user!.id, 'pendiente')} style={{ flex: 1 }} />
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {canDelete ? (
        <Button
          title="Eliminar tarea"
          variant="ghost"
          icon="trash-outline"
          style={{ marginTop: 20 }}
          onPress={() =>
            confirmAction('Eliminar tarea', '¿Seguro que quieres eliminar esta tarea para todos los miembros?', () => {
              handleResult(perform({ type: 'deleteTask', id: task.id }), '');
            }, 'Eliminar')
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  desc: { fontSize: 15, color: colors.text, lineHeight: 22 },
  meta: { gap: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  metaText: { fontSize: 13, color: colors.textMuted },
  hint: { fontSize: 13, color: colors.textMuted, marginTop: 8, textAlign: 'center' },
  reviewRow: { borderBottomWidth: 1, borderBottomColor: colors.border },
});
