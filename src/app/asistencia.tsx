import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useData, useMe } from '../data/DataContext';
import { clubsWith } from '../data/permissions';
import { membersOf } from '../data/engine';
import { ClubId } from '../data/types';
import { DateField } from '../components/DateField';
import { MemberRow } from '../components/Items';
import { Button, Card, Chip, Field, Label, Screen } from '../components/ui';
import { colors } from '../theme';
import { isValidISODate, todayISO } from '../utils/dates';
import { handleResult } from '../utils/alerts';

export default function Attendance() {
  const params = useLocalSearchParams<{ club?: ClubId }>();
  const { db, perform } = useData();
  const me = useMe();
  const allowed = clubsWith(me, 'record_attendance');
  const [clubId, setClubId] = useState<ClubId>(params.club && allowed.includes(params.club) ? params.club : allowed[0]);
  const [date, setDate] = useState(todayISO());
  // Cambios hechos en pantalla por club y fecha; si no hay, se usa lo ya registrado.
  const [drafts, setDrafts] = useState<Record<string, { present: string[]; title: string }>>({});

  const members = membersOf(db, [clubId]).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const existing = db.meetings.find((m) => m.clubId === clubId && m.date === date);

  // Si ya hay registro para ese día, se carga para poder corregirlo.
  const key = `${clubId}|${date}`;
  const draft = drafts[key] ?? { present: existing?.presentIds ?? [], title: existing?.title ?? 'Reunión regular' };
  const present = draft.present;
  const title = draft.title;
  const setPresent = (p: string[]) => setDrafts({ ...drafts, [key]: { ...draft, present: p } });
  const setTitle = (t: string) => setDrafts({ ...drafts, [key]: { ...draft, title: t } });

  const save = () => {
    if (!isValidISODate(date)) return;
    const ids = members.map((m) => m.id);
    handleResult(
      perform({
        type: 'recordMeeting',
        data: { clubId, date, title: title.trim() || 'Reunión', presentIds: present.filter((p) => ids.includes(p)), absentIds: ids.filter((id) => !present.includes(id)) },
      }),
      'Asistencia guardada',
    );
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ height: 12 }} />
      {allowed.length > 1 ? (
        <>
          <Label>Club</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {allowed.map((c) => (
              <Chip key={c} label={db.clubs[c].name} color={db.clubs[c].color} selected={c === clubId} onPress={() => setClubId(c)} />
            ))}
          </View>
        </>
      ) : null}
      <DateField label="Fecha de la reunión" value={date} onChange={setDate} maximumDate={new Date()} />
      <Field label="Nombre" value={title} onChangeText={setTitle} />
      {existing ? <Text style={{ color: colors.warning, marginBottom: 10 }}>Ya existe un registro para esta fecha. Al guardar se actualizará.</Text> : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Label>
          Presentes: {present.length}/{members.length}
        </Label>
        <Text style={{ color: colors.primary, fontWeight: '700', marginBottom: 6 }} onPress={() => setPresent(present.length === members.length ? [] : members.map((m) => m.id))}>
          {present.length === members.length ? 'Quitar todos' : 'Todos presentes'}
        </Text>
      </View>
      <Card style={{ paddingVertical: 4 }}>
        {members.map((m) => {
          const on = present.includes(m.id);
          return (
            <MemberRow
              key={m.id}
              user={m}
              onPress={() => setPresent(on ? present.filter((x) => x !== m.id) : [...present, m.id])}
              right={<Ionicons name={on ? 'checkmark-circle' : 'close-circle-outline'} size={28} color={on ? colors.success : colors.danger} />}
            />
          );
        })}
      </Card>
      <Button title="Guardar asistencia" icon="checkmark" onPress={save} style={{ marginTop: 16 }} />
    </Screen>
  );
}
