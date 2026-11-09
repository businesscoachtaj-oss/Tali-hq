// The top of the Founder screen (9 Nov 2026, Tali's Tuesday list items 2, 6 and 7):
// trials and conversions per app, the To confirm list, and the health light. Plus the way in to
// Affiliates (items 4 and 9). Taj only.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { founderApps, founderConfirmDone, founderHealth, founderModelChecked, founderToConfirm, type FounderApps, type FounderHealth, type ToConfirm } from '@/lib/founderOps';
import { Card, Label } from '@/components/ui';
import { colours, elevation, radius, space } from '@/constants/theme';

const DOT = { green: colours.good, amber: colours.orange, red: colours.danger } as const;
const n = (v: number) => (v ?? 0).toLocaleString('en-AU');
const day = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase();

export function FounderOps() {
  const [apps, setApps] = useState<FounderApps | null>(null);
  const [health, setHealth] = useState<FounderHealth | null>(null);
  const [confirm, setConfirm] = useState<ToConfirm[]>([]);
  const [busy, setBusy] = useState('');

  useFocusEffect(useCallback(() => {
    founderApps().then(setApps).catch(() => setApps(null));
    founderHealth().then(setHealth).catch(() => setHealth(null));
    founderToConfirm().then(setConfirm).catch(() => setConfirm([]));
  }, []));

  async function done(id: string) {
    setBusy(id);
    await founderConfirmDone(id).catch(() => {});
    setConfirm((c) => c.filter((x) => x.id !== id));
    setBusy('');
  }

  const rows: [string, keyof FounderApps['apps'][number], ((v: number) => string | undefined)?][] = [
    ['Signed up', 'signups_7d'],
    ['Trials end in 3 days', 'trials_ending_3d', (v) => (v ? '#B45F06' : undefined)],
    ['Paid this week', 'paid_7d', (v) => (v ? colours.good : undefined)],
    ['Cancelled, 24 hours', 'cancelled_24h', (v) => (v ? colours.danger : undefined)],
    ['Locked, not paying', 'locked_unpaid'],
  ];

  return (
    <>
      {apps?.apps?.length ? (
        <>
          <Label>Trials and conversions</Label>
          <Card>
            <View style={{ flexDirection: 'row', paddingBottom: 6 }}>
              <Text style={{ flex: 1.4, fontSize: 12, color: colours.faint }}>Last 7 days</Text>
              {apps.apps.map((a) => <Text key={a.app} style={{ flex: 1, fontSize: 12, color: colours.faint, textAlign: 'right' }}>{a.label}</Text>)}
            </View>
            {rows.map(([label, key, tone]) => (
              <View key={label} style={{ flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colours.border }}>
                <Text style={{ flex: 1.4, fontSize: 14, color: colours.text }}>{label}</Text>
                {apps.apps.map((a) => {
                  const v = a[key] as number;
                  return <Text key={a.app} style={{ flex: 1, fontSize: 14, fontWeight: '800', textAlign: 'right', color: tone?.(v) ?? colours.text }}>{n(v)}</Text>;
                })}
              </View>
            ))}
            <Text style={{ fontSize: 12, color: colours.faint, marginTop: 6 }}>{apps.excluded ? `${apps.excluded} test and gifted accounts left out.` : 'Test and gifted accounts left out.'}</Text>
          </Card>
        </>
      ) : null}

      {confirm.length ? (
        <>
          <View style={{ height: space.lg }} />
          <Label>To confirm</Label>
          <Card>
            <Text style={{ fontSize: 13, color: colours.muted, marginBottom: 4 }}>Open, not urgent. Tali keeps them here so they don't get lost.</Text>
            {confirm.map((c) => (
              <Pressable key={c.id} onPress={() => done(c.id)} disabled={busy === c.id} accessibilityRole="checkbox" accessibilityState={{ checked: false }} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colours.border, minHeight: 48 }}>
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colours.borderStrong }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, color: colours.text }}>{c.text}</Text>
                  <Text style={{ fontSize: 12, color: colours.faint, marginTop: 1 }}>Added {day(c.added_at)}</Text>
                </View>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      {health ? (
        <>
          <View style={{ height: space.lg }} />
          <Label>Health light</Label>
          <Card>
            <Text style={{ fontSize: 12, color: colours.faint, marginBottom: 4 }}>Checked {time(health.checked_at)}</Text>
            {health.lights.map((l) => (
              <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colours.border }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: DOT[l.status] }} />
                <Text style={{ flex: 1, fontSize: 15, color: colours.text }}>{l.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: l.status === 'green' ? colours.muted : l.status === 'amber' ? '#B45F06' : colours.danger }}>{l.detail}</Text>
              </View>
            ))}
            {health.model_changed_at && !health.model_checked ? (
              <View style={{ marginTop: space.sm, backgroundColor: colours.orangeSoft, borderRadius: 12, padding: space.md, gap: space.sm }}>
                <Text style={{ fontSize: 13, lineHeight: 19, color: '#6B3A00' }}>The AI model changed on {day(health.model_changed_at)}. Run one real Tali request in each app to make sure she still answers.</Text>
                <Pressable onPress={() => founderModelChecked().then(() => setHealth({ ...health, model_checked: true })).catch(() => {})} accessibilityRole="button" style={{ alignSelf: 'flex-start', borderWidth: 1.5, borderColor: colours.purple, backgroundColor: colours.surface, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colours.purple }}>Done, I tested it</Text>
                </Pressable>
              </View>
            ) : null}
          </Card>
        </>
      ) : null}

      <Pressable onPress={() => router.navigate('/founder-affiliates')} accessibilityRole="button" style={{ marginTop: space.lg, backgroundColor: colours.surface, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', ...elevation.card }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text }}>Affiliates</Text>
          <Text style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>Applications, codes, referrals and what's owed</Text>
        </View>
        <Text style={{ fontSize: 22, color: colours.faint, fontWeight: '600' }}>{'›'}</Text>
      </Pressable>
      <View style={{ height: space.lg }} />
    </>
  );
}
