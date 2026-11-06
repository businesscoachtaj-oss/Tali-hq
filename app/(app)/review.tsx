// Weekly review (3 Nov 2026). Tali HQ and Pro (and the trial), 3 credits. Tali pulls the week
// together section by section, then you set your three for next week. Past weeks at the bottom.
import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { myCredits, type Credits } from '@/lib/data';
import { isPaid } from '@/lib/plan';
import { addDays, isoDate } from '@/lib/dates';
import { commitmentsFor, reviewFor, reviewWeekStart, reviews as loadReviews, rhythmSettings, runReview, saveCommitments, weekLabel, type Commitment, type Review } from '@/lib/rhythm';
import { BackLink, Body, Button, Card, ErrorText, Label, Loading, Screen, TaliSays, Title } from '@/components/ui';
import { SkinHeader } from '@/components/PageSkin';
import { colours, radius, space } from '@/constants/theme';

const nextWeekOf = (weekStart: string) => isoDate(addDays(new Date(`${weekStart}T12:00:00`), 7));

export default function ReviewScreen() {
  const { profile } = useAuth();
  const [ready, setReady] = useState(false);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [weekStart, setWeekStart] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const [nextCommitments, setNextCommitments] = useState<Commitment[]>([]);
  const [past, setPast] = useState<Review[]>([]);
  const [viewing, setViewing] = useState<Review | null>(null);
  const [three, setThree] = useState<string[]>(['', '', '']);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // 4 Nov 2026: Tali's suggestions only fill the three while they're still empty, so a tab switch
  // doesn't wipe what you were typing.
  const threeRef = useRef(three);
  threeRef.current = three;

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([myCredits().catch(() => null), rhythmSettings()]);
      setCredits(c);
      const ws = reviewWeekStart(s.review_day);
      setWeekStart(ws);
      if (isPaid(c)) {
        const [r, list] = await Promise.all([reviewFor(ws), loadReviews()]);
        setReview(r);
        setPast(list.filter((x) => x.week_start !== ws));
        if (r) {
          const cm = await commitmentsFor(nextWeekOf(ws));
          setNextCommitments(cm);
          if (!cm.length && threeRef.current.every((t) => !t.trim())) {
            setThree([r.content.suggested_commitments[0] ?? '', r.content.suggested_commitments[1] ?? '', r.content.suggested_commitments[2] ?? '']);
          }
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your review.');
    } finally {
      setReady(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function doReview() {
    setError('');
    setBusy(true);
    const res = await runReview();
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setReview(res.review);
    setWeekStart(res.week_start);
    const s = res.review.content.suggested_commitments;
    setThree([s[0] ?? '', s[1] ?? '', s[2] ?? '']);
  }

  async function saveThree() {
    setError('');
    if (!three.some((t) => t.trim())) return setError('Put at least one thing down for next week.');
    setSaving(true);
    try {
      await saveCommitments(nextWeekOf(weekStart), three);
      setNextCommitments(await commitmentsFor(nextWeekOf(weekStart)));
    } catch (e: any) {
      setError(e?.message ?? 'Could not save those.');
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <Loading />;
  const name = profile?.first_name || 'mate';

  if (!isPaid(credits)) {
    return (
      <Screen skin="planner" onRefresh={load}>
        <SkinHeader id="planner" title="Weekly review" sub="Ten minutes a week with Tali on what moved, what slipped and what's next." onBack={() => router.navigate('/')} backLabel="Today" />
        <TaliSays pose="think">The weekly review is part of Tali HQ. I pull your week together, money and quiet clients included, and we set your three for next week.</TaliSays>
        <Button title="See plans" onPress={() => router.navigate('/plans')} />
      </Screen>
    );
  }

  // Read only view of a past week.
  if (viewing) {
    return (
      <Screen skin="planner" onRefresh={load}>
        <SkinHeader id="planner" title="Weekly review" sub={`Week of ${weekLabel(viewing.week_start)}`} onBack={() => setViewing(null)} backLabel="This week" />
        <ReviewBody review={viewing} />
        <PastCommitments weekStart={nextWeekOf(viewing.week_start)} />
      </Screen>
    );
  }

  return (
    <Screen skin="planner" onRefresh={load}>
      <SkinHeader id="planner" title="Weekly review" sub={`Week of ${weekLabel(weekStart)}`} onBack={() => router.navigate('/')} backLabel="Today" />

      {!review ? (
        <>
          <TaliSays pose="think">
            Ready when you are, {name}. I'll go through what moved, the money, who went quiet, and how last week's three went. Then we set the next three.
          </TaliSays>
          <ErrorText>{error}</ErrorText>
          <Button title={busy ? 'Pulling your week together' : 'Do my weekly review'} onPress={doReview} busy={busy} />
          <Text style={{ fontSize: 12, color: colours.faint, textAlign: 'center', marginTop: 6 }}>3 credits. Takes about ten seconds.</Text>
        </>
      ) : (
        <>
          <ReviewBody review={review} />

          <View style={{ height: space.sm }} />
          <Label>Your three for next week</Label>
          {nextCommitments.length ? (
            <Card style={{ borderLeftWidth: 5, borderLeftColor: colours.good }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text, marginBottom: 4 }}>Locked in for the week of {weekLabel(nextWeekOf(weekStart))}</Text>
              {nextCommitments.map((c, i) => (
                <View key={c.id} style={{ flexDirection: 'row', gap: space.sm, paddingVertical: 4 }}>
                  <Text style={{ color: colours.purple, fontWeight: '800', width: 18 }}>{i + 1}</Text>
                  <Text style={{ fontSize: 15, lineHeight: 22, color: colours.text, flex: 1 }}>{c.text}</Text>
                </View>
              ))}
              <Text style={{ fontSize: 12, color: colours.faint, marginTop: space.sm }}>They're on Today all week with tick boxes. Tali checks in on them in your brief.</Text>
            </Card>
          ) : (
            <>
              <Card style={{ paddingVertical: space.sm }}>
                {three.map((line, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colours.border }}>
                    <Text style={{ color: colours.purple, fontWeight: '800', width: 18, fontSize: 15 }}>{i + 1}</Text>
                    <TextInput
                      value={line}
                      onChangeText={(v) => setThree((t) => t.map((x, j) => (j === i ? v : x)))}
                      placeholder="Something doable this week"
                      placeholderTextColor={colours.faint}
                      maxLength={200}
                      multiline
                      style={{ flex: 1, fontSize: 15, color: colours.text, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colours.sunk, borderRadius: radius.input }}
                    />
                  </View>
                ))}
              </Card>
              <Text style={{ fontSize: 12, color: colours.faint, marginTop: -4 }}>Tali's suggestions. Change anything, they're yours.</Text>
              <ErrorText>{error}</ErrorText>
              <Button title="Save my three" onPress={saveThree} busy={saving} />
            </>
          )}
        </>
      )}

      {past.length ? (
        <>
          <View style={{ height: space.xl }} />
          <Label>Past weeks</Label>
          <Card style={{ paddingVertical: space.xs }}>
            {past.map((r, i) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                onPress={() => setViewing(r)}
                style={{ paddingVertical: space.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colours.border }}>
                <Text style={{ fontSize: 12, color: colours.muted, fontWeight: '700' }}>{weekLabel(r.week_start)}</Text>
                <Text style={{ fontSize: 15, color: colours.text, marginTop: 2 }}>{r.content.headline || 'Your week'}</Text>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

// Tali presents the review, section by section.
function ReviewBody({ review }: { review: Review }) {
  const c = review.content;
  return (
    <>
      {c.headline ? <Text style={{ fontSize: 20, fontWeight: '800', color: colours.text, lineHeight: 27, marginTop: -space.sm, marginBottom: space.md }}>{c.headline}</Text> : null}
      {c.tali_says ? <TaliSays pose="idle">{c.tali_says}</TaliSays> : null}
      <Section title="What moved" items={c.moved} empty="Not much moved this week, and that's allowed." colour={colours.good} />
      <Label>Money</Label>
      <Card>
        <Body>{c.money || 'No money to report this week.'}</Body>
      </Card>
      <Section title="Gone quiet" items={c.quiet} empty="Nobody's gone quiet. Nice." colour={colours.orange} />
      <Label>Last week's three</Label>
      <Card>
        {c.kept.length + c.missed.length === 0 ? <Body muted>No commitments were set last week. This week's three start below.</Body> : null}
        {c.kept.map((k, i) => (
          <Row key={`k${i}`} text={k} mark="✓" colour={colours.good} />
        ))}
        {c.missed.map((m, i) => (
          <Row key={`m${i}`} text={m} mark="○" colour={colours.muted} />
        ))}
      </Card>
    </>
  );
}

function Section({ title, items, empty, colour }: { title: string; items: string[]; empty: string; colour: string }) {
  return (
    <>
      <Label>{title}</Label>
      <Card>
        {items.length ? items.map((t, i) => <Row key={i} text={t} mark="•" colour={colour} />) : <Body muted>{empty}</Body>}
      </Card>
    </>
  );
}

function Row({ text, mark, colour }: { text: string; mark: string; colour: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, paddingVertical: 3, alignItems: 'flex-start' }}>
      <Text style={{ color: colour, fontWeight: '800', width: 16, fontSize: 15, lineHeight: 22 }}>{mark}</Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: colours.text, flex: 1 }}>{text}</Text>
    </View>
  );
}

// The commitments that followed a past review, read only.
function PastCommitments({ weekStart }: { weekStart: string }) {
  const [rows, setRows] = useState<Commitment[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      commitmentsFor(weekStart).then(setRows).catch(() => setRows([]));
    }, [weekStart]),
  );
  if (!rows?.length) return null;
  return (
    <>
      <Label>The three that followed</Label>
      <Card>
        {rows.map((c) => (
          <Row key={c.id} text={c.text} mark={c.done_at ? '✓' : '○'} colour={c.done_at ? colours.good : colours.muted} />
        ))}
      </Card>
    </>
  );
}
