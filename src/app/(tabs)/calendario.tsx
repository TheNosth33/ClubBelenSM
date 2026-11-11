import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useData, useMe } from '../../data/DataContext';
import { clubsWith } from '../../data/permissions';
import { activitiesFor, visibleClubs } from '../../data/selectors';
import { TabHeader } from '../../components/Header';
import { MonthCalendar } from '../../components/Calendars';
import { ActivityRow } from '../../components/Items';
import { Button, Chip, EmptyState, Screen, Segmented } from '../../components/ui';
import { colors } from '../../theme';
import { MONTHS, MONTHS_SHORT, addDays, addMonths, capitalize, formatLong, sameDay, toISO } from '../../utils/dates';
import { ClubId } from '../../data/types';

export default function CalendarScreen() {
  const { db } = useData();
  const me = useMe();
  const now = new Date();
  // 2 meses pasados, mes actual y 3 meses próximos
  const months = Array.from({ length: 6 }, (_, i) => addMonths(now.getFullYear(), now.getMonth(), i - 2));
  const [sel, setSel] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [mode, setMode] = useState<'mes' | 'semana'>('mes');
  const [day, setDay] = useState<Date>(now);
  const [dayFilter, setDayFilter] = useState(false);
  const myClubs = visibleClubs(me);
  const [clubFilter, setClubFilter] = useState<ClubId | 'todos'>('todos');

  const clubs = useMemo(() => (clubFilter === 'todos' ? myClubs : [clubFilter]), [clubFilter, myClubs]);
  const activities = useMemo(() => activitiesFor(db, clubs), [db, clubs]);

  const marks = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const a of activities) {
      const c = a.cancelled ? colors.textMuted : db.clubs[a.clubIds.find((x) => clubs.includes(x)) ?? a.clubIds[0]].color;
      (m[a.date] ??= []).push(c);
    }
    return m;
  }, [activities, db.clubs, clubs]);

  const monthPrefix = `${sel.year}-${String(sel.month + 1).padStart(2, '0')}`;
  const monthActivities = activities.filter((a) => a.date.startsWith(monthPrefix));
  const shown = dayFilter ? monthActivities.filter((a) => a.date === toISO(day)) : monthActivities;

  const selectMonth = (m: { year: number; month: number }) => {
    setSel(m);
    const isCurrent = m.year === now.getFullYear() && m.month === now.getMonth();
    setDay(isCurrent ? now : new Date(m.year, m.month, 1));
    setDayFilter(false);
  };

  const moveWeek = (n: number) => {
    const d = addDays(day, n * 7);
    setDay(d);
    setSel({ year: d.getFullYear(), month: d.getMonth() });
    setDayFilter(false);
  };

  const canCreate = clubsWith(me, 'manage_activities').length > 0;

  return (
    <Screen header={<TabHeader title="Calendario" subtitle="Actividades del club" />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {months.map((m) => {
          const active = m.year === sel.year && m.month === sel.month;
          return (
            <Chip
              key={`${m.year}-${m.month}`}
              label={`${MONTHS_SHORT[m.month]}${m.year !== now.getFullYear() ? ` ${String(m.year).slice(2)}` : ''}`}
              selected={active}
              onPress={() => selectMonth(m)}
            />
          );
        })}
      </ScrollView>

      {myClubs.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10 }}>
          <Chip label="Todos" selected={clubFilter === 'todos'} onPress={() => setClubFilter('todos')} color={colors.text} />
          {myClubs.map((c) => (
            <Chip key={c} label={db.clubs[c].name} selected={clubFilter === c} onPress={() => setClubFilter(c)} color={db.clubs[c].color} />
          ))}
        </ScrollView>
      ) : null}

      <View style={{ marginVertical: 12 }}>
        <Segmented
          options={[
            { value: 'mes', label: 'Mes completo' },
            { value: 'semana', label: 'Semana' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </View>

      <MonthCalendar
        year={sel.year}
        month={sel.month}
        mode={mode}
        selected={day}
        marks={marks}
        onPrevWeek={() => moveWeek(-1)}
        onNextWeek={() => moveWeek(1)}
        onSelect={(d) => {
          if (sameDay(d, day)) setDayFilter(!dayFilter);
          else {
            setDay(d);
            setDayFilter(true);
            if (d.getMonth() !== sel.month) setSel({ year: d.getFullYear(), month: d.getMonth() });
          }
        }}
      />

      <View style={styles.listHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.listTitle}>
            {dayFilter ? capitalize(formatLong(toISO(day))) : `${MONTHS[sel.month]} ${sel.year}`}
          </Text>
          <Text style={styles.listSub}>
            {shown.length} actividad{shown.length === 1 ? '' : 'es'}
            {dayFilter ? ' · toca de nuevo el día para ver todo el mes' : ''}
          </Text>
        </View>
        {canCreate ? <Button title="Nueva" icon="add" small onPress={() => router.push({ pathname: '/crear/actividad', params: { date: toISO(day) } })} /> : null}
      </View>

      {shown.length === 0 ? (
        <EmptyState icon="calendar-clear-outline" text={dayFilter ? 'No hay actividades este día.' : 'No hay actividades este mes.'} />
      ) : (
        shown.map((a) => <ActivityRow key={a.id} activity={a} db={db} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 10 },
  listTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  listSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
