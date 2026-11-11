import React from 'react';
import { Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useData, useMe } from '../../data/DataContext';
import { ALL_PERMISSIONS, ALL_ROLES, CLUB_IDS, MAX_CLUBS, MAX_ROLES, PERMISSION_LABELS, ROLE_LABELS } from '../../data/constants';
import { effectivePermissions, rolePermissions } from '../../data/permissions';
import { Permission, Role } from '../../data/types';
import { MemberRow } from '../../components/Items';
import { Button, Card, Chip, EmptyState, Label, ListRow, Screen, SectionTitle, ToggleRow } from '../../components/ui';
import { colors } from '../../theme';
import { confirmAction, showMessage } from '../../utils/alerts';

/** Director General: roles, clubes, permisos individuales y estado de la cuenta. */
export default function AdminUser() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, setUserPermissions, deleteUser } = useData();
  const me = useMe();
  const user = db.users.find((u) => u.id === id);

  if (!me.isGeneralDirector) return <Screen edges={['bottom']}><EmptyState icon="lock-closed-outline" text="Solo el Director General." /></Screen>;
  if (!user) return <Screen edges={['bottom']}><EmptyState text="Usuario no encontrado." /></Screen>;
  if (user.isGeneralDirector) return <Screen edges={['bottom']}><EmptyState text="La cuenta del Director General tiene acceso total." /></Screen>;

  const fromRoles = rolePermissions(user.roles);
  const effective = effectivePermissions(user);

  const save = async (patch: Parameters<typeof setUserPermissions>[1]) => {
    const err = await setUserPermissions(user.id, patch);
    if (err) showMessage('No se pudo guardar', err);
  };

  const toggleRole = (r: Role) => {
    const roles = user.roles.includes(r) ? user.roles.filter((x) => x !== r) : user.roles.length < MAX_ROLES ? [...user.roles, r] : user.roles;
    if (roles.length === 0) return;
    save({ roles });
  };

  const togglePerm = (p: Permission, on: boolean) => {
    let extra = user.extraPermissions.filter((x) => x !== p);
    let revoked = user.revokedPermissions.filter((x) => x !== p);
    if (on && !fromRoles.has(p)) extra = [...extra, p];
    if (!on && fromRoles.has(p)) revoked = [...revoked, p];
    save({ extraPermissions: extra, revokedPermissions: revoked });
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: user.fullName.split(' ')[0] }} />
      <View style={{ height: 12 }} />
      <Card style={{ paddingVertical: 4 }}>
        <MemberRow user={user} onPress={() => router.push(`/usuario/${user.id}`)} />
      </Card>

      <SectionTitle title={`Roles (máx. ${MAX_ROLES})`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ALL_ROLES.map((r) => (
          <Chip key={r} label={ROLE_LABELS[r]} selected={user.roles.includes(r)} onPress={() => toggleRole(r)} disabled={!user.roles.includes(r) && user.roles.length >= MAX_ROLES} />
        ))}
      </View>
      {user.roles.includes('director_asociado') ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>Los cambios de un Director Asociado necesitan aprobación del Director del club o tuya.</Text>
      ) : null}

      <SectionTitle title={`Clubes (máx. ${MAX_CLUBS})`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CLUB_IDS.map((c) => (
          <Chip
            key={c}
            label={db.clubs[c].name}
            color={db.clubs[c].color}
            selected={user.clubs.includes(c)}
            disabled={!user.clubs.includes(c) && user.clubs.length >= MAX_CLUBS}
            onPress={() => save({ clubs: user.clubs.includes(c) ? user.clubs.filter((x) => x !== c) : [...user.clubs, c] })}
          />
        ))}
      </View>

      <SectionTitle title="Permisos" />
      <Card>
        <Label>Activa o desactiva accesos para este usuario</Label>
        {ALL_PERMISSIONS.map((p: Permission) => (
          <ToggleRow
            key={p}
            label={PERMISSION_LABELS[p]}
            description={fromRoles.has(p) ? (user.revokedPermissions.includes(p) ? 'Quitado (su rol lo incluye)' : 'Incluido por su rol') : user.extraPermissions.includes(p) ? 'Dado por ti' : undefined}
            value={effective.has(p)}
            onChange={(v) => togglePerm(p, v)}
          />
        ))}
      </Card>

      <SectionTitle title="Cuenta" />
      <Card style={{ paddingVertical: 4 }}>
        <ListRow icon="create-outline" title="Editar datos personales" subtitle="Nombre, fecha de nacimiento, usuario, contraseña" onPress={() => router.push({ pathname: '/usuario/editar', params: { id: user.id } })} />
        <ToggleRow label="Cuenta activa" description="Si la desactivas, no podrá iniciar sesión." value={user.active} onChange={(v) => save({ active: v })} />
      </Card>
      <Button
        title="Eliminar usuario"
        icon="trash-outline"
        variant="danger"
        style={{ marginTop: 20 }}
        onPress={() =>
          confirmAction('Eliminar usuario', `Se eliminará a ${user.fullName} y sus datos. Esta acción no se puede deshacer.`, async () => {
            const err = await deleteUser(user.id);
            if (err) showMessage('No se pudo eliminar', err);
            else router.back();
          }, 'Eliminar')
        }
      />
    </Screen>
  );
}
