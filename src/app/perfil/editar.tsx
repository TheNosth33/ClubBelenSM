import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useData, useMe } from '../../data/DataContext';
import { Avatar } from '../../components/Avatar';
import { Cover } from '../../components/ClubVisuals';
import { DateField } from '../../components/DateField';
import { Button, Field, Label, Screen } from '../../components/ui';
import { colors, radius } from '../../theme';
import { ageFromBirthDate } from '../../utils/dates';
import { showMessage } from '../../utils/alerts';

/** Cada usuario puede cambiar su foto, portada, nombre y fecha de nacimiento. */
export default function EditProfile() {
  const { db, updateMyProfile, pickImage } = useData();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const me = useMe();
  const [fullName, setFullName] = useState(me.fullName);
  const [birthDate, setBirthDate] = useState(me.birthDate);
  const [photoUri, setPhotoUri] = useState(me.photoUri);
  const [coverUri, setCoverUri] = useState(me.coverUri);
  const age = ageFromBirthDate(birthDate);
  const color = db.clubs[me.clubs[0] ?? 'conquistadores'].color;

  const save = async () => {
    if (fullName.trim().split(/\s+/).length < 2) return showMessage('Revisa tu nombre', 'Escribe nombre y apellido.');
    if (age === null) return showMessage('Revisa la fecha', 'Elige una fecha de nacimiento válida.');
    setSaving(true);
    const err = await updateMyProfile({ fullName: fullName.trim().replace(/\s+/g, ' '), birthDate, photoUri, coverUri });
    setSaving(false);
    if (err) return showMessage('No se pudo guardar', err);
    router.back();
  };

  // Elige una imagen y la sube (en la nube si hay Supabase).
  const choose = async (aspect: [number, number], set: (u: string) => void) => {
    setUploading(true);
    try {
      const url = await pickImage(aspect, ['usuarios', me.id]);
      if (url) set(url);
    } catch {
      showMessage('No se pudo subir la imagen', 'Revisa tu conexión a internet e intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ height: 12 }} />
      <Pressable onPress={() => choose([16, 9], setCoverUri)} style={styles.coverWrap}>
        <Cover uri={coverUri} color={color} height={130}>
          <View style={styles.coverBtn}>
            <Ionicons name="image-outline" size={16} color={colors.white} />
            <Text style={{ color: colors.white, fontWeight: '700', fontSize: 13 }}>Cambiar portada</Text>
          </View>
        </Cover>
      </Pressable>
      <View style={{ alignItems: 'center', marginTop: -50, marginBottom: 16 }}>
        <Pressable onPress={() => choose([1, 1], setPhotoUri)}>
          <Avatar name={fullName || me.fullName} uri={photoUri} size={100} ring />
          <View style={styles.camera}>
            <Ionicons name="camera" size={16} color={colors.white} />
          </View>
        </Pressable>
        {photoUri ? (
          <Text style={styles.remove} onPress={() => setPhotoUri(undefined)}>
            Quitar foto
          </Text>
        ) : null}
      </View>

      <Field label="Nombre completo" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <DateField label="Fecha de nacimiento" value={birthDate} onChange={setBirthDate} maximumDate={new Date()} />
        </View>
        <View style={{ width: 80 }}>
          <Label>Edad</Label>
          <Text style={styles.age}>{age ?? '—'}</Text>
        </View>
      </View>
      <Text style={styles.note}>El club, el rol y el teléfono los actualiza tu director.</Text>
      {uploading ? <Text style={styles.note}>Subiendo imagen…</Text> : null}
      <Button title="Guardar" icon="checkmark" onPress={save} loading={saving} disabled={uploading} />
      <Button title="Cambiar contraseña" icon="key-outline" variant="ghost" onPress={() => router.push('/perfil/password')} style={{ marginTop: 10 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  coverWrap: { borderRadius: radius.lg, overflow: 'hidden' },
  coverBtn: { position: 'absolute', right: 10, top: 10, flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  camera: { position: 'absolute', right: 2, bottom: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  remove: { color: colors.danger, marginTop: 8, fontWeight: '600' },
  age: { fontSize: 22, fontWeight: '800', color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: radius.md, textAlign: 'center', paddingVertical: 10, overflow: 'hidden' },
  note: { color: colors.textMuted, fontSize: 13, marginBottom: 14 },
});
