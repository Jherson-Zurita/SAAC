import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

/** Envía una notificación del sistema operativo; devuelve `false` si no hay permiso. */
export async function sendSystemNotification(title: string, body: string): Promise<boolean> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === 'granted';
    if (!granted) return false;
    sendNotification({ title, body });
    return true;
  } catch (err) {
    console.warn('No se pudo enviar la notificación del sistema:', err);
    return false;
  }
}
