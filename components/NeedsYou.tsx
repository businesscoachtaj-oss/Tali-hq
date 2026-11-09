// The "Needs you" strip on Today (9 Nov 2026, from Tali's Tuesday list). One place for everything
// that is amber or red: business health problems, drafts waiting for a yes, and emails that need
// a reply. When nothing is amber or red it shrinks to one green line, so a good day looks calm.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { DraftCard } from '@/components/DraftCard';
import { Sheet } from '@/components/Sheet';
import type { Approval, Health, InboundEmail } from '@/lib/data';
import { colours, elevation, space } from '@/constants/theme';

type Row = { key: string; level: 'red' | 'amber'; title: string; sub?: string; onPress?: () => void; approval?: Approval };

function time(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase();
}

export function NeedsYou({ health, approvals, emails, onDecided }: {
  health: Health | null;
  approvals: Approval[];
  emails: InboundEmail[];
  onDecided: (id: string) => void;
}) {
  const [openDraft, setOpenDraft] = useState<string | null>(null);

  const rows: Row[] = [
    ...(health?.items ?? []).filter((i) => i.level === 'red').map((i, n) => ({ key: `hr${n}`, level: 'red' as const, title: i.text })),
    ...approvals.map((a) => ({ key: a.id, level: 'amber' as const, title: a.title, sub: a.draft?.to_name ? `Draft to ${a.draft.to_name}, waiting for your yes` : 'Waiting for your yes', approval: a })),
    ...emails.map((e) => ({ key: e.id, level: 'amber' as const, title: `Email from ${e.from_name || e.from_email || 'someone'}`, sub: e.summary || e.subject || undefined, onPress: () => router.navigate('/inbox') })),
    ...(health?.items ?? []).filter((i) => i.level === 'amber').map((i, n) => ({ key: `ha${n}`, level: 'amber' as const, title: i.text })),
  ];

  if (!rows.length) {
    return (
      <View style={s.calm} accessible accessibilityLabel="All good. Nothing needs you right now.">
        <View style={[s.dot, { backgroundColor: colours.good }]} />
        <Text style={s.calmText}>All good. Nothing needs you right now.{health?.checkedAt ? ` Checked ${time(health.checkedAt)}.` : ''}</Text>
      </View>
    );
  }

  const red = rows.some((r) => r.level === 'red');
  const openApproval = approvals.find((a) => a.id === openDraft) ?? null;
  return (
    <View style={s.card}>
      <View style={[s.head, { backgroundColor: red ? '#FDECEA' : colours.orangeSoft }]}>
        <View style={[s.dot, { backgroundColor: red ? colours.danger : colours.orange }]} />
        <Text style={[s.headText, { color: red ? '#8E1F14' : '#8A4700' }]}>Needs you</Text>
        <Text style={[s.count, { color: red ? '#8E1F14' : '#8A4700' }]}>{rows.length}</Text>
      </View>
      {rows.map((r, i) => (
        <View key={r.key} style={[s.rowWrap, i < rows.length - 1 && s.divider]}>
          <Pressable
            onPress={r.approval ? () => setOpenDraft(r.key) : r.onPress}
            disabled={!r.approval && !r.onPress}
            accessibilityRole={r.approval || r.onPress ? 'button' : undefined}
            style={s.row}>
            <View style={[s.small, { backgroundColor: r.level === 'red' ? colours.danger : colours.orange }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.title}>{r.title}</Text>
              {r.sub ? <Text style={s.sub} numberOfLines={2}>{r.sub}</Text> : null}
            </View>
            {r.approval || r.onPress ? <Text style={s.chev}>{'›'}</Text> : null}
          </Pressable>
        </View>
      ))}
      {/* Drafts open in the same sheet they always have. */}
      <Sheet visible={!!openApproval} title={openApproval?.title ?? ''} onClose={() => setOpenDraft(null)}>
        {openApproval ? <DraftCard item={openApproval} onDecided={(id) => { setOpenDraft(null); onDecided(id); }} /> : null}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  calm: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 6, marginBottom: space.sm },
  calmText: { flex: 1, fontSize: 13, color: colours.muted },
  dot: { width: 10, height: 10, borderRadius: 5 },
  card: { backgroundColor: colours.surface, borderRadius: 18, overflow: 'hidden', marginBottom: space.md, ...elevation.card },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.lg, paddingVertical: 12 },
  headText: { flex: 1, fontSize: 14, fontWeight: '800' },
  count: { fontSize: 13, fontWeight: '800' },
  rowWrap: {},
  divider: { borderBottomWidth: 1, borderBottomColor: colours.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 13, minHeight: 52 },
  small: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 15, fontWeight: '700', color: colours.text, lineHeight: 20 },
  sub: { fontSize: 13, color: colours.muted, lineHeight: 18 },
  chev: { fontSize: 20, color: colours.faint },
});
