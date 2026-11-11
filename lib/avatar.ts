// 12 Nov 2026 (Taj): your profile photo. Picked from your photos, cropped square, kept small, and
// stored privately (bucket "avatars", one folder per person). Only you can see it.
import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { useAuth } from './auth';

const SIZE = 400;
let state: { userId: string | null; path: string | null; url: string | null } = { userId: null, path: null, url: null };
const subs = new Set<() => void>();
const set = (next: typeof state) => { state = next; subs.forEach((f) => f()); };

async function signed(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 6 * 3600);
  return data?.signedUrl ?? null;
}

async function load(userId: string) {
  const { data, error } = await supabase.from('profiles').select('avatar_path').eq('id', userId).maybeSingle();
  if (error) return; // the column is not there yet: no photo, nothing to show
  const path = ((data as any)?.avatar_path as string | null) ?? null;
  set({ userId, path, url: await signed(path) });
}

/** Your photo's address, or null when you have none. Loads once per sign in. */
export function useAvatar(): string | null {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const s = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => state);
  useEffect(() => {
    if (!uid) { if (state.userId) set({ userId: null, path: null, url: null }); return; }
    if (state.userId !== uid) { set({ userId: uid, path: null, url: null }); load(uid).catch(() => {}); }
  }, [uid]);
  return s.userId === uid ? s.url : null;
}

// A square crop from the middle, 400 by 400, as a JPEG.
function squareWeb(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    createImageBitmap(file).then((bmp) => {
      const side = Math.min(bmp.width, bmp.height);
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that photo.'))), 'image/jpeg', 0.85);
    }).catch(() => reject(new Error('Could not read that photo.')));
  });
}

function pickWeb(): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      squareWeb(f).then(resolve).catch(reject);
    };
    input.click();
  });
}

async function pickNative(): Promise<Blob | null> {
  const ImagePicker = await import('expo-image-picker');
  const Manipulator = await import('expo-image-manipulator');
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Tali needs photo access for that. You can allow it in Settings.');
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  const w = a.width ?? 0, h = a.height ?? 0;
  const ctx = Manipulator.ImageManipulator.manipulate(a.uri);
  if (w && h && w !== h) { const side = Math.min(w, h); ctx.crop({ originX: Math.round((w - side) / 2), originY: Math.round((h - side) / 2), width: side, height: side }); }
  ctx.resize({ width: SIZE, height: SIZE });
  const img = await ctx.renderAsync();
  const saved = await img.saveAsync({ format: Manipulator.SaveFormat.JPEG, compress: 0.85 });
  return await (await fetch(saved.uri)).blob();
}

/** Pick a photo and make it yours. Returns false when they backed out. Throws with a plain message on failure. */
export async function changeAvatar(userId: string): Promise<boolean> {
  const blob = Platform.OS === 'web' ? await pickWeb() : await pickNative();
  if (!blob) return false;
  const old = state.userId === userId ? state.path : null;
  // A new name each time, so the old picture is never shown from a cache.
  const path = `${userId}/photo-${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw new Error('Could not save that photo. Try again.');
  const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
  if (error) {
    await supabase.storage.from('avatars').remove([path]).catch(() => {});
    throw new Error('Could not save that photo. Try again.');
  }
  if (old) await supabase.storage.from('avatars').remove([old]).catch(() => {});
  set({ userId, path, url: await signed(path) });
  return true;
}

export async function removeAvatar(userId: string) {
  const old = state.userId === userId ? state.path : null;
  const { error } = await supabase.from('profiles').update({ avatar_path: null }).eq('id', userId);
  if (error) throw new Error('Could not remove your photo. Try again.');
  if (old) await supabase.storage.from('avatars').remove([old]).catch(() => {});
  set({ userId, path: null, url: null });
}
