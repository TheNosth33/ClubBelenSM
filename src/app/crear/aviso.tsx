import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useData, useMe } from '../../data/DataContext';
import { clubsWith } from '../../data/permissions';
import { ClubId } from '../../data/types';
import { Button, Chip, Field, Label, Screen, ToggleRow, styles as ui } from '../../components/ui';
import { handleResult } from '../../utils/alerts';

export default function NoticeForm() {
  const params = useLocalSearchParams<{ club?: ClubId }>();
  const { db, perform } = useData();
  const me = useMe();
  const allowed = clubsWith(me, 'manage_notices');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [clubIds, setClubIds] = useState<ClubId[]>(params.club && allowed.includes(params.club) ? [params.club] : allowed.slice(0, 1));
  const [tried, setTried] = useState(false);

  const errors = {
    title: !title.trim() ? 'Escribe un título.' : null,
    body: !body.trim() ? 'Escribe el mensaje.' : null,
    clubs: clubIds.length === 0 ? 'Elige al menos un club.' : null,
  };

  const save = () => {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    handleResult(perform({ type: 'createNotice', data: { title: title.trim(), body: body.trim(), urgent, clubIds } }), 'Aviso publicado');
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ height: 12 }} />
      <Label>Para</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {allowed.map((c) => (
          <Chip
            key={c}
            label={db.clubs[c].name}
            color={db.clubs[c].color}
            selected={clubIds.includes(c)}
            onPress={() => setClubIds(clubIds.includes(c) ? clubIds.filter((x) => x !== c) : [...clubIds, c])}
          />
        ))}
      </View>
      {tried && errors.clubs ? <Text style={ui.error}>{errors.clubs}</Text> : null}
      <View style={{ height: 14 }} />
      <Field label="Título" value={title} onChangeText={setTitle} placeholder="Ej. Cambio de hora" error={tried ? errors.title : null} />
      <Field label="Mensaje" value={body} onChangeText={setBody} multiline error={tried ? errors.body : null} />
      <ToggleRow label="Cambio de último momento" description="Se muestra destacado en rojo en Inicio." value={urgent} onChange={setUrgent} />
      <Button title="Publicar aviso" icon="megaphone-outline" onPress={save} style={{ marginTop: 10 }} />
    </Screen>
  );
}
