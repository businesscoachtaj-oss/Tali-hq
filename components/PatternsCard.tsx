// Patterns (Pro, 3 Nov 2026).
// PatternsCard: the monthly card on Today and Journal's Tali tab: the headline, then up to three
// patterns, each with its evidence line in muted text and a suggestion where Tali had one.
// PatternsRow: the "Patterns" section on Me: Pro sees "Last run <date>" and Run now; Free and HQ see
// one line, "Patterns are part of Pro", with a Plans button.
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Card, Label } from '@/components/ui';
import { TaliAvatar } from '@/components/TaliAvatar';
import { colours, space } from '@/constants/theme';
import { isPro } from '@/lib/plan';
import type { Credits } from '@/lib/data';
import { markPatternsRead, patternsDate, recentPatterns, runPatternsNow, type PatternsBrief } from '@/lib/patterns';

export function PatternsCard({ brief, compact, onRead }: { brief: PatternsBrief; compact?: boolean; onRead?: () => void }) {
  const patterns = brief.content.patterns ?? [];
  return (
    <Card style={!brief.read_at ? { borderLeftWidth: 5, borderLeftColor: colours.purple } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 6 }}>
        <TaliAvatar pose="head" size={28} />
        <Text style={{ fontSize: 12, color: colours.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Patterns {'·'} {patternsDate(brief.for_date)}
        </Text>
      </View>
      <Text style={{ fontSize: 17, fontWeight: '700', color: colours.text, lineHeight: 23 }}>{brief.content.headline || 'A few things I noticed'}</Text>
      {patterns.length === 0 ? (
        <Body muted>Nothing stood out this month. The more you tell me, the more I can spot.</Body>
      ) : (
        patterns.map((p, i) => (
          <View key={i} style={{ marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colours.border }}>
            <Text style={{ fontSize: 15, lineHeight: 22, color: colours.text, fontWeight: '600' }}>{p.pattern}</Text>
            <Text style={{ fontSize: 13, lineHeight: 19, color: colours.muted, marginTop: 3 }}>{p.evidence}</Text>
            {p.suggestion && !compact ? <Text style={{ fontSize: 14, lineHeight: 20, color: colours.purpleInk, marginTop: 6 }}>Try: {p.suggestion}</Text> : null}
          </View>
        ))
      )}
      {!brief.read_at && onRead ? <Button title="Got it" kind="ghost" onPress={() => markPatternsRead(brief.id).then(onRead)} /> : null}
    </Card>
  );
}

export function PatternsRow({ credits }: { credits: Credits | null }) {
  const pro = isPro(credits);
  const [last, setLast] = useState<PatternsBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!pro) return;
    try {
      const [latest] = await recentPatterns(1);
      setLast(latest ?? null);
    } catch {}
  }, [pro]);

  useEffect(() => {
    load();
  }, [load]);

  async function run() {
    setBusy(true);
    setNote('');
    const r = await runPatternsNow();
    setBusy(false);
    if (r.ok) {
      setNote(r.patterns ? `Done. ${r.headline}` : `Done. ${r.headline || 'Nothing stood out yet.'}`);
      await load();
    } else {
      setNote(r.message);
    }
  }

  return (
    <>
      <Label>Patterns</Label>
      <Card>
        {pro ? (
          <>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>What Tali noticed in your last 60 days</Text>
            <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2, lineHeight: 19 }}>
              {last ? `Last run ${patternsDate(last.for_date)}.` : 'Not run yet.'} Runs itself at the start of each month, 10 credits a run. Needs about two weeks of journal, chats or shutdowns.
            </Text>
            {note ? <Text style={{ fontSize: 13, color: note.startsWith('Done') ? colours.good : colours.danger, marginTop: 8, lineHeight: 19 }}>{note}</Text> : null}
            <Button title="Run now" kind="ghost" onPress={run} busy={busy} />
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Text style={{ flex: 1, fontSize: 15, color: colours.text, lineHeight: 21 }}>Patterns are part of Pro.</Text>
            <View style={{ marginTop: -space.sm }}>
              <Button title="Plans" kind="ghost" onPress={() => router.navigate('/plans')} />
            </View>
          </View>
        )}
      </Card>
    </>
  );
}
