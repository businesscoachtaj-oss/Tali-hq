// 23 Nov 2026 (Taj): "weeks you lived vs weeks you have left". Every week of an average Australian life
// as a small square, the ones you have lived filled in ink, this week in indigo, the rest blank. A new
// square fills in every week. Opt in: nothing shows until you add your birthday, and you can take it off.
//
// The birthday lives in profiles.birth_date (migration 20261123000094_birth_date.sql). It is read on its
// own here, not in the profile everyone loads, so the app keeps working if the column is not there yet.
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { supabase } from '@/lib/supabase';
import { colours, radius, space } from '@/constants/theme';

// ABS life tables 2021 to 2023: 81.1 years for men and 85.1 for women at birth. About 83 on average.
const YEARS = 83;
const COLS = 52;
const WEEK_MS = 7 * 86400000;

function parseBirthday(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1900 || dt.getTime() > Date.now()) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Weeks lived, counted the way the grid fills: one row per year of life, 52 squares a row. */
function weeksLived(birth: string, now = new Date()): number {
  const b = new Date(`${birth}T00:00:00`);
  let years = now.getFullYear() - b.getFullYear();
  const thisYearBday = new Date(now.getFullYear(), b.getMonth(), b.getDate());
  if (now < thisYearBday) years -= 1;
  const lastBday = new Date(b.getFullYear() + years, b.getMonth(), b.getDate());
  const weeks = Math.min(COLS - 1, Math.floor((now.getTime() - lastBday.getTime()) / WEEK_MS));
  return years * COLS + weeks;
}

// 23 Nov 2026 (Taj: "a more philosophical, insightful tone and narrative"). One reflection a week, in
// Tali's voice, turning over as the new square fills in. Paraphrased ideas only, no quotes.
const THOUGHTS = [
  "Seneca thought life was long enough, if you knew how to use it. Most of it slips by while we wait for some other week to begin. The indigo square is the only one you can do anything with.",
  "Every filled square held a Monday you probably can't remember, and a few hold days you'll never forget. You don't get to pick which weeks become the ones that matter. You do get to keep showing up for them.",
  "A whole life fits on one page. Seen like this, a single week is a real piece of it, big enough to start something and small enough to waste without noticing.",
  "Marcus Aurelius wrote reminders to himself that his time was short, so he would live that day better. This page is the same reminder, drawn in squares.",
  "Most weeks look alike from the outside. The ones that change a life usually turn on something small: one honest conversation, one decision made, one hour spent on the thing you keep putting off.",
  "The filled squares are spent and the blank ones are promised to no one. What you have is this week, and that has always been enough to change the direction of the next.",
  "When people look back on long lives, they rarely talk about what they owned. They talk about who was there and what they made. Those are built a week at a time, starting with this one.",
  "You won't remember most of this week. The people you spend it with might. That is a good enough reason to spend some of it on them.",
];
const thoughtFor = (lived: number) => THOUGHTS[lived % THOUGHTS.length];

const Grid = memo(function Grid({ lived, cell, gap }: { lived: number; cell: number; gap: number }) {
  const rows = [];
  for (let r = 0; r < YEARS; r++) {
    const cells = [];
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const bg = i < lived ? colours.ink : i === lived ? colours.purple : '#E3DACA';
      cells.push(<View key={c} style={{ width: cell, height: cell, backgroundColor: bg, marginRight: c === COLS - 1 ? 0 : gap }} />);
    }
    rows.push(
      <View key={r} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: gap }}>
        <Text style={{ width: 18, height: cell, fontSize: 8, lineHeight: cell + 1, color: colours.faint, textAlign: 'right', marginRight: 4, overflow: 'visible' }}>{r % 10 === 0 ? r : ''}</Text>
        {cells}
      </View>,
    );
  }
  return <View>{rows}</View>;
});

