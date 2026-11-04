// Pre meeting nudge on Today (3 Nov 2026). Tali HQ and up, 0 credits. When a calendar is
// connected and one of today's events matches a client (attendee email, or their name in the
// title), shows "Meeting <name> at <time>" with the top 3 things Tali knows and a link to them.
// Renders nothing when there is no match. Mount on Today right under the hello bubble.
// Pass `calendar` from Today's own anyCalendarToday() call so it is not fetched twice.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { clients as loadClients, type CalendarToday, type Client, type Credits, type Memory } from '@/lib/data';
import { isPaid } from '@/lib/plan';
import { matchMeetings, memoriesAbout, type MeetingMatch } from '@/lib/people';
import { TaliAvatar } from '@/components/TaliAvatar';
import { Card } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { colours, space } from '@/constants/theme';

type Row = MeetingMatch & { memories: Memory[] };

export function MeetingNudge({ credits, calendar, compact }: { credits: Credits | null; calendar: CalendarToday | null; compact?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  // compact (Today, 3 Nov 2026): one line per meeting, tap to see what Tali knows.
  const [open, setOpen] = useState<string | null>(null);
  const paid = isPaid(credits);

  const load = useCallback(async () => {
    if (!paid || !calendar?.connected || !calendar.events?.length) return setRows([]);
    try {
      const people: Client[] = await loadClients();
      const matches = matchMeetings(calendar, people).slice(0, 3);
      const withMems = await Promise.all(matches.map(async (m) => ({ ...m, memories: (await memoriesAbout(m.client.name).catch(() => [])).slice(0, 3) })));
      setRows(withMems);
    } catch {
      setRows([]);
    }
  }, [paid, calendar]);

  useEffect(() => {
    load();
  }, [load]);

  if (!rows.length) return null;

  return (
    <>
      {rows.map((r) => (
        compact ? (
          <Pressable key={r.client.id} onPress={() => setOpen(r.client.id)} accessibilityRole="button">
            <Card style={{ borderLeftWidth: 5, borderLeftColor: colours.purple, paddingVertical: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <TaliAvatar pose="head" size={30} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colours.text }} numberOfLines={1}>
                  Meeting {r.client.name.split(' ')[0]} at {r.time}
                </Text>
                <Text style={{ fontSize: 13, color: colours.purple, fontWeight: '700' }}>What I know {'›'}</Text>
              </View>
            </Card>
          </Pressable>
        ) : (
        <Pressable key={r.client.id} onPress={() => router.navigate({ pathname: '/person', params: { id: r.client.id } } as any)} accessibilityRole="button">
          <Card style={{ borderLeftWidth: 5, borderLeftColor: colours.purple }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <TaliAvatar pose="head" size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text }}>Meeting {r.client.name.split(' ')[0]} at {r.time}</Text>
                <Text style={{ fontSize: 13, color: colours.muted, marginTop: 1 }} numberOfLines={1}>{r.title}</Text>
              </View>
            </View>
            {r.memories.length ? (
              r.memories.map((m) => (
                <View key={m.id} style={{ flexDirection: 'row', gap: space.sm, marginTop: 8, alignItems: 'flex-start' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colours.purple, marginTop: 8 }} />
                  <Text style={{ fontSize: 15, lineHeight: 22, color: colours.text, flex: 1 }}>{m.content}</Text>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 14, color: colours.muted, marginTop: 8, lineHeight: 20 }}>
                {r.client.notes ? r.client.notes : `Nothing in my memory about ${r.client.name.split(' ')[0]} yet. Tell me how it goes after.`}
              </Text>
            )}
            <Text style={{ fontSize: 13, color: colours.purple, fontWeight: '700', marginTop: space.md }}>Everything on {r.client.name.split(' ')[0]} {'›'}</Text>
          </Card>
        </Pressable>
        )
      ))}
      {compact ? (() => {
        const r = rows.find((x) => x.client.id === open);
        return (
          <Sheet visible={!!r} title={r ? `Meeting ${r.client.name.split(' ')[0]} at ${r.time}` : ''} sub={r?.title} onClose={() => setOpen(null)}>
            {r ? (
              <Card>
                {r.memories.length ? (
                  r.memories.map((m) => (
                    <View key={m.id} style={{ flexDirection: 'row', gap: space.sm, marginTop: 4, marginBottom: 4, alignItems: 'flex-start' }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colours.purple, marginTop: 8 }} />
                      <Text style={{ fontSize: 15, lineHeight: 22, color: colours.text, flex: 1 }}>{m.content}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ fontSize: 14, color: colours.muted, lineHeight: 20 }}>
                    {r.client.notes ? r.client.notes : `Nothing in my memory about ${r.client.name.split(' ')[0]} yet. Tell me how it goes after.`}
                  </Text>
                )}
                <Pressable onPress={() => { setOpen(null); router.navigate({ pathname: '/person', params: { id: r.client.id } } as any); }} accessibilityRole="button">
                  <Text style={{ fontSize: 14, color: colours.purple, fontWeight: '700', marginTop: space.md }}>Everything on {r.client.name.split(' ')[0]} {'›'}</Text>
                </Pressable>
              </Card>
            ) : null}
          </Sheet>
        );
      })() : null}
    </>
  );
}
