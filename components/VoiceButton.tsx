import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { taliVoice } from '@/lib/data';
import { colours } from '@/constants/theme';

// One clip plays at a time across the whole chat.
let current: { player: AudioPlayer; stop: () => void } | null = null;

// Pro: "Listen" under each of Tali's replies. Plays her own voice (the same one as her videos).
export function VoiceButton({ messageId, onError }: { messageId: string; onError: (msg: string) => void }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');

  useEffect(() => () => { if (current && state === 'playing') { current.player.remove(); current = null; } }, [state]);

  async function press() {
    if (state === 'playing') {
      current?.stop();
      return;
    }
    current?.stop();
    setState('loading');
    const res = await taliVoice(messageId);
    if (!res.ok) {
      setState('idle');
      onError(res.message);
      return;
    }
    try {
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
      const player = createAudioPlayer({ uri: res.url });
      const stop = () => {
        player.remove();
        if (current?.player === player) current = null;
        setState('idle');
      };
      current = { player, stop };
      player.addListener('playbackStatusUpdate', (s) => { if (s.didJustFinish) stop(); });
      player.play();
      setState('playing');
    } catch {
      setState('idle');
      onError("Couldn't play that one. Try again.");
    }
  }

  return (
    <Pressable onPress={press} accessibilityRole="button" accessibilityLabel={state === 'playing' ? 'Stop' : 'Listen to Tali'} hitSlop={8}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, alignSelf: 'flex-start' }}>
      {state === 'loading' ? <ActivityIndicator size="small" color={colours.purple} /> : null}
      <Text style={{ color: colours.purple, fontWeight: '700', fontSize: 13 }}>
        {state === 'playing' ? '■ Stop' : state === 'loading' ? 'Getting my voice ready' : '▶ Listen'}
      </Text>
    </Pressable>
  );
}
