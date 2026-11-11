import React from 'react';
import { Linking, ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useData, useMe } from '../../data/DataContext';
import { TabHeader } from '../../components/Header';
import { AchievementsCard, IdCard, ProfileCard, StatCards } from '../../components/ProfileParts';
import { Card, ListRow, Screen, SectionTitle } from '../../components/ui';
import { confirmAction } from '../../utils/alerts';
import { pendingApprovalsFor } from '../../data/selectors';

export default function Profile() {
  const { db, logout, pushStatus, retryPush } = useData();
  const me = useMe();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width, 520) - 32;
  const approvals = pendingApprovalsFor(db, me).length;

  return (
    <Screen header={<TabHeader title="Perfil" />}>
      <ProfileCard user={me} db={db} onEdit={() => router.push('/perfil/editar')} />
      <StatCards user={me} db={db} />

      <SectionTitle title="Clases y especialidades" />
      <AchievementsCard user={me} db={db} />

      <SectionTitle title="Mi carnet" />
      {me.clubs.length > 1 ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 12} decelerationRate="fast">
          {me.clubs.map((c) => (
            <View key={c} style={{ width: cardWidth, marginRight: 12 }}>
              <IdCard user={me} club={db.clubs[c]} />
            </View>
          ))}
        </ScrollView>
      ) : me.clubs[0] ? (
        <IdCard user={me} club={db.clubs[me.clubs[0]]} />
      ) : null}

      <SectionTitle title="Cuenta" />
      <Card style={{ paddingVertical: 4 }}>
        {me.isGeneralDirector ? (
          <ListRow icon="settings-outline" title="Panel de administración" subtitle="Usuarios, roles, permisos y clubes" onPress={() => router.push('/admin')} />
        ) : null}
        {approvals > 0 || me.isGeneralDirector ? (
          <ListRow icon="shield-checkmark-outline" title="Aprobaciones" subtitle={approvals ? `${approvals} pendiente(s)` : 'Sin pendientes'} onPress={() => router.push('/aprobaciones')} />
        ) : null}
        {pushStatus ? (
          <ListRow
            icon={pushStatus.state === 'activo' ? 'notifications' : 'notifications-off-outline'}
            title="Notificaciones push"
            subtitle={
              pushStatus.state === 'activo'
                ? 'Activadas en este teléfono'
                : pushStatus.state === 'sin-permiso'
                  ? 'Desactivadas. Toca para activarlas en Ajustes.'
                  : pushStatus.reason
            }
            onPress={pushStatus.state === 'sin-permiso' ? () => Linking.openSettings() : pushStatus.state === 'activo' ? undefined : retryPush}
          />
        ) : null}
        <ListRow icon="key-outline" title="Cambiar contraseña" onPress={() => router.push('/perfil/password')} />
        <ListRow icon="log-out-outline" title="Cerrar sesión" danger onPress={() => confirmAction('Cerrar sesión', '¿Quieres salir de tu cuenta?', logout, 'Salir')} />
      </Card>
    </Screen>
  );
}
