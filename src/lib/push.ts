import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';

/** Por qué no se pudo activar el push (para mostrarlo en Perfil). */
export type PushStatus =
  | { state: 'activo'; token: string }
  | { state: 'sin-permiso' }
  | { state: 'no-disponible'; reason: string };

// Con la app abierta, la notificación también se muestra arriba.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Pide permiso y obtiene el token de Expo para este teléfono. */
export async function getPushToken(): Promise<PushStatus> {
  if (!Device.isDevice) return { state: 'no-disponible', reason: 'Solo funciona en un teléfono real (no en simulador).' };
  if (isRunningInExpoGo()) return { state: 'no-disponible', reason: 'No funciona en Expo Go. Instala la app compilada con EAS.' };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Avisos del club',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F2B705',
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return { state: 'sin-permiso' };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { state: 'no-disponible', reason: 'Falta configurar EAS (npx eas-cli init).' };
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { state: 'activo', token: data };
  } catch (e) {
    return { state: 'no-disponible', reason: `No se pudo registrar el teléfono: ${(e as Error).message}` };
  }
}

/** Número en el ícono de la app = notificaciones sin leer. */
export function setAppBadge(count: number) {
  Notifications.setBadgeCountAsync(count).catch(() => {});
}

/**
 * Al tocar una notificación, abre la pantalla que corresponde (la tarea,
 * la actividad, las aprobaciones…) y la marca como leída.
 */
export function useNotificationTaps(enabled: boolean, open: (href: string, notificationId?: string) => void) {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const data = response.notification.request.content.data as { href?: string; notificationId?: string } | undefined;
    // Se limpia para no volver a abrirla si la pantalla se vuelve a montar.
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
    open(data?.href || '/notificaciones', data?.notificationId);
  }, [enabled, response, open]);
}
