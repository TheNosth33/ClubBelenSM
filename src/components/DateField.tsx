import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { formatLong, formatTime, isValidISODate, isValidTime, parseISO, toISO } from '../utils/dates';
import { Button, Field, Label, styles as ui } from './ui';

/** Campo de fecha ('AAAA-MM-DD') u hora ('HH:MM') con el selector nativo del teléfono. */
export function DateField({
  label,
  value,
  onChange,
  mode = 'date',
  error,
  maximumDate,
  minimumDate,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mode?: 'date' | 'time';
  error?: string | null;
  maximumDate?: Date;
  minimumDate?: Date;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<Date>(new Date());

  // En la versión web se escribe a mano.
  if (Platform.OS === 'web') {
    return (
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={mode === 'date' ? 'AAAA-MM-DD' : 'HH:MM'}
        error={error ?? (value && !(mode === 'date' ? isValidISODate(value) : isValidTime(value)) ? 'Formato no válido' : null)}
      />
    );
  }

  const current = (): Date => {
    if (mode === 'date') return value && isValidISODate(value) ? parseISO(value) : new Date(2015, 0, 1);
    const d = new Date();
    if (value && isValidTime(value)) {
      const [h, m] = value.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    }
    return d;
  };

  const commit = (d: Date) => {
    if (mode === 'date') onChange(toISO(d));
    else onChange(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  };

  const display = value ? (mode === 'date' ? formatLong(value, true) : formatTime(value)) : placeholder ?? (mode === 'date' ? 'Elegir fecha' : 'Elegir hora');

  return (
    <View style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      <Pressable
        style={[ui.input, s.trigger, error ? { borderColor: colors.danger } : null]}
        onPress={() => {
          setTemp(current());
          setOpen(true);
        }}
      >
        <Text style={{ fontSize: 16, color: value ? colors.text : colors.textMuted }}>{display}</Text>
        <Ionicons name={mode === 'date' ? 'calendar-outline' : 'time-outline'} size={20} color={colors.textMuted} />
      </Pressable>
      {error ? <Text style={ui.error}>{error}</Text> : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={temp}
          mode={mode}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onValueChange={(_, d) => {
            setOpen(false);
            commit(d);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
          <View style={s.sheet}>
            <DateTimePicker
              value={temp}
              mode={mode}
              display="spinner"
              locale="es-SV"
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              onValueChange={(_, d) => setTemp(d)}
            />
            <Button
              title="Listo"
              onPress={() => {
                commit(temp);
                setOpen(false);
              }}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: colors.card, padding: 16, paddingBottom: 36, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
});
