import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

// Push works two ways (2 Nov 2026):
//   - phone builds: Expo push tokens (needs the EAS project id from `eas init`)
//   - the web app / PWA: standard web push through public/sw.js, with the VAPID public key from
//     the vapid_public_key() rpc. On iPhone this only works once Tali HQ is added to the home screen.
const projectId: string | undefined = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;

const webPushAvailable = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// iPhone Safari only allows web push for an installed app (standalone display mode).
const iosNeedsInstall = () =>
  Platform.OS === 'web' && typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone);

export const pushSupported = Platform.OS === 'web' ? typeof window !== 'undefined' && (webPushAvailable() || iosNeedsInstall()) : Device.isDevice;

export type PushResult = { ok: true } | { ok: false; reason: 'unsupported' | 'denied' | 'not_set_up' | 'install_first' | 'error'; message: string };

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function enableWebPush(): Promise<PushResult> {
  if (iosNeedsInstall()) {
    return { ok: false, reason: 'install_first', message: 'On iPhone, add Tali HQ to your Home Screen first (Share, then "Add to Home Screen"), open it from there and turn notifications on.' };
  }
  if (!webPushAvailable()) return { ok: false, reason: 'unsupported', message: 'This browser does not support notifications.' };
  try {
    const { data: publicKey, error: keyErr } = await supabase.rpc('vapid_public_key');
    if (keyErr || !publicKey) return { ok: false, reason: 'not_set_up', message: 'Notifications switch on shortly. Try again in a minute.' };
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied', message: 'Notifications are blocked for Tali HQ in your browser settings.' };
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
    const json = sub.toJSON();
    const { error } = await supabase.from('push_tokens').upsert({ token: sub.endpoint, platform: 'web', subscription: json, updated_at: new Date().toISOString() });
    if (error) return { ok: false, reason: 'error', message: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: 'error', message: e?.message ?? 'Could not turn on notifications.' };
  }
}

// Asks permission (only when the user taps the button) and saves this device's token.
export async function enablePush(): Promise<PushResult> {
  if (Platform.OS === 'web') return enableWebPush();
  if (!Device.isDevice) return { ok: false, reason: 'unsupported', message: 'Notifications work on a real phone.' };
  if (!projectId) return { ok: false, reason: 'not_set_up', message: 'Notifications switch on in the next app build.' };
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Tali', importance: Notifications.AndroidImportance.DEFAULT });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return { ok: false, reason: 'denied', message: 'Notifications are off for Tali HQ in your phone settings.' };
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { error } = await supabase.from('push_tokens').upsert({ token, platform: Platform.OS as 'ios' | 'android', updated_at: new Date().toISOString() });
    if (error) return { ok: false, reason: 'error', message: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: 'error', message: e?.message ?? 'Could not turn on notifications.' };
  }
}

// Sends "Tali is on" to this user's devices, so they can see it land.
export async function sendTestPush(): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke('push-send', { body: { test: true } });
  if (error) return { ok: false, message: 'Could not send a test just now.' };
  const n = (data?.web ?? 0) + (data?.expo ?? 0);
  return n > 0 ? { ok: true, message: n === 1 ? 'Sent. Check your notifications.' : `Sent to ${n} devices.` } : { ok: false, message: 'No devices are set up yet. Turn notifications on first.' };
}

export async function disablePushForThisDevice() {
  try {
    if (Platform.OS === 'web') {
      if (!webPushAvailable()) return;
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_tokens').delete().eq('token', sub.endpoint);
        await sub.unsubscribe();
      }
      return;
    }
    if (!Device.isDevice || !projectId) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch {}
}

// Kept for older imports.
export const disablePushForThisPhone = disablePushForThisDevice;
