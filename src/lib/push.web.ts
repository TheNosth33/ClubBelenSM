// En la versión web no hay notificaciones push; las notificaciones siguen
// apareciendo en la campana.
import type { PushStatus } from './push';

export type { PushStatus } from './push';

export async function getPushToken(): Promise<PushStatus> {
  return { state: 'no-disponible', reason: 'Las notificaciones push funcionan en la app del teléfono.' };
}

export function setAppBadge(_count: number) {}

export function useNotificationTaps(_enabled: boolean, _open: (href: string, notificationId?: string) => void) {}
