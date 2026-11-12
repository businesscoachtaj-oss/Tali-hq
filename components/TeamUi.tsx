// 12 Nov 2026 (Taj): shared pieces for team seats and more than one business
// (Your team, Work given to you, Which business). Same look as the rest of the business tools.
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Bar, BLUE, Pill, type Icon } from '@/components/Biz';
import { router } from 'expo-router';
import { claimInvites, myWork, SEATS, type Seat, type Work } from '@/lib/team';
import { colours, radius, space } from '@/constants/theme';

export const GREEN = '#7FE0B0';
export const ORANGE = '#FFB561';
const PALETTE = [BLUE, GREEN, ORANGE, '#FF8A7E', '#9FE8FF', '#D7B5FF'];
/** A steady colour for a person, from their id, so they look the same on every screen. */
export const colourFor = (id: string) => PALETTE[[...id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTE.length];

export function Face({ name, colour = colours.purple, size = 40 }: { name: string; colour?: string; size?: number }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colour + '33', borderWidth: 1, borderColor: colour + '99', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colour, fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

export function Toggle({ icon, title, sub, on, onChange, locked, first }: { icon: Icon; title: string; sub: string; on: boolean; onChange?: (v: boolean) => void; locked?: boolean; first?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: colours.border }}>
      <Ionicons name={icon} size={20} color={on ? BLUE : colours.faint} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colours.text, fontSize: 15, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{sub}</Text>
      </View>
      {locked
        ? <Pill text="Always" colour={GREEN} />
        : <Switch value={on} onValueChange={onChange} accessibilityLabel={title} trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" {...({ activeThumbColor: '#FFFFFF' } as object)} />}
    </View>
  );
}

export const Group = ({ children }: { children: ReactNode }) => (
  <View style={{ backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, paddingHorizontal: 14, marginBottom: space.md }}>{children}</View>
);

export const Note = ({ icon, children }: { icon: Icon; children: ReactNode }) => (
  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colours.sunk, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, padding: 12, marginBottom: space.md }}>
    <Ionicons name={icon} size={17} color={colours.faint} style={{ marginTop: 1 }} />
    <Text style={{ flex: 1, color: colours.muted, fontSize: 13, lineHeight: 19 }}>{children}</Text>
  </View>
);

export const Who = ({ name, colour = colours.purple }: { name: string; colour?: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <Face name={name} colour={colour} size={22} />
    <Text style={{ color: colours.muted, fontSize: 12.5, fontWeight: '700' }}>{name.trim().split(/\s+/)[0]}</Text>
  </View>
);

/** Standard or Premium. Each seat has its own Tali credits. */
export function SeatPick({ value, onChange, disabled }: { value: Seat; onChange: (s: Seat) => void; disabled?: boolean }) {
  const opts: { id: Seat; colour: string }[] = [{ id: 'standard', colour: BLUE }, { id: 'premium', colour: ORANGE }];
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: space.md }}>
      {opts.map((o) => {
        const on = o.id === value;
        const s = SEATS[o.id];
        return (
          <Pressable key={o.id} onPress={disabled || on ? undefined : () => onChange(o.id)} accessibilityRole="button" accessibilityState={{ selected: on, disabled: !!disabled }}
            style={{ flex: 1, backgroundColor: on ? o.colour + '22' : colours.surface, borderRadius: radius.card, borderWidth: on ? 2 : 1, borderColor: on ? o.colour : colours.border, padding: 12, opacity: disabled ? 0.6 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: colours.text, fontSize: 14.5, fontWeight: '800', flexShrink: 1 }}>{s.label}</Text>
              {on ? <Ionicons name="checkmark-circle" size={18} color={o.colour} /> : null}
            </View>
            <Text style={{ color: o.colour, fontSize: 13, fontWeight: '800', marginTop: 6 }}>A${s.price.toFixed(2)} a month</Text>
            <Text style={{ color: colours.muted, fontSize: 12, marginTop: 4, lineHeight: 16 }}>{s.credits.toLocaleString('en-AU')} Tali credits a month{o.id === 'premium' ? ', for heavy use' : ''}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Usage({ used, of, colour }: { used: number; of: number; colour: string }) {
  const hot = of > 0 && used / of > 0.9;
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '600' }}>Tali credits this month</Text>
        <Text style={{ color: hot ? colours.danger : colours.muted, fontSize: 12, fontWeight: '700' }}>{used.toLocaleString('en-AU')} of {of.toLocaleString('en-AU')}</Text>
      </View>
      <Bar pct={of ? (used / of) * 100 : 0} colour={hot ? colours.danger : colour} />
    </View>
  );
}

// ── Today: the card a teammate sees ─────────────────────────────────────────────────────

/**
 * Shown on Today to anyone who has been added to a team: how much work they have been given,
 * and the way in to it. It also picks up a waiting invite the first time it runs. Draws nothing
 * for everyone else, and a failure here never touches the rest of Today.
 */
export function TeamWorkCard() {
  const [teams, setTeams] = useState<Work[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await claimInvites();
        const w = await myWork();
        if (alive) setTeams(w);
      } catch { /* not on a team, or offline */ }
    })();
    return () => { alive = false; };
  }, []);
  if (!teams.length) return null;
  const jobs = teams.reduce((a, t) => a + t.jobs.filter((j) => j.status === 'accepted' || j.status === 'on').length, 0);
  const tasks = teams.reduce((a, t) => a + t.tasks.filter((x) => !x.done_at).length, 0);
  const name = teams.length === 1 ? teams[0].business : `${teams.length} teams`;
  return (
    <Pressable onPress={() => router.navigate('/work')} accessibilityRole="button" accessibilityLabel={`Work from ${name}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: BLUE + '80', borderLeftWidth: 5, borderLeftColor: BLUE, padding: 14, marginBottom: space.md }}>
      <Ionicons name="hammer-outline" size={22} color={BLUE} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colours.text, fontSize: 16, fontWeight: '800' }}>Work from {name}</Text>
        <Text style={{ color: colours.muted, fontSize: 13, marginTop: 2 }}>{jobs} {jobs === 1 ? 'job' : 'jobs'} on · {tasks} {tasks === 1 ? 'task' : 'tasks'} to do</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colours.faint} />
    </Pressable>
  );
}
