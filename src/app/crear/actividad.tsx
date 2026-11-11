import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useData, useMe } from '../../data/DataContext';
import { clubsWith } from '../../data/permissions';
import { ClubId } from '../../data/types';
import { DateField } from '../../components/DateField';
import { Button, Chip, Field, Label, Screen, ToggleRow, styles as ui } from '../../components/ui';
import { isValidISODate, isValidTime, todayISO } from '../../utils/dates';
import { handleResult } from '../../utils/alerts';

export default function ActivityForm() {
  const params = useLocalSearchParams<{ id?: string; club?: ClubId; date?: string }>();
  const { db, perform } = useData();
  const me = useMe();
  const existing = params.id ? db.activities.find((a) => a.id === params.id) : undefined;
  const allowed = clubsWith(me, 'manage_activities');

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [date, setDate] = useState(existing?.date ?? (params.date && params.date >= todayISO() ? params.date : todayISO()));
  const [startTime, setStartTime] = useState(existing?.startTime ?? '08:00');
  const [endTime, setEndTime] = useState(existing?.endTime ?? '');
  const [location, setLocation] = useState(existing?.location ?? 'Iglesia Belén SM');
  const [clubIds, setClubIds] = useState<ClubId[]>(existing?.clubIds ?? (params.club && allowed.includes(params.club) ? [params.club] : allowed.slice(0, 1)));
  const [notify, setNotify] = useState(true);
  const [tried, setTried] = useState(false);

  const errors = {
    title: !title.trim() ? 'Escribe el nombre de la actividad.' : null,
    date: !isValidISODate(date) ? 'Elige una fecha.' : null,
    startTime: !isValidTime(startTime) ? 'Elige la hora de inicio.' : null,
    endTime: endTime && (!isValidTime(endTime) || endTime <= startTime) ? 'La hora de fin debe ser después del inicio.' : null,
    location: !location.trim() ? 'Escribe el lugar.' : null,
    clubs: clubIds.length === 0 ? 'Elige al menos un club.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  const save = () => {
    setTried(true);
    if (!valid) return;
    const data = { title: title.trim(), description: description.trim(), date, startTime, endTime: endTime || undefined, location: location.trim(), clubIds };
    if (existing) {
      const res = perform({ type: 'updateActivity', id: existing.id, data, notify });
      handleResult(res, notify ? 'Actividad actualizada y aviso enviado' : 'Actividad actualizada');
    } else {
      handleResult(perform({ type: 'createActivity', data }), 'Actividad creada');
    }
  };

  const toggleClub = (c: ClubId) => setClubIds(clubIds.includes(c) ? clubIds.filter((x) => x !== c) : [...clubIds, c]);

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: existing ? 'Editar actividad' : 'Nueva actividad' }} />
      <View style={{ height: 12 }} />
      <Field label="Nombre" value={title} onChangeText={setTitle} placeholder="Ej. Caminata ecológica" error={tried ? errors.title : null} />
      <Label>Club(es)</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        {allowed.map((c) => (
          <Chip key={c} label={db.clubs[c].name} selected={clubIds.includes(c)} onPress={() => toggleClub(c)} color={db.clubs[c].color} />
        ))}
      </View>
      {tried && errors.clubs ? <Text style={ui.error}>{errors.clubs}</Text> : null}
      <View style={{ height: 14 }} />
      <DateField label="Fecha" value={date} onChange={setDate} error={tried ? errors.date : null} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <DateField label="Hora inicio" mode="time" value={startTime} onChange={setStartTime} error={tried ? errors.startTime : null} />
        </View>
        <View style={{ flex: 1 }}>
          <DateField label="Hora fin (opcional)" mode="time" value={endTime} onChange={setEndTime} error={tried ? errors.endTime : null} placeholder="—" />
        </View>
      </View>
      <Field label="Lugar" value={location} onChangeText={setLocation} error={tried ? errors.location : null} />
      <Field label="Descripción" value={description} onChangeText={setDescription} multiline placeholder="Qué traer, uniforme, detalles…" />
      {existing ? (
        <ToggleRow
          label="Avisar el cambio a los miembros"
          description="Publica un aviso de último momento y envía una notificación."
          value={notify}
          onChange={setNotify}
        />
      ) : null}
      <Button title={existing ? 'Guardar cambios' : 'Crear actividad'} icon="checkmark" onPress={save} style={{ marginTop: 10 }} />
    </Screen>
  );
}
