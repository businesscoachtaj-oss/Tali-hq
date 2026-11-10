// Day one fill (10 Nov 2026, asked for by Taj): once Gmail or Outlook is connected, Tali can read the
// last two weeks of mail and the next two weeks of calendar and arrive already knowing your people and
// your week. Opt in, one tap, and it says what it costs before anything happens.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { learnRecent } from '@/lib/data';
import { colours, space } from '@/constants/theme';

export const LEARN_RECENT_CREDITS = 10;

// mail={false} (10 Nov 2026): Google no longer gives Tali Gmail to read, so for Google this is the calendar only.
export function LearnRecent({ provider, mail = true }: { provider: 'google' | 'microsoft'; mail?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  async function go() {
    if (!armed) return setArmed(true);
    setArmed(false);
    setBusy(true);
    setNote(null);
    const r = await learnRecent(provider);
    setBusy(false);
    if (r.ok) setNote({ text: r.message || (r.learned ? `Done. I picked up ${r.learned} ${r.learned === 1 ? 'thing' : 'things'}. They're in my brain now.` : "Done. Nothing new worth keeping this time."), good: true });
    else setNote({ text: r.message || "I couldn't do that just now. Nothing was charged.", good: false });
  }
  return (
    <View style={{ marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colours.border }}>
      <Text style={{ color: colours.text, fontWeight: '700', fontSize: 14.5 }}>Get me up to speed</Text>
      <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2, lineHeight: 19 }}>
        {mail
          ? "I'll look at your last two weeks of mail and your next two weeks of calendar, and remember the people and commitments that matter. I skip newsletters and never keep passwords, codes or card details."
          : "I'll look at your next two weeks of calendar and remember the people and commitments that matter."}
      </Text>
      <Button title={busy ? 'Reading...' : armed ? `Yes, use ${LEARN_RECENT_CREDITS} credits` : mail ? 'Learn from my last two weeks' : 'Learn from my calendar'} kind="ghost" onPress={go} busy={busy} />
      {note ? <Text style={{ color: note.good ? colours.good : colours.danger, fontSize: 13, marginTop: 6, lineHeight: 19 }}>{note.text}</Text> : null}
    </View>
  );
}
