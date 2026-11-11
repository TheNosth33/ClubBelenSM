import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useData, useMe } from '../../data/DataContext';
import { ClubId } from '../../data/types';
import { CLUB_INFO } from '../../data/constants';
import { ClubLogo, Cover } from '../../components/ClubVisuals';
import { IdCard } from '../../components/ProfileParts';
import { Button, Field, Label, Screen } from '../../components/ui';
import { colors, radius } from '../../theme';
import { handleResult, showMessage } from '../../utils/alerts';

function ImageButtons({ onPick, onClear, has }: { onPick: () => void; onClear: () => void; has: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 18 }}>
      <Button title={has ? 'Cambiar' : 'Elegir imagen'} icon="image-outline" variant="secondary" small onPress={onPick} style={{ flex: 1 }} />
      {has ? <Button title="Quitar" icon="trash-outline" variant="ghost" small onPress={onClear} /> : null}
    </View>
  );
}

export default function EditClub() {
  const params = useLocalSearchParams<{ club: ClubId }>();
  const { db, perform, pickImage } = useData();
  const [uploading, setUploading] = useState(false);
  const me = useMe();
  const club = db.clubs[params.club ?? 'conquistadores'];
  const [name, setName] = useState(club.name);
  const [motto, setMotto] = useState(club.motto);
  const [coverUri, setCoverUri] = useState(club.coverUri);
  const [logoUri, setLogoUri] = useState(club.logoUri);
  const [cardBackgroundUri, setCardBg] = useState(club.cardBackgroundUri);
  const draft = { ...club, name, motto, coverUri, logoUri, cardBackgroundUri };

  const choose = async (aspect: [number, number], set: (u: string) => void) => {
    setUploading(true);
    try {
      const url = await pickImage(aspect, ['clubes', club.id]);
      if (url) set(url);
    } catch {
      showMessage('No se pudo subir la imagen', 'Revisa tu conexión a internet e intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    handleResult(
      perform({ type: 'updateClub', clubId: club.id, data: { name: name.trim() || CLUB_INFO[club.id].name, motto: motto.trim(), coverUri, logoUri, cardBackgroundUri } }),
      'Club actualizado',
    );
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: `Editar ${club.name}` }} />
      <View style={{ height: 12 }} />
      <Label>Portada</Label>
      <View style={styles.preview}>
        <Cover uri={coverUri} color={club.color} height={130} style={{ borderRadius: radius.lg }} />
        <View style={{ position: 'absolute', left: 16, bottom: -28 }}>
          <Pressable onPress={() => choose([1, 1], setLogoUri)}>
            <ClubLogo club={draft} size={64} />
            <View style={styles.camera}>
              <Ionicons name="camera" size={14} color={colors.white} />
            </View>
          </Pressable>
        </View>
      </View>
      <View style={{ height: 30 }} />
      <ImageButtons has={!!coverUri} onPick={() => choose([16, 9], setCoverUri)} onClear={() => setCoverUri(undefined)} />
      <Text style={styles.hint}>Toca el logo para cambiarlo.</Text>
      {logoUri ? <Button title="Quitar logo" variant="ghost" small onPress={() => setLogoUri(undefined)} style={{ alignSelf: 'flex-start', marginBottom: 14 }} /> : <View style={{ height: 14 }} />}

      <Field label="Nombre del club" value={name} onChangeText={setName} />
      <Field label="Lema" value={motto} onChangeText={setMotto} multiline />

      <Label>Fondo del carnet</Label>
      <IdCard user={me} club={draft} />
      <ImageButtons has={!!cardBackgroundUri} onPick={() => choose([16, 10], setCardBg)} onClear={() => setCardBg(undefined)} />

      {uploading ? <Text style={styles.hint}>Subiendo imagen…</Text> : null}
      <Button title="Guardar cambios" icon="checkmark" onPress={save} disabled={uploading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { borderRadius: radius.lg, overflow: 'visible' },
  camera: { position: 'absolute', right: 0, bottom: 0, backgroundColor: colors.primary, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: 6 },
});
