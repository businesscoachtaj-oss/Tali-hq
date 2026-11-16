// components/TeamHome.tsx
// ADDED (17 Nov 2026, Taj): a teammate's team home. The owner builds one layout per business and
// pushes it out. Blocks the owner set stay put (a small pin, and the teammate can fold them shut).
// Suggested blocks can be taken off. A block the seat is not allowed to see never arrives here:
// the database leaves it out. The owner never sees a teammate's own blocks or trackers.
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colours, space } from '@/constants/theme';
import { BUILTINS, saveLayout, teamWidgets, useHq, widgetTitle, type Block, type TeamHome, type Widget } from '@/lib/widgets';
import { useBoard } from '@/lib/hqBoard';
import { ExtraTile, TrackerTile } from '@/components/Widgets';
import { BlockLabel, BookingsBlock, CashflowBlock, HappinessBlock, LeadsBlock, QuoteRateBlock, TeamBlock, VisitsBlock } from '@/components/HqBlocks';

export function TeamHomeSection({ team, tick }: { team: TeamHome; tick: number }) {
  const hq = useHq();
  const key = `team:${team.owner_id}`;
  const mine = hq.layouts[key];
  const widgets = teamWidgets(team, mine, hq.trackers);
  const { board } = useBoard(widgets.some((w) => w.kind === 'builtin'), team.owner_id, 'all', tick);
  const shut = (id: string) => !!mine?.find((b) => b.id === id)?.hidden;
  const hiddenCount = team.blocks.filter((b) => b.pin !== 'pinned' && shut(b.id)).length;
  const set = (id: string, hidden: boolean) => {
    const rest = (mine ?? []).filter((b) => b.id !== id);
    const next: Block[] = hidden ? [...rest, { id, kind: 'builtin', size: 'wide', hidden: true }] : rest;
    saveLayout(key, next).catch(() => {});
  };
  if (!team.blocks.length) return null;

  const body = (w: Widget) => {
    if (w.kind !== 'builtin') return null;
    if (!board || board.locked) return null;
    switch (w.builtin) {
      case 'team': return <TeamBlock board={board} />;
      case 'leads': return <LeadsBlock board={board} />;
      case 'cashflow': return <CashflowBlock board={board} />;
      case 'bookings': return <BookingsBlock board={board} />;
      case 'visits': return <VisitsBlock board={board} />;
      case 'quote_rate': return <QuoteRateBlock board={board} />;
      case 'happiness': return <HappinessBlock board={board} onChanged={() => {}} canEdit={false} />;
      default: return null;
    }
  };

  return (
    <View style={{ marginTop: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="people" size={14} color="#7FA8FF" />
        <Text style={{ flex: 1, color: '#7FA8FF', fontSize: 12, fontWeight: '800', letterSpacing: 1.6 }}>{team.business.toUpperCase()} TEAM HOME</Text>
        {hiddenCount ? (
          <Pressable onPress={() => saveLayout(key, (mine ?? []).filter((b) => team.blocks.find((t) => t.id === b.id)?.pin === 'pinned')).catch(() => {})} hitSlop={8}>
            <Text style={{ color: colours.purple, fontSize: 12.5, fontWeight: '700' }}>Bring back {hiddenCount}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginTop: space.sm }}>
        {widgets.map((w) => {
          const pinned = w.pin === 'pinned';
          const folded = pinned && shut(w.id);
          const control = (
            <Pressable onPress={() => set(w.id, !shut(w.id))} hitSlop={10} accessibilityRole="button" accessibilityLabel={pinned ? (folded ? `Open ${widgetTitle(w)}` : `Fold ${widgetTitle(w)} shut`) : `Take ${widgetTitle(w)} off my home`}>
              <Ionicons name={pinned ? (folded ? 'chevron-down' : 'chevron-up') : 'close'} size={15} color={colours.faint} />
            </Pressable>
          );
          if (w.kind === 'tracker' && !folded) return <TrackerTile key={w.id} w={w} />;
          if (w.kind === 'extra' && !folded) return <ExtraTile key={w.id} w={w} />;
          const inner = folded ? null : body(w);
          if (w.kind === 'builtin' && !folded && !inner) return null;
          return (
            <View key={w.id} style={{ width: '100%' }}>
              <BlockLabel pin={pinned} right={control}>{w.kind === 'builtin' ? BUILTINS[w.builtin!].title : widgetTitle(w)}</BlockLabel>
              {inner}
            </View>
          );
        })}
      </View>
    </View>
  );
}
