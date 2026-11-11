import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useData, useMe } from '../../data/DataContext';
import { canPerform, clubsWith } from '../../data/permissions';
import { UserForm } from '../../components/UserForm';
import { Button, Card, EmptyState, Field, Screen, SectionTitle } from '../../components/ui';
import { handleResult, showMessage } from '../../utils/alerts';

export default function EditUser() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, perform, resetUserPassword } = useData();
  const me = useMe();
  const user = db.users.find((u) => u.id === id);
  const [pw, setPw] = useState('');

  if (!user || !canPerform(db, me, { type: 'updateUser', userId: user.id, data: {} })) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon="lock-closed-outline" text="No tienes permiso para editar este usuario." />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <View style={{ height: 12 }} />
      <UserForm
        db={db}
        actor={me}
        initial={user}
        editing
        manageableClubs={clubsWith(me, 'edit_users')}
        submitLabel="Guardar cambios"
        onSubmit={(v) => {
          const res = perform({
            type: 'updateUser',
            userId: user.id,
            data: { fullName: v.fullName, sex: v.sex!, birthDate: v.birthDate, phone: v.phone, clubs: v.clubs, roles: v.roles, username: v.username },
          });
          handleResult(res, 'Usuario actualizado');
        }}
      />

      <SectionTitle title="Restablecer contraseña" />
      <Card>
        <Field label="Nueva contraseña" value={pw} onChangeText={setPw} secureTextEntry hint="Mínimo 8 caracteres, con letras y números. Compártela con el usuario." />
        <Button
          title="Restablecer"
          icon="key-outline"
          variant="secondary"
          onPress={async () => {
            const { error, result } = await resetUserPassword(user.id, pw);
            if (error || !result) showMessage('No se pudo cambiar', error ?? undefined);
            else {
              setPw('');
              handleResult(result, 'Contraseña restablecida', false);
            }
          }}
        />
      </Card>
    </Screen>
  );
}