export function WeeksOfLife() {
  const { width } = useWindowDimensions();
  // null: still loading. '': no birthday yet. 'missing': the column is not there yet, so stay hidden.
  const [birth, setBirth] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data, error } = await supabase.from('profiles').select('birth_date').eq('id', u.user.id).maybeSingle();
      if (error) { setBirth('missing'); return; }
      setBirth((data as { birth_date: string | null } | null)?.birth_date ?? '');
    })();
  }, []);

  const save = useCallback(async (value: string | null) => {
    setErr(null);
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').update({ birth_date: value }).eq('id', u.user?.id ?? '');
    setBusy(false);
    if (error) { setErr("That didn't save. Try again in a moment."); return; }
    setBirth(value ?? '');
    setDraft('');
  }, []);

  const avail = Math.min(width, 640) - space.lg * 2 - space.md * 2 - 22;
  const gap = 1;
  const cell = Math.max(3, Math.floor((avail - gap * (COLS - 1)) / COLS));
  const lived = useMemo(() => (birth && birth !== 'missing' ? weeksLived(birth) : 0), [birth]);

  if (birth === null || birth === 'missing') return null;

  const total = YEARS * COLS;
  const left = Math.max(0, total - lived);
  return (
    <View style={{ backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.ink, borderRadius: radius.card, padding: space.md, marginBottom: space.lg }}>
      <Text style={{ color: colours.purple, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 }}>YOUR LIFE IN WEEKS</Text>
      {birth ? (
        <>
          <Text style={{ color: colours.text, fontSize: 23, lineHeight: 29, marginTop: 6, fontFamily: 'EBGaramond_500Medium' }}>
            {left > 0
              ? `${lived.toLocaleString('en-AU')} weeks behind you. Roughly ${left.toLocaleString('en-AU')} ahead, if yours runs to the average.`
              : `${lived.toLocaleString('en-AU')} weeks behind you, more than the average life is given. Every one from here is a gift.`}
          </Text>
          <Text style={{ color: colours.text, fontSize: 17, lineHeight: 25, marginTop: 10, fontFamily: 'EBGaramond_400Regular_Italic' }}>{thoughtFor(lived)}</Text>
          <Text style={{ color: colours.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginTop: 6 }}>TALI</Text>
          <View style={{ marginTop: space.md }}>
            <Grid lived={lived} cell={cell} gap={gap} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm }}>
            <Text style={{ color: colours.faint, fontSize: 11.5, lineHeight: 16, flex: 1, marginRight: 12 }}>Each square is a week, one row for every year. The indigo one is now, and it fills in on its own next week. Based on an average Australian life of about {YEARS} years.</Text>
            <Pressable onPress={() => save(null)} hitSlop={8} accessibilityRole="button" disabled={busy}>
              <Text style={{ color: colours.muted, fontSize: 12, textDecorationLine: 'underline' }}>Take it off</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={{ color: colours.text, fontSize: 23, lineHeight: 29, marginTop: 6, fontFamily: 'EBGaramond_500Medium' }}>Your whole life fits on one page.</Text>
          <Text style={{ color: colours.text, fontSize: 17, lineHeight: 25, marginTop: 8, fontFamily: 'EBGaramond_400Regular_Italic' }}>About four thousand weeks, if it runs to the average. Add your birthday and the ones you've lived fill in, with the rest left blank. It can be hard to look at. It's also one of the clearest pictures of time there is, and a quiet reason to spend this week well.</Text>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <TextInput value={draft} onChangeText={setDraft} placeholder="DD/MM/YYYY" placeholderTextColor={colours.faint} keyboardType="numbers-and-punctuation" maxLength={10} accessibilityLabel="Your birthday"
              style={{ flex: 1, borderWidth: 1, borderColor: colours.ink, borderRadius: radius.input, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colours.text, backgroundColor: colours.bg }} />
            <Pressable onPress={() => { const v = parseBirthday(draft); if (!v) { setErr('Use day, month and year, like 14/03/1990.'); return; } void save(v); }} disabled={busy} accessibilityRole="button"
              style={{ backgroundColor: colours.ink, borderRadius: radius.pill, paddingHorizontal: 16, justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
              <Text style={{ color: colours.bg, fontWeight: '800', fontSize: 12, letterSpacing: 1.2 }}>SHOW ME</Text>
            </Pressable>
          </View>
          <Text style={{ color: colours.faint, fontSize: 11.5, marginTop: 8 }}>Only you see this. Tali doesn't use your birthday for anything else.</Text>
        </>
      )}
      {err ? <Text style={{ color: colours.danger, fontSize: 12.5, marginTop: 6 }}>{err}</Text> : null}
    </View>
  );
}
