// Voice notes (3 Nov 2026): talk to Tali instead of typing, for the drive home.
// Tap the mic to start, tap again to stop. The clip (up to 3 minutes) goes to the private chat-uploads
// bucket under <user id>/voice/<id>.<ext>, the tali-transcribe function turns it into text and deletes
// the clip, and the text lands in the Talk composer so the user can check it and press Send as normal.
// Web records with MediaRecorder (audio/webm where the browser has it, audio/mp4 on Safari); phones
// record with expo-audio. Tali HQ and the trial get 1,800 seconds a month, Pro has no cap.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Parked, 3 Nov 2026: transcription needs an OpenAI key and Taj is not running other APIs yet. Flip this
// to true (and deploy tali-transcribe with OPENAI_API_KEY) to switch voice notes on. Off means no mic
// in Talk, no usage read, no copy about voice notes anywhere.
export const VOICE_NOTES_ON = false;
export const VOICE_MAX_SECONDS = 180;
export const VOICE_HQ_MONTHLY_SECONDS = 1800;
// Show "x minutes left" in the composer once an HQ user is under this.
export const VOICE_HINT_UNDER_SECONDS = 5 * 60;

export type VoiceClip = { blob: Blob; mime: string; ext: string; seconds: number };

type Recorder = { stop: () => Promise<VoiceClip>; cancel: () => Promise<void> };

// ---------- recording ----------

async function startWeb(): Promise<Recorder> {
  const nav = globalThis.navigator as Navigator | undefined;
  if (!nav?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error("This browser can't record audio. Type it for now.");
  let stream: MediaStream;
  try {
    stream = await nav.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new Error('Tali needs the microphone for that. Allow it in your browser and try again.');
  }
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];
  const mime = candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const started = Date.now();
  rec.start(1000);
  const finish = () => new Promise<void>((resolve) => {
    if (rec.state === 'inactive') return resolve();
    rec.onstop = () => resolve();
    rec.stop();
  });
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    async stop() {
      await finish();
      release();
      const type = rec.mimeType || mime || 'audio/webm';
      const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
      const blob = new Blob(chunks, { type: type.split(';')[0] });
      return { blob, mime: type.split(';')[0], ext, seconds: Math.max(1, Math.round((Date.now() - started) / 1000)) };
    },
    async cancel() {
      await finish();
      release();
    },
  };
}

async function startNative(): Promise<Recorder> {
  const Audio = await import('expo-audio');
  const perm = await Audio.requestRecordingPermissionsAsync();
  if (!perm.granted) throw new Error('Tali needs the microphone for that. You can allow it in Settings.');
  await Audio.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  // Mono AAC at 64 kbps: small, and plenty for speech.
  const options: import('expo-audio').RecordingOptions = {
    extension: '.m4a',
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
    android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
    ios: { outputFormat: Audio.IOSOutputFormat.MPEG4AAC, audioQuality: Audio.AudioQuality.MEDIUM, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
    web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
  };
  const recorder = new Audio.AudioModule.AudioRecorder(options);
  await recorder.prepareToRecordAsync();
  recorder.record();
  const started = Date.now();
  const done = async () => {
    try { await recorder.stop(); } catch {}
    try { await Audio.setAudioModeAsync({ allowsRecording: false }); } catch {}
  };
  return {
    async stop() {
      await done();
      const uri = recorder.uri;
      if (!uri) throw new Error("That recording didn't save. Have another go?");
      const blob = await (await fetch(uri)).blob();
      return { blob, mime: 'audio/mp4', ext: 'm4a', seconds: Math.max(1, Math.round((Date.now() - started) / 1000)) };
    },
    async cancel() {
      await done();
    },
  };
}

export const startRecording = (): Promise<Recorder> => (Platform.OS === 'web' ? startWeb() : startNative());

// ---------- upload and transcribe ----------

export async function uploadVoiceNote(clip: VoiceClip): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error('Not signed in');
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `${uid}/voice/${id}.${clip.ext}`;
  const { error } = await supabase.storage.from('chat-uploads').upload(path, clip.blob, { contentType: clip.mime, upsert: false });
  if (error) throw new Error("Couldn't upload that voice note. Check your connection.");
  return path;
}

export type TranscribeResult =
  | { ok: true; text: string; seconds: number; secondsLeft: number | null; empty?: boolean; message?: string }
  | { ok: false; code: string; message: string; secondsLeft?: number };

