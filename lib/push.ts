import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

// Push is phone-only. It needs the EAS project id (added to app.config.js by `eas init`).
const projectId: string | undefined = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;

export const pushSupported = Platform.OS !== 'web' && Device.isDevice;

export type PushResult = { ok: true } | { ok: false; reason: 'unsupported' | 'denied' | 'not_set_up' | 'error'; message: string };

// Asks permission (only when the user taps the button) and saves this phone's token.
export async function enablePush(): Promise<PushResult> {
  if (!pushSupported) return { ok: false, reason: 'unsupported', message: 'Notifications work in the phone app.' };
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

export async function disablePushForThisPhone() {
  if (!pushSupported || !projectId) return;
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch {}
}
