import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useData, useMe } from '../../data/DataContext';
import { clubsWith } from '../../data/permissions';
import { membersOf } from '../../data/engine';
import { Assignment, ClubId } from '../../data/types';
import { DateField } from '../../components/DateField';
import { MemberRow } from '../../components/Items';
import { Button, Card, Chip, Field, Label, Screen, styles as ui } from '../../components/ui';
import { addDays, isValidISODate, toISO } from '../../utils/dates';
import { handleResult } from '../../utils/alerts';
import { colors } from '../../theme';

export default function TaskForm() {
  const params = useLocalSearchParams<{ club?: ClubId }>();
  const { db, perform } = useData();
  const me = useMe();
  const allowed = clubsWith(me, 'assign_tasks');
  const [clubId, setClubId] = useState<ClubId | undefined>(params.club && allowed.includes(params.club) ? params.club : allowed[0]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(toISO(addDays(new Date(), 7)));
  const [selected, setSelected] = useState<string[]>([]);
  const [tried, setTried] = useState(false);

  const members = clubId ? membersOf(db, [clubId]).filter((u) => u.id !== me.id).sort((a, b) => a.fullName.localeCompare(b.fullName)) : [];
  const allSelected = members.length > 0 && members.every((m) => selected.includes(m.id));

  const errors = {
    title: !title.trim() ? 'Escribe el nombre de la tarea.' : null,
    dueDate: !isValidISODate(dueDate) ? 'Elige la fecha de entrega.' : null,
    members: selected.length === 0 ? 'Elige al menos un miembro.' : null,
  };

  const save = () => {
    setTried(true);
    if (!clubId || Object.values(errors).some(Boolean)) return;
    const assignments: Record<string, Assignment> = Object.fromEntries(selected.map((id) => [id, { status: 'pendiente', seen: false }]));
    handleResult(perform({ type: 'createTask', data: { clubId, title: title.trim(), description: description.trim(), dueDate, assignments } }), 'Tarea asignada');
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ height: 12 }} />
      {allowed.length > 1 ? (
        <>
          <Label>Club</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {allowed.map((c) => (
              <Chip
                key={c}
                label={db.clubs[c].name}
                color={db.clubs[c].color}
                selected={clubId === c}
                onPress={() => {
                  setClubId(c);
                  setSelected([]);
                }}
              />
            ))}
          </View>
        </>
      ) : null}
      <Field label="Tarea" value={title} onChangeText={setTitle} placeholder="Ej. Aprender 5 nudos" error={tried ? errors.title : null} />
      <Field label="Instrucciones" value={description} onChangeText={setDescription} multiline />
      <DateField label="Fecha de entrega" value={dueDate} onChange={setDueDate} error={tried ? errors.dueDate : null} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label>Asignar a ({selected.length})</Label>
        <Text
          style={{ color: colors.primary, fontWeight: '700', marginBottom: 6 }}
          onPress={() => setSelected(allSelected ? [] : members.map((m) => m.id))}
        >
          {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
        </Text>
      </View>
      <Card style={{ paddingVertical: 4 }}>
        {members.map((m) => {
          const on = selected.includes(m.id);
          return (
            <MemberRow
              key={m.id}
              user={m}
              onPress={() => setSelected(on ? selected.filter((x) => x !== m.id) : [...selected, m.id])}
              right={<Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? colors.primary : colors.textMuted} />}
            />
          );
        })}
      </Card>
      {tried && errors.members ? <Text style={ui.error}>{errors.members}</Text> : null}
      <Button title="Asignar tarea" icon="send" onPress={save} style={{ marginTop: 16 }} />
    </Screen>
  );
}