export async function transcribeVoiceNote(path: string, seconds: number): Promise<TranscribeResult> {
  const { data, error } = await supabase.functions.invoke('tali-transcribe', { body: { path, duration: Math.min(seconds, VOICE_MAX_SECONDS) } });
  if (error) {
    try {
      const b = await (error as any).context?.json?.();
      if (b?.message) return { ok: false, code: b.code ?? 'error', message: b.message, secondsLeft: b.secondsLeft };
    } catch {}
    return { ok: false, code: 'network', message: "Couldn't reach Tali. Check your connection." };
  }
  return data as TranscribeResult;
}

// Seconds of voice notes used this month (RPC my_voice_seconds, migration 035). 0 when it is not there yet.
export async function voiceSecondsUsedThisMonth(): Promise<number> {
  const { data, error } = await supabase.rpc('my_voice_seconds');
  if (error) return 0;
  return Number(data ?? 0);
}

export function voiceMinutesLeftLine(secondsLeft: number | null): string | null {
  if (secondsLeft == null || secondsLeft > VOICE_HINT_UNDER_SECONDS) return null;
  if (secondsLeft < 60) return "That's this month's voice notes used. Pro has no cap.";
  const m = Math.floor(secondsLeft / 60);
  return `${m} minute${m === 1 ? '' : 's'} of voice notes left this month.`;
}

export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ---------- the hook Talk uses ----------
// toggle(): tap to start, tap to stop. Stops itself at 3 minutes. onText gets the transcript.

export type VoiceNoteState = {
  recording: boolean;
  busy: boolean;
  seconds: number;
  secondsLeft: number | null;
  toggle: () => void;
};

// plan: null until the app knows it (recording is allowed meanwhile), 'free' shows the plan line instead of recording.
export function useVoiceNote({ onText, onNotice, plan }: { onText: (text: string) => void; onNotice: (msg: string) => void; plan: 'free' | 'hq' | 'pro' | null }): VoiceNoteState {
  const hq = plan === 'hq';
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const rec = useRef<Recorder | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!hq) { setSecondsLeft(null); return; }
    if (!VOICE_NOTES_ON) return;
    voiceSecondsUsedThisMonth().then((used) => setSecondsLeft(Math.max(VOICE_HQ_MONTHLY_SECONDS - used, 0))).catch(() => {});
  }, [hq]);

  const clearTick = () => { if (tick.current) clearInterval(tick.current); tick.current = null; };

  const stop = useCallback(async () => {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    clearTick();
    setRecording(false);
    setBusy(true);
    try {
      const clip = await r.stop();
      if (clip.seconds < 1 || clip.blob.size < 200) { onNotice('Too short to hear. Hold on a moment longer next time.'); return; }
      onNotice('Listening back...');
      const path = await uploadVoiceNote(clip);
      const res = await transcribeVoiceNote(path, clip.seconds);
      if (!res.ok) {
        if (typeof res.secondsLeft === 'number') setSecondsLeft(res.secondsLeft);
        onNotice(res.message);
        return;
      }
      if (res.secondsLeft != null) setSecondsLeft(res.secondsLeft);
      if (res.empty || !res.text) { onNotice(res.message ?? "I couldn't make out any words in that one."); return; }
      onText(res.text);
      onNotice('Check it reads right, then send.');
    } catch (e: any) {
      onNotice(e?.message ?? "Couldn't finish that voice note.");
    } finally {
      setBusy(false);
      setSeconds(0);
    }
  }, [onText, onNotice]);
  stopRef.current = () => { void stop(); };

  const start = useCallback(async () => {
    if (busy || rec.current) return;
    if (plan === 'free') { onNotice('Voice notes are part of Tali HQ. See plans on Me.'); return; }
    onNotice('');
    try {
      const r = await startRecording();
      rec.current = r;
      setSeconds(0);
      setRecording(true);
      const began = Date.now();
      tick.current = setInterval(() => {
        const s = Math.round((Date.now() - began) / 1000);
        setSeconds(s);
        if (s >= VOICE_MAX_SECONDS) stopRef.current();
      }, 250);
    } catch (e: any) {
      onNotice(e?.message ?? "Couldn't start recording.");
    }
  }, [busy, onNotice, plan]);

  const toggle = useCallback(() => {
    if (rec.current) void stop();
    else void start();
  }, [start, stop]);

  // Leaving the screen mid recording throws the clip away.
  useEffect(() => () => { clearTick(); rec.current?.cancel().catch(() => {}); rec.current = null; }, []);

  return { recording, busy, seconds, secondsLeft, toggle };
}
