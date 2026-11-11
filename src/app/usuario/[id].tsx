import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useData, useMe } from '../../data/DataContext';
import { can, canPerform } from '../../data/permissions';
import { CLASSES_BY_CLUB } from '../../data/constants';
import { Achievement } from '../../data/types';
import { AchievementsCard, IdCard, ProfileCard, StatCards } from '../../components/ProfileParts';
import { DateField } from '../../components/DateField';
import { Button, Card, Chip, EmptyState, Field, Label, ListRow, Screen, SectionTitle, Segmented } from '../../components/ui';
import { colors } from '../../theme';
import { formatShort, todayISO } from '../../utils/dates';
import { confirmAction, handleResult } from '../../utils/alerts';

export default function UserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, perform } = useData();
  const me = useMe();
  const user = db.users.find((u) => u.id === id);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<Achievement['kind']>('clase');
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayISO());

  if (!user) return <Screen edges={['bottom']}><EmptyState text="Usuario no encontrado." /></Screen>;
  if (user.id === me.id) return <Redirect href="/perfil" />;

  const isLeader = me.isGeneralDirector || user.clubs.some((c) => can(me, 'edit_users', c) || can(me, 'assign_tasks', c));
  const canEdit = canPerform(db, me, { type: 'updateUser', userId: user.id, data: {} });
  const canAch = canPerform(db, me, { type: 'addAchievement', data: { userId: user.id, kind: 'clase', name: 'x', date: todayISO() } });
  const all = db.achievements.filter((a) => a.userId === user.id).sort((a, b) => b.date.localeCompare(a.date));
  const suggestions = user.clubs.flatMap((c) => CLASSES_BY_CLUB[c]).filter((n) => !all.some((a) => a.kind === 'clase' && a.name === n));

  const save = () => {
    if (!name.trim()) return;
    setAdding(false);
    handleResult(perform({ type: 'addAchievement', data: { userId: user.id, kind, name: name.trim(), date } }), kind === 'clase' ? 'Clase registrada' : 'Especialidad registrada', false);
    setName('');
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: user.fullName.split(' ')[0] }} />
      <View style={{ height: 12 }} />
      <ProfileCard user={user} db={db} />
      {isLeader ? <StatCards user={user} db={db} /> : null}

      <SectionTitle title="Clases y especialidades" />
      <AchievementsCard
        user={user}
        db={db}
        footer={canAch ? <Button title="Registrar clase o especialidad" icon="add" variant="secondary" small onPress={() => setAdding(true)} /> : null}
      />

      {canAch && all.length > 0 ? (
        <>
          <SectionTitle title="Historial" />
          <Card style={{ paddingVertical: 4 }}>
            {all.map((a) => (
              <ListRow
                key={a.id}
                icon={a.kind === 'clase' ? 'ribbon-outline' : 'medal-outline'}
                title={a.name}
                subtitle={`${a.kind === 'clase' ? 'Clase' : 'Especialidad'} · ${formatShort(a.date)}`}
                right={
                  <Pressable hitSlop={10} onPress={() => confirmAction('Quitar', `¿Quitar "${a.name}"?`, () => handleResult(perform({ type: 'removeAchievement', id: a.id }), '', false), 'Quitar')}>
                    <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                  </Pressable>
                }
              />
            ))}
          </Card>
        </>
      ) : null}

      {user.clubs[0] ? (
        <>
          <SectionTitle title="Carnet" />
          <IdCard user={user} club={db.clubs[user.clubs[0]]} />
        </>
      ) : null}

      {isLeader || canEdit || me.isGeneralDirector ? (
        <>
          <SectionTitle title="Administración" />
          <Card style={{ paddingVertical: 4 }}>
            {isLeader && user.phone ? <ListRow icon="call-outline" title={user.phone} subtitle="Teléfono" /> : null}
            {canEdit ? <ListRow icon="create-outline" title="Editar datos" subtitle="Nombre, club, rol, contraseña" onPress={() => router.push({ pathname: '/usuario/editar', params: { id: user.id } })} /> : null}
            {me.isGeneralDirector ? <ListRow icon="key-outline" title="Roles y permisos" subtitle="Dar o quitar accesos" onPress={() => router.push({ pathname: '/admin/usuario', params: { id: user.id } })} /> : null}
          </Card>
        </>
      ) : null}

      <Modal visible={adding} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAdding(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.text }}>Registrar logro</Text>
            <Pressable onPress={() => setAdding(false)} hitSlop={10}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Segmented
              options={[
                { value: 'clase', label: 'Clase' },
                { value: 'especialidad', label: 'Especialidad' },
              ]}
              value={kind}
              onChange={(k) => {
                setKind(k);
                setName('');
              }}
            />
            <View style={{ height: 14 }} />
            {kind === 'clase' && suggestions.length > 0 ? (
              <>
                <Label>Clases</Label>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {suggestions.map((s) => (
                    <Chip key={s} label={s} selected={name === s} onPress={() => setName(s)} />
                  ))}
                </View>
              </>
            ) : null}
            <Field label={kind === 'clase' ? 'Nombre de la clase' : 'Nombre de la especialidad'} value={name} onChangeText={setName} placeholder={kind === 'clase' ? 'Ej. Amigo' : 'Ej. Nudos'} />
            <DateField label="Fecha en que la obtuvo" value={date} onChange={setDate} maximumDate={new Date()} />
            <Button title="Guardar" icon="checkmark" onPress={save} disabled={!name.trim()} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}
