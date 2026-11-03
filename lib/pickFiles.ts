// Picking photos and files to send Tali (3 Nov 2026). On the web it is the browser's file dialog;
// on phones it is the photo library, the camera, or the document picker. Images are shrunk to
// 1600px on the long side before upload so a phone photo is not 8 MB.
import { Platform } from 'react-native';

export type PickedFile = { blob: Blob; name: string; mime: string; previewUrl?: string };

const MAX_EDGE = 1600;

export async function pickFiles(source: 'photo' | 'camera' | 'file', max: number): Promise<PickedFile[]> {
  if (Platform.OS === 'web') return pickWeb(max);
  if (source === 'file') return pickDocument(max);
  return pickImage(source, max);
}

async function pickWeb(max: number): Promise<PickedFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.multiple = max > 1;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []).slice(0, max);
      const out: PickedFile[] = [];
      for (const f of files) out.push(f.type.startsWith('image/') ? await shrinkWeb(f) : { blob: f, name: f.name, mime: f.type || 'application/pdf' });
      resolve(out);
    };
    // Cancelling the dialog fires no event in some browsers, so an empty result is the norm there.
    input.click();
  });
}

async function shrinkWeb(file: File): Promise<PickedFile> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return { blob: file, name: file.name, mime: file.type, previewUrl: URL.createObjectURL(file) };
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not read that photo.'))), 'image/jpeg', 0.85));
    return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg', previewUrl: URL.createObjectURL(blob) };
  } catch {
    return { blob: file, name: file.name, mime: file.type, previewUrl: URL.createObjectURL(file) };
  }
}

async function pickImage(source: 'photo' | 'camera', max: number): Promise<PickedFile[]> {
  const ImagePicker = await import('expo-image-picker');
  const Manipulator = await import('expo-image-manipulator');
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Tali needs camera access for that. You can allow it in Settings.');
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('Tali needs photo access for that. You can allow it in Settings.');
  }
  const res = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: max > 1, selectionLimit: max });
  if (res.canceled) return [];
  const out: PickedFile[] = [];
  for (const a of res.assets.slice(0, max)) {
    const w = a.width ?? 0, h = a.height ?? 0;
    const scale = w && h ? Math.min(1, MAX_EDGE / Math.max(w, h)) : 1;
    const ctx = Manipulator.ImageManipulator.manipulate(a.uri);
    if (scale < 1) ctx.resize({ width: Math.round(w * scale), height: Math.round(h * scale) });
    const img = await ctx.renderAsync();
    const saved = await img.saveAsync({ format: Manipulator.SaveFormat.JPEG, compress: 0.85 });
    const blob = await (await fetch(saved.uri)).blob();
    out.push({ blob, name: (a.fileName ?? `photo-${Date.now()}`).replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg', previewUrl: saved.uri });
  }
  return out;
}

async function pickDocument(max: number): Promise<PickedFile[]> {
  const DocumentPicker = await import('expo-document-picker');
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: max > 1, copyToCacheDirectory: true });
  if (res.canceled) return [];
  const out: PickedFile[] = [];
  for (const a of res.assets.slice(0, max)) {
    const blob = await (await fetch(a.uri)).blob();
    const mime = a.mimeType ?? (a.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    out.push({ blob, name: a.name, mime, previewUrl: mime.startsWith('image/') ? a.uri : undefined });
  }
  return out;
}
