import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useData, useMe } from '../../data/DataContext';
import { clubsWith } from '../../data/permissions';
import { submissionsToReview, tasksAssignedTo } from '../../data/selectors';
import { TabHeader } from '../../components/Header';
import { WeekStrip } from '../../components/Calendars';
import { TaskRow } from '../../components/Items';
import { Button, EmptyState, Screen } from '../../components/ui';
import { colors, radius } from '../../theme';
import { addDays, formatLong, sameDay, toISO } from '../../utils/dates';

export default function Tasks() {
  const { db } = useData();
  const me = useMe();
  const [tab, setTab] = useState<'pendientes' | 'hechas'>('pendientes');
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const all = tasksAssignedTo(db, me.id);
  const pending = all.filter((t) => t.assignments[me.id].status !== 'hecha');
  const done = all.filter((t) => t.assignments[me.id].status === 'hecha');

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of pending) c[t.dueDate] = (c[t.dueDate] ?? 0) + 1;
    return c;
  }, [pending]);

  const base = tab === 'pendientes' ? pending : done;
  const list = selectedDay ? base.filter((t) => t.dueDate === toISO(selectedDay)) : base;

  const canAssign = clubsWith(me, 'assign_tasks').length > 0;
  const toReview = submissionsToReview(db, me).length;

  return (
    <Screen header={<TabHeader title="Tareas" subtitle="Tu semana" />}>
      <WeekStrip
        anchor={anchor}
        selected={selectedDay}
        counts={counts}
        onPrev={() => setAnchor(addDays(anchor, -7))}
        onNext={() => setAnchor(addDays(anchor, 7))}
        onSelect={(d) => setSelectedDay(selectedDay && sameDay(selectedDay, d) ? null : d)}
      />

      <View style={styles.toggleRow}>
        <Pressable style={[styles.toggle, tab === 'pendientes' && styles.toggleActive]} onPress={() => setTab('pendientes')}>
          <Ionicons name="time-outline" size={20} color={tab === 'pendientes' ? colors.white : colors.warning} />
          <Text style={[styles.toggleText, tab === 'pendientes' && { color: colors.white }]}>Pendientes</Text>
          <View style={[styles.count, tab === 'pendientes' && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={[styles.countText, tab === 'pendientes' && { color: colors.white }]}>{pending.length}</Text>
          </View>
        </Pressable>
        <Pressable style={[styles.toggle, tab === 'hechas' && styles.toggleActiveDone]} onPress={() => setTab('hechas')}>
          <Ionicons name="checkmark-circle-outline" size={20} color={tab === 'hechas' ? colors.white : colors.success} />
          <Text style={[styles.toggleText, tab === 'hechas' && { color: colors.white }]}>Hechas</Text>
          <View style={[styles.count, tab === 'hechas' && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={[styles.countText, tab === 'hechas' && { color: colors.white }]}>{done.length}</Text>
          </View>
        </Pressable>
      </View>

      {canAssign ? (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <Button title="Asignar tarea" icon="add" small onPress={() => router.push('/crear/tarea')} style={{ flex: 1 }} />
          <Button title={`Por revisar (${toReview})`} icon="checkmark-done" variant="secondary" small onPress={() => router.push('/revisar')} style={{ flex: 1 }} />
        </View>
      ) : null}

      {selectedDay ? (
        <Pressable onPress={() => setSelectedDay(null)} style={styles.filter}>
          <Text style={styles.filterText}>Entregas del {formatLong(toISO(selectedDay))}</Text>
          <Ionicons name="close-circle" size={18} color={colors.primary} />
        </Pressable>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          icon={tab === 'pendientes' ? 'happy-outline' : 'clipboard-outline'}
          text={tab === 'pendientes' ? 'No tienes tareas pendientes.' : 'Aún no tienes tareas completadas.'}
        />
      ) : (
        list.map((t) => <TaskRow key={t.id} task={t} assignment={t.assignments[me.id]} db={db} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', gap: 10, marginVertical: 14 },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleActive: { backgroundColor: colors.warning, borderColor: colors.warning },
  toggleActiveDone: { backgroundColor: colors.success, borderColor: colors.success },
  toggleText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  count: { minWidth: 28, paddingHorizontal: 6, height: 24, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  countText: { fontWeight: '800', color: colors.text },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 10 },
  filterText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
