import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useData, useMe } from '../../data/DataContext';
import { canPerform } from '../../data/permissions';
import { noticesFor, userById } from '../../data/selectors';
import { Cover } from '../../components/ClubVisuals';
import { NoticeRow } from '../../components/Items';
import { Button, EmptyState, Screen, SectionTitle, Tag } from '../../components/ui';
import { colors, radius, shadow } from '../../theme';
import { formatLong, formatTime } from '../../utils/dates';
import { confirmAction, handleResult } from '../../utils/alerts';

function InfoRow({ icon, text, color }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; color: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

export default function ActivityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, perform } = useData();
  const me = useMe();
  const a = db.activities.find((x) => x.id === id);
  if (!a) return <Screen edges={['bottom']}><EmptyState text="Esta actividad ya no existe." /></Screen>;

  const color = db.clubs[a.clubIds[0]].color;
  const canEdit = canPerform(db, me, { type: 'deleteActivity', id: a.id });
  const related = noticesFor(db, a.clubIds).filter((n) => n.activityId === a.id);
  const author = userById(db, a.createdBy);

  return (
    <Screen edges={['bottom']} padded={false}>
      <Cover color={color} height={120} style={{ justifyContent: 'flex-end' }}>
        <View style={{ padding: 16, flexDirection: 'row', gap: 6, flexWrap: 'wrap', position: 'absolute', bottom: 0 }}>
          {a.clubIds.map((c) => (
            <Tag key={c} label={db.clubs[c].name} color={colors.white} bg="rgba(255,255,255,0.2)" />
          ))}
        </View>
      </Cover>
      <View style={{ paddingHorizontal: 16 }}>
        <View style={styles.card}>
          {a.cancelled ? <Tag label="ACTIVIDAD CANCELADA" color={colors.white} bg={colors.danger} /> : null}
          <Text style={[styles.title, a.cancelled && { textDecorationLine: 'line-through' }]}>{a.title}</Text>
          <InfoRow color={color} icon="calendar-outline" text={formatLong(a.date, true)} />
          <InfoRow color={color} icon="time-outline" text={`${formatTime(a.startTime)}${a.endTime ? ` – ${formatTime(a.endTime)}` : ''}`} />
          <InfoRow color={color} icon="location-outline" text={a.location} />
          {a.description ? <Text style={styles.desc}>{a.description}</Text> : null}
          <Text style={styles.meta}>
            Publicada por {author?.fullName ?? '—'}
            {a.updatedAt ? ' · modificada' : ''}
          </Text>
        </View>

        {related.length > 0 ? (
          <>
            <SectionTitle title="Cambios y avisos" />
            {related.map((n) => (
              <NoticeRow key={n.id} notice={n} db={db} />
            ))}
          </>
        ) : null}

        {canEdit ? (
          <View style={{ gap: 10, marginTop: 20 }}>
            <Button title="Editar actividad" icon="create-outline" onPress={() => router.push({ pathname: '/crear/actividad', params: { id: a.id } })} />
            <Button
              title={a.cancelled ? 'Reactivar actividad' : 'Cancelar actividad'}
              icon={a.cancelled ? 'refresh' : 'close-circle-outline'}
              variant="ghost"
              onPress={() =>
                confirmAction(
                  a.cancelled ? 'Reactivar actividad' : 'Cancelar actividad',
                  'Se enviará un aviso de último momento a todos los miembros.',
                  () => handleResult(perform({ type: 'updateActivity', id: a.id, data: { cancelled: !a.cancelled }, notify: true }), 'Aviso enviado a los miembros', false),
                )
              }
            />
            <Button
              title="Eliminar"
              icon="trash-outline"
              variant="ghost"
              onPress={() =>
                confirmAction('Eliminar actividad', '¿Seguro? Esta acción no se puede deshacer.', () => {
                  handleResult(perform({ type: 'deleteActivity', id: a.id }), 'Actividad eliminada');
                }, 'Eliminar')
              }
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, marginTop: -30, gap: 12, ...shadow },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { fontSize: 15, color: colors.text, flex: 1, textTransform: 'none' },
  desc: { fontSize: 15, color: colors.text, lineHeight: 22, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  meta: { fontSize: 12, color: colors.textMuted },
});
