// Money picture on Today (3 Nov 2026). Tali HQ and up, 0 credits. Loads itself; shows nothing
// until the numbers are in. On Free it shows a short line and a Plans button, never a blank.
// Mount on Today under a <Label>Money</Label>, after Business health.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { Credits } from '@/lib/data';
import { isPaid } from '@/lib/plan';
import { loadMoneyPicture, money0, runwayLabel, taliMoneyLine, type MoneyPicture } from '@/lib/money';
import { Body, Button, Card } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

export function MoneyCard({ credits }: { credits: Credits | null }) {
  const [pic, setPic] = useState<MoneyPicture | null>(null);
  const paid = isPaid(credits);

  const load = useCallback(async () => {
    if (!paid) return;
    try {
      setPic(await loadMoneyPicture());
    } catch {
      setPic(null);
    }
  }, [paid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!credits) return null;

  if (!paid) {
    return (
      <Card>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>Money picture is part of Tali HQ</Text>
        <Body muted>Cash in, owed, overdue and runway, read by Tali each morning.</Body>
        <Button title="See plans" kind="ghost" onPress={() => router.navigate('/plans')} />
      </Card>
    );
  }

  if (!pic) return null;
  const runway = runwayLabel(pic.runwayWeeks);
  const left = pic.overdue > 0 ? colours.danger : colours.good;

  return (
    <Pressable onPress={() => router.navigate('/money')} accessibilityRole="button">
      <Card style={{ borderLeftWidth: 5, borderLeftColor: left }}>
        <Text style={{ fontSize: 15, lineHeight: 22, color: colours.text, fontWeight: '600' }}>{taliMoneyLine(pic)}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          <Mini label="In" value={money0(pic.cashIn)} colour={colours.good} />
          <Mini label="Owed" value={money0(pic.owed)} />
          <Mini label="Overdue" value={money0(pic.overdue)} colour={pic.overdue > 0 ? colours.danger : undefined} />
          <Mini label="Runway" value={runway ?? 'Set up'} colour={colours.purpleInk} muted={!runway} />
        </View>
        <Text style={{ fontSize: 13, color: colours.purple, fontWeight: '700', marginTop: space.md }}>Open the money picture {'›'}</Text>
      </Card>
    </Pressable>
  );
}

function Mini({ label, value, colour, muted }: { label: string; value: string; colour?: string; muted?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: colours.sunk, borderRadius: radius.input, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' }}>
      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colours.muted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '800', color: muted ? colours.faint : colour ?? colours.text, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}
