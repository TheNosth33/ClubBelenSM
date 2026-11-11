import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import type { PerformResult } from '../data/DataContext';

export function showMessage(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export function confirmAction(title: string, message: string, onConfirm: () => void, confirmText = 'Aceptar') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ]);
}

/** Muestra el resultado de una acción y, si salió bien, regresa a la pantalla anterior. */
export async function handleResult(pending: PerformResult | Promise<PerformResult>, successMsg: string, goBack = true): Promise<PerformResult> {
  const result = await pending;
  if (result === 'denied') {
    showMessage('Sin permiso', 'No tienes permiso para hacer este cambio.');
    return result;
  }
  if (result === 'error') {
    showMessage('No se pudo guardar', 'Revisa tu conexión a internet e intenta de nuevo.');
    return result;
  }
  if (result === 'pending') {
    showMessage('Enviado para aprobación', 'Tu cambio será aplicado cuando el Director del club o el Director General lo apruebe.');
  } else if (successMsg) {
    showMessage(successMsg);
  }
  if (goBack && router.canGoBack()) router.back();
  return result;
}
