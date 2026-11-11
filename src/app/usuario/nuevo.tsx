import React from 'react';
import { View } from 'react-native';
import { useData, useMe } from '../../data/DataContext';
import { clubsWith } from '../../data/permissions';
import { UserForm } from '../../components/UserForm';
import { EmptyState, Screen } from '../../components/ui';
import { handleResult, showMessage } from '../../utils/alerts';

export default function NewUser() {
  const { db, createUser } = useData();
  const me = useMe();
  const clubs = clubsWith(me, 'create_users');

  if (clubs.length === 0) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon="lock-closed-outline" text="Solo el Director General, los Directores y los Directores Asociados con permiso pueden crear usuarios." />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <View style={{ height: 12 }} />
      <UserForm
        db={db}
        actor={me}
        manageableClubs={clubs}
        submitLabel="Crear usuario"
        onSubmit={async (v) => {
          const { result, error } = await createUser({
            fullName: v.fullName,
            username: v.username,
            sex: v.sex!,
            birthDate: v.birthDate,
            phone: v.phone,
            clubs: v.clubs,
            roles: v.roles,
            password: v.password,
          });
          if (error) return showMessage('No se pudo crear el usuario', error);
          handleResult(result, `Usuario creado: ${v.username}`);
        }}
      />
    </Screen>
  );
}
