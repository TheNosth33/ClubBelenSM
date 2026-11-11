import React, { useCallback } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DataProvider, useData } from '../data/DataContext';
import { colors } from '../theme';
import { useNotificationTaps } from '../lib/push';

function RootNavigator() {
  const { me, markNotificationRead } = useData();

  // Al tocar una notificación push se abre la pantalla correspondiente.
  const openNotification = useCallback(
    (href: string, notificationId?: string) => {
      if (notificationId) markNotificationRead(notificationId);
      setTimeout(() => router.push(href as never), 300);
    },
    [markNotificationRead],
  );
  useNotificationTaps(!!me, openNotification);

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!me}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!me}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="notificaciones" options={{ title: 'Notificaciones', presentation: 'modal' }} />
        <Stack.Screen name="tarea/[id]" options={{ title: 'Tarea' }} />
        <Stack.Screen name="actividad/[id]" options={{ title: 'Actividad' }} />
        <Stack.Screen name="club/miembros" options={{ title: 'Miembros' }} />
        <Stack.Screen name="club/avisos" options={{ title: 'Avisos' }} />
        <Stack.Screen name="club/editar" options={{ title: 'Editar club' }} />
        <Stack.Screen name="usuario/[id]" options={{ title: 'Miembro' }} />
        <Stack.Screen name="usuario/nuevo" options={{ title: 'Crear usuario' }} />
        <Stack.Screen name="usuario/editar" options={{ title: 'Editar usuario' }} />
        <Stack.Screen name="perfil/editar" options={{ title: 'Editar perfil' }} />
        <Stack.Screen name="perfil/password" options={{ title: 'Cambiar contraseña' }} />
        <Stack.Screen name="crear/tarea" options={{ title: 'Asignar tarea' }} />
        <Stack.Screen name="crear/actividad" options={{ title: 'Actividad' }} />
        <Stack.Screen name="crear/aviso" options={{ title: 'Nuevo aviso' }} />
        <Stack.Screen name="asistencia" options={{ title: 'Registrar asistencia' }} />
        <Stack.Screen name="revisar" options={{ title: 'Tareas por revisar' }} />
        <Stack.Screen name="aprobaciones" options={{ title: 'Aprobaciones' }} />
        <Stack.Screen name="admin/index" options={{ title: 'Panel de administración' }} />
        <Stack.Screen name="admin/usuario" options={{ title: 'Roles y permisos' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <DataProvider>
        <RootNavigator />
      </DataProvider>
    </SafeAreaProvider>
  );
}
