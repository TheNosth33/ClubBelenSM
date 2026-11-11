import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { DAYS_LETTER, DAYS_SHORT, MONTHS, monthWeeks, sameDay, toISO, weekDays } from '../utils/dates';

/**
 * Calendario de mes o de semana (las semanas empiezan en domingo).
 * `marks` indica los colores de los puntos de cada día ('AAAA-MM-DD' -> colores).
 */
export function MonthCalendar({
  year,
  month,
  mode,
  selected,
  onSelect,
  marks,
  onPrevWeek,
  onNextWeek,
}: {
  year: number;
  month: number;
  mode: 'mes' | 'semana';
  selected: Date;
  onSelect: (d: Date) => void;
  marks: Record<string, string[]>;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
}) {
  const today = new Date();
  const weeks = mode === 'mes' ? monthWeeks(year, month) : [weekDays(selected)];
  return (
    <View style={styles.cal}>
      <View style={styles.calHeader}>
        {mode === 'semana' && onPrevWeek ? (
          <Pressable onPress={onPrevWeek} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 20 }} />
        )}
        <Text style={styles.calTitle}>
          {MONTHS[month]} {year}
        </Text>
        {mode === 'semana' && onNextWeek ? (
          <Pressable onPress={onNextWeek} hitSlop={10}>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 20 }} />
        )}
      </View>
      <View style={styles.row}>
        {DAYS_LETTER.map((l, i) => (
          <Text key={i} style={styles.dow}>
            {l}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((day) => {
            const iso = toISO(day);
            const inMonth = day.getMonth() === month;
            const isSel = sameDay(day, selected);
            const isToday = sameDay(day, today);
            const dots = marks[iso] ?? [];
            return (
              <Pressable key={iso} style={styles.cell} onPress={() => onSelect(day)}>
                <View style={[styles.dayCircle, isToday && !isSel && styles.today, isSel && styles.selected]}>
                  <Text style={[styles.dayText, !inMonth && mode === 'mes' && { color: colors.border }, isSel && { color: colors.white, fontWeight: '800' }]}>
                    {day.getDate()}
                  </Text>
                </View>
                <View style={styles.dots}>
                  {dots.slice(0, 3).map((c, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: c }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Tira semanal de 7 días (de domingo a sábado) para la pantalla de Tareas. */
export function WeekStrip({
  anchor,
  selected,
  onSelect,
  onPrev,
  onNext,
  counts,
}: {
  anchor: Date;
  selected: Date | null;
  onSelect: (d: Date) => void;
  onPrev: () => void;
  onNext: () => void;
  counts: Record<string, number>;
}) {
  const days = weekDays(anchor);
  const today = new Date();
  const first = days[0];
  const last = days[6];
  const label =
    first.getMonth() === last.getMonth()
      ? `${first.getDate()} – ${last.getDate()} de ${MONTHS[first.getMonth()]}`
      : `${first.getDate()} ${MONTHS[first.getMonth()].slice(0, 3)} – ${last.getDate()} ${MONTHS[last.getMonth()].slice(0, 3)}`;
  return (
    <View style={styles.cal}>
      <View style={styles.calHeader}>
        <Pressable onPress={onPrev} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </Pressable>
        <Text style={styles.calTitle}>{label}</Text>
        <Pressable onPress={onNext} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {days.map((d) => {
          const iso = toISO(d);
          const isSel = selected ? sameDay(d, selected) : false;
          const isToday = sameDay(d, today);
          const n = counts[iso] ?? 0;
          return (
            <Pressable key={iso} onPress={() => onSelect(d)} style={[styles.weekPill, isToday && styles.weekPillToday, isSel && styles.weekPillSel]}>
              <Text style={[styles.weekDow, isSel && { color: colors.white }]}>{DAYS_SHORT[d.getDay()]}</Text>
              <Text style={[styles.weekNum, isSel && { color: colors.white }]}>{d.getDate()}</Text>
              <View style={[styles.dot, { backgroundColor: n > 0 ? (isSel ? colors.accent : colors.primary) : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cal: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.border },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 10 },
  calTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  dow: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 2, borderColor: colors.primary },
  selected: { backgroundColor: colors.primary },
  dayText: { fontSize: 15, color: colors.text, fontWeight: '500' },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  weekPill: { flex: 1, marginHorizontal: 2, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, gap: 4 },
  weekPillToday: { backgroundColor: colors.primarySoft },
  weekPillSel: { backgroundColor: colors.primary },
  weekDow: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  weekNum: { fontSize: 17, color: colors.text, fontWeight: '800' },
});
