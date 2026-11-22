// 10 Nov 2026 (Taj): sign up starts with you, not the business. Tali is for your whole life, work
// included, so a business is asked about but never required.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { radius, space } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button, ErrorText, Field, Label, Screen } from '@/components/ui';
import { TaliAvatar } from '@/components/TaliAvatar';
import { BUSINESS_TYPES } from '@/constants/business';
import { ChipPicker } from '@/components/ChipPicker';
import { enablePush, pushSupported } from '@/lib/push';
import { TRACKER_PRESETS, goalLine, loadHq, hqState, materialise, saveLayout, useHq, type Block, type TrackerSpec } from '@/lib/widgets';
import { DIFFERENCE, PLATE, TEAM_SIZE, TEMPLATES, guessTracker, mergeBlocks, offeredTrackers, startingLayout, templateBlocks, type Answers } from '@/lib/hqTemplates';
import { MiniLayout } from '@/components/Widgets';
import { Sheet } from '@/components/Sheet';
import { TextInput } from 'react-native';

// 11 Nov 2026: a last step asks for notifications, since her briefs and nudges rely on them.
// Skipped where this device can't have them.
// 16 Nov 2026 (Taj): two more steps build their starting HQ, so nobody starts on a blank home:
// what they want to keep count of, then a look at the home it made (add and remove more later).
// 17 Nov 2026 (Taj): built for real. Business owners get two more questions (what would make the
// biggest difference, and is it just you), anyone who picks a tracker sets its target, the about-me
// question moves to just before the preview, and "Looks good" saves both homes. Every screen after
// the name can be skipped. Building the home here never uses credits or counts as a message.
type StepId = 'name' | 'plate' | 'work' | 'difference' | 'team' | 'count' | 'targets' | 'about' | 'hq' | 'push';
const chip = (on: boolean, colour = '#3B3F9E') => ({ paddingVertical: 11, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? colour : 'rgba(28,26,23,0.30)', backgroundColor: on ? colour : 'rgba(28,26,23,0.07)' });
const chipText = (on: boolean) => ({ color: on ? '#F5F0E6' : '#FFFFFF', fontWeight: '700' as const, fontSize: 15 });
const field = { backgroundColor: 'rgba(28,26,23,0.08)', borderWidth: 1, borderColor: 'rgba(28,26,23,0.30)', borderRadius: 12, color: '#1C1A17', fontSize: 16, paddingHorizontal: 14, paddingVertical: 11 } as const;

export default function Onboarding() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const hq = useHq();
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [aboutMe, setAboutMe] = useState('');
  const [plate, setPlate] = useState<string[]>([]);
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);
  const [difference, setDifference] = useState<string[]>([]);
  const [teamSize, setTeamSize] = useState('');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pushOn, setPushOn] = useState(false);
  const [pushNote, setPushNote] = useState('');
  const [tracks, setTracks] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<string, number | null>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<TrackerSpec[]>([]);
  const [customText, setCustomText] = useState('');
  const [tplOpen, setTplOpen] = useState(false);
  const [tplKeys, setTplKeys] = useState<string[]>([]);

  const biz = !!hasBusiness;
  const steps: StepId[] = ['name', 'plate', 'work', ...(biz ? (['difference', 'team'] as StepId[]) : []), 'count', ...(tracks.length || custom.length ? (['targets'] as StepId[]) : []), 'about', 'hq', ...(pushSupported ? (['push'] as StepId[]) : [])];
  const id = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;
  // Trackers to offer, from what they want a hand with (and the business ones if they run one).
  const offer = offeredTrackers(plate, biz ? difference : [], biz);
  const answers: Answers = { plate, hasBusiness: biz, businessType, difference: biz ? difference : [], teamSize: biz ? teamSize : '', trackers: tracks, targets, names, custom };
  const base = startingLayout(answers, hq.plan);
  // Templates they ticked on the preview are laid over the top: adds what is missing, no doubles.
  const withTemplates = (side: 'life' | 'business', blocks: Block[]) => tplKeys.reduce((acc, k) => {
    const t = TEMPLATES.find((x) => x.key === k);
    if (!t || (biz && t.home !== 'either' && t.home !== side) || (!biz && side === 'business')) return acc;
    return mergeBlocks(acc, templateBlocks(t, hq.plan, side, biz).blocks, (b) => b.spec?.name ?? null);
  }, blocks);
  const built = { life: withTemplates('life', base.life), business: biz ? withTemplates('business', base.business) : [] };

  // Their phone's own permission box only appears after this tap.
  async function turnOnPush() {
    setBusy(true);
    setPushNote('');
    const res = await enablePush();
    setBusy(false);
    if (res.ok) setPushOn(true);
    else setPushNote(res.message);
  }

  function addCustom() {
    const n = customText.trim();
    if (!n) return;
    const spec = guessTracker(n, custom.length + tracks.length);
    if (biz && /call|client|customer|quote|sale|revenue|lead|post|job|booking|invoice|review/i.test(n)) (spec as any).business = true;
    setCustom((c) => [...c.filter((x) => x.name.toLowerCase() !== spec.name.toLowerCase()), spec]);
    setCustomText('');
  }

  async function finish() {
    setError('');
    if (!firstName.trim()) return setError('What should I call you?');
    if (hasBusiness === null) return setError('Do you run a business, or is it just you?');
    if (hasBusiness && !businessType) return setError('Pick the closest match for your business.');
    if (!session) return;
    setBusy(true);
    let timezone = 'Australia/Sydney';
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone;
    } catch {}
    // Build both homes first, so Today opens on the home they were just shown. If this fails they
    // still get in: Today falls back to the standard home and they can build from Edit home.
    try {
      await loadHq(session.user.id);
      const plan = hqState().plan;
      const fresh = startingLayout(answers, plan);
      const life = tplKeys.length ? built.life : fresh.life;
      const business = tplKeys.length ? built.business : fresh.business;
      await saveLayout('life', await materialise('life', life));
      if (biz) await saveLayout('business', await materialise('business', business));
    } catch { /* the standard home shows instead */ }
    const knows = [
      plate.length ? `Wants a hand with: ${plate.join(', ').toLowerCase()}.` : '',
      biz && difference.length ? `Biggest difference right now: ${difference.join(', ').toLowerCase()}.` : '',
      biz && teamSize ? `Team: ${teamSize.toLowerCase()}.` : '',
      aboutMe.trim(),
    ].filter(Boolean).join(' ');
    const { error: err } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        business_name: hasBusiness ? businessName.trim() || null : null,
        business_type: hasBusiness ? businessType : null,
        has_business: hasBusiness,
        // What they want a hand with goes in with the rest of what Tali reads before every chat.
        about_me: knows || null,
        timezone,
        onboarded_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);
    if (err) {
      setBusy(false);
      return setError(err.message);
    }
    await refreshProfile();
  }

  // 10 Nov 2026: one question at a time in her sky, instead of one long form.
  function next() {
    setError('');
    if (id === 'name' && !firstName.trim()) return setError('What should I call you?');
    if (id === 'work' && hasBusiness === null) return setError('Do you run a business, or is it just you?');
    if (id === 'work' && hasBusiness && !businessType) return setError('Pick the closest match for your business.');
    if (!last) setStep(step + 1);
    else finish();
  }
  const name = firstName.trim();
  const Q = ({
    name: { kicker: 'FIRST THINGS FIRST', q: "G'day. What should I call you?", sub: "I'm Tali. I'm an AI with a brain that grows with you." },
    plate: { kicker: 'YOUR PLATE', q: `Nice to meet you${name ? `, ${name}` : ''}. What would you like a hand with?`, sub: 'Pick as many as you like. You can change it later.' },
    work: { kicker: 'YOUR WORK', q: 'Do you run a business?', sub: 'Either is fine. I look after your whole life, work included.' },
    difference: { kicker: 'YOUR BUSINESS', q: 'What would make the biggest difference right now?', sub: 'Pick up to two. They go at the top of your Business home.' },
    team: { kicker: 'YOUR TEAM', q: 'Is it just you, or do you have people?', sub: 'So your home fits how you work.' },
    count: { kicker: 'KEEPING COUNT', q: 'Anything you want to keep count of?', sub: 'Pick a few to start. You can add your own, or ask me to make one, any time.' },
    targets: { kicker: 'YOUR TARGETS', q: 'How much is a good day?', sub: 'I have filled in a sensible target for each. Change any of them.' },
    about: { kicker: 'ONE LAST THING', q: 'Anything I should know from day one?', sub: 'Optional. Everything you tell me becomes a memory in my brain.' },
    hq: { kicker: 'YOUR HQ', q: `Here's your HQ${name ? `, ${name}` : ''}.`, sub: 'Built from what you told me. Add, remove, move or resize anything later from Edit home.' },
    push: { kicker: 'STAYING IN TOUCH', q: 'Can I tap you on the shoulder?', sub: 'I work in the background. Notifications are how I tell you the things worth knowing.' },
  } as Record<StepId, { kicker: string; q: string; sub: string }>)[id];
  const STEPS = steps.length;
  const canSkip = id !== 'name' && id !== 'work' && id !== 'hq' && id !== 'push';

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: space.sm, marginBottom: space.xl }}>
        {Array.from({ length: STEPS }, (_, n) => n).map((n) => (
          <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= step ? '#3B3F9E' : 'rgba(28,26,23,0.18)' }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(59,63,158,0.18)', borderWidth: 1, borderColor: 'rgba(28,26,23,0.30)', shadowColor: '#000', shadowOpacity: 0, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } }}>
          <TaliAvatar pose="head" size={42} />
        </View>
        <Text style={{ color: '#3B3F9E', fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>{Q.kicker}  ·  {step + 1} OF {STEPS}</Text>
      </View>
      <Text style={{ color: '#1C1A17', fontSize: 34, lineHeight: 38, marginTop: space.md, fontFamily: 'EBGaramond_500Medium' }}>{Q.q}</Text>
      <Text style={{ color: 'rgba(28,26,23,0.75)', fontSize: 15, lineHeight: 21, marginTop: 8, marginBottom: space.lg }}>{Q.sub}</Text>

      {id === 'name' ? <Field label="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" onSubmitEditing={next} /> : null}

      {id === 'plate' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
          {PLATE.map((o) => {
            const on = plate.includes(o);
            return (
              <Pressable key={o} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setPlate((p) => (on ? p.filter((x) => x !== o) : [...p, o]))}
                style={{ paddingVertical: 11, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? '#3B3F9E' : 'rgba(28,26,23,0.30)', backgroundColor: on ? '#3B3F9E' : 'rgba(28,26,23,0.07)' }}>
                <Text style={{ color: on ? '#F5F0E6' : '#FFFFFF', fontWeight: '700', fontSize: 15 }}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {id === 'work' ? (
        <>
          <ChipPicker options={['Yes', 'No, just me'] as const} value={hasBusiness === null ? null : hasBusiness ? 'Yes' : 'No, just me'} onChange={(v) => setHasBusiness(v === 'Yes')} />
          {hasBusiness ? (
            <>
              <Field label="Business name (optional)" value={businessName} onChangeText={setBusinessName} />
              <Label>What kind of business</Label>
              <ChipPicker options={BUSINESS_TYPES} value={businessType || null} onChange={setBusinessType} />
            </>
          ) : null}
        </>
      ) : null}

      {id === 'difference' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
          {DIFFERENCE.map((o) => {
            const on = difference.includes(o);
            return (
              <Pressable key={o} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setDifference((d) => (on ? d.filter((x) => x !== o) : d.length >= 2 ? [d[1], o] : [...d, o]))} style={chip(on, '#A8561A')}>
                <Text style={chipText(on)}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {id === 'team' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
          {TEAM_SIZE.map((o) => {
            const on = teamSize === o;
            return (
              <Pressable key={o} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setTeamSize(o)} style={chip(on, '#A8561A')}>
                <Text style={chipText(on)}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {id === 'about' ? (
        <Field
          label="Tell me in your own words"
          value={aboutMe}
          onChangeText={setAboutMe}
          multiline
          maxLength={1000}
          placeholder="For example: I'm hopeless at follow-ups, I want to be in bed by ten, and Mum's birthday is in December."
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
      ) : null}

      {id === 'count' ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
            {offer.map((k) => {
              const p = TRACKER_PRESETS[k], on = tracks.includes(k);
              return (
                <Pressable key={k} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setTracks((t) => (on ? t.filter((x) => x !== k) : [...t, k]))}
                  style={[chip(on, p.colour), { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? '#F5F0E6' : p.colour }} />
                  <Text style={chipText(on)}>{p.name}</Text>
                </Pressable>
              );
            })}
            {custom.map((c) => (
              <Pressable key={c.name} accessibilityLabel={`Remove ${c.name}`} onPress={() => setCustom((cs) => cs.filter((x) => x.name !== c.name))} style={[chip(true, c.colour), { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <Text style={chipText(true)}>{c.name}</Text>
                <Text style={{ color: '#F5F0E6', fontWeight: '800' }}>×</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: '#3B3F9E', fontWeight: '700', fontSize: 13, marginBottom: 6 }}>Something else</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: space.md }}>
            <TextInput value={customText} onChangeText={setCustomText} onSubmitEditing={addCustom} maxLength={60} placeholder="Pages written, km run, sales calls..." placeholderTextColor="rgba(28,26,23,0.45)" style={[field, { flex: 1 }]} accessibilityLabel="Something else to keep count of" />
            <Pressable onPress={addCustom} accessibilityRole="button" style={{ paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(28,26,23,0.30)' }}>
              <Text style={{ color: '#3B3F9E', fontWeight: '800' }}>+ Add</Text>
            </Pressable>
          </View>
          {hq.plan === 'free' && tracks.length + custom.length > 3 ? <Text style={{ color: '#A8561A', fontSize: 13, marginBottom: space.md }}>Free fits 3 trackers on a home. I'll put the first 3 on and keep the rest for when you want them.</Text> : null}
        </>
      ) : null}

      {id === 'targets' ? (
        <View style={{ marginBottom: space.md, gap: 10 }}>
          {tracks.map((k) => {
            const p = TRACKER_PRESETS[k];
            const noTarget = p.type === 'scale' || (p.type === 'yesno' && !p.target);
            const renamable = k === 'savings' || k === 'family';
            return (
              <View key={k} style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(28,26,23,0.18)', backgroundColor: '#FFFDF8', padding: 12 }}>
                {renamable ? (
                  <TextInput value={names[k] ?? p.name} onChangeText={(v) => setNames((n) => ({ ...n, [k]: v }))} maxLength={60} style={[field, { paddingVertical: 7, fontSize: 15, fontWeight: '700', marginBottom: 8 }]} accessibilityLabel={`Name for ${p.name}`} />
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.colour }} />
                  <Text numberOfLines={1} style={{ flex: 1, color: '#1C1A17', fontWeight: '800', fontSize: 15 }}>{renamable ? 'Target' : p.name}</Text>
                  {noTarget ? <Text style={{ color: 'rgba(28,26,23,0.7)', fontSize: 13 }}>{goalLine(p)}</Text> : (
                    <>
                      <TextInput value={targets[k] === undefined ? String(p.target ?? '') : targets[k] === null ? '' : String(targets[k])} onChangeText={(v) => setTargets((t) => ({ ...t, [k]: v.trim() === '' ? null : Number(v.replace(/,/g, '')) || null }))} keyboardType="numeric" style={[field, { width: 92, paddingVertical: 7, textAlign: 'right' }]} accessibilityLabel={`${p.name} target`} />
                      <Text style={{ width: 74, color: 'rgba(28,26,23,0.7)', fontSize: 12.5 }}>{p.type === 'money' ? 'A$' : p.unit} {p.period === 'total' ? 'in total' : `a ${p.period}`}</Text>
                    </>
                  )}
                </View>
                {renamable ? <Text style={{ color: 'rgba(28,26,23,0.55)', fontSize: 12, marginTop: 6 }}>{k === 'savings' ? 'Call it what it is: Holiday fund, New ute, Emergency fund.' : 'Make it yours: Called Dad, Date night, Coffee with a mate.'}</Text> : null}
              </View>
            );
          })}
          {custom.map((c, i) => (
            <View key={c.name} style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(28,26,23,0.18)', backgroundColor: '#FFFDF8', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.colour }} />
              <Text numberOfLines={1} style={{ flex: 1, color: '#1C1A17', fontWeight: '800', fontSize: 15 }}>{c.name}</Text>
              {c.type === 'scale' || (c.type === 'yesno' && !c.target) ? <Text style={{ color: 'rgba(28,26,23,0.7)', fontSize: 13 }}>{goalLine(c)}</Text> : (
                <>
                  <TextInput value={c.target == null ? '' : String(c.target)} onChangeText={(v) => setCustom((cs) => cs.map((x, n) => (n === i ? { ...x, target: Number(v.replace(/,/g, '')) || null } : x)))} keyboardType="numeric" style={[field, { width: 92, paddingVertical: 7, textAlign: 'right' }]} accessibilityLabel={`${c.name} target`} />
                  <Text style={{ width: 74, color: 'rgba(28,26,23,0.7)', fontSize: 12.5 }}>{c.type === 'money' ? 'A$' : c.unit} {c.period === 'total' ? 'in total' : `a ${c.period}`}</Text>
                </>
              )}
            </View>
          ))}
        </View>
      ) : null}

      {id === 'hq' ? (
        <View style={{ marginBottom: space.lg }}>
          {biz ? <Text style={{ color: '#3B3F9E', fontSize: 12, fontWeight: '800', letterSpacing: 1.6, marginBottom: 8 }}>YOUR LIFE HOME</Text> : null}
          <View style={{ borderRadius: 22, padding: 12, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: 'rgba(59,63,158,0.25)' }}>
            <MiniLayout widgets={built.life} blank />
          </View>
          {base.from.life.length ? <Text style={{ color: 'rgba(28,26,23,0.6)', fontSize: 12.5, marginTop: 6 }}>Built from: {base.from.life.join(', ')}</Text> : null}
          {biz ? (<>
            <Text style={{ color: '#A8561A', fontSize: 12, fontWeight: '800', letterSpacing: 1.6, marginTop: space.md, marginBottom: 8 }}>YOUR BUSINESS HOME</Text>
            <View style={{ borderRadius: 22, padding: 12, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: 'rgba(255,181,97,0.5)' }}>
              <MiniLayout widgets={built.business} blank />
            </View>
            {base.from.business.length ? <Text style={{ color: 'rgba(28,26,23,0.6)', fontSize: 12.5, marginTop: 6 }}>Built from: {base.from.business.join(', ')}</Text> : null}
          </>) : null}
          {hq.plan === 'free' ? <Text style={{ color: 'rgba(28,26,23,0.6)', fontSize: 12.5, marginTop: 8 }}>Free fits 6 blocks and 3 trackers on a home. Anything past that waits in Edit home.</Text> : null}
          <Pressable onPress={() => setTplOpen(true)} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: space.md }}>
            <Text style={{ color: '#3B3F9E', fontWeight: '800', fontSize: 15 }}>{tplKeys.length ? `Templates added: ${tplKeys.map((k) => TEMPLATES.find((t) => t.key === k)?.name).join(', ')}. Change ›` : 'Start from a template ›'}</Text>
          </Pressable>
        </View>
      ) : null}

      {id === 'push' ? (
        <>
          {[
            ['Your morning brief', 'One note a day with what needs you.'],
            ['Reminders you asked for', 'Only the ones you set or said yes to.'],
            ['Things worth knowing', 'Like when an invoice gets paid.'],
          ].map(([t, d]) => (
            <View key={t} style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(28,26,23,0.18)', backgroundColor: '#FFFDF8', padding: 14, marginBottom: 10 }}>
              <Text style={{ color: '#1C1A17', fontWeight: '800', fontSize: 15 }}>{t}</Text>
              <Text style={{ color: 'rgba(28,26,23,0.75)', fontSize: 13, marginTop: 2 }}>{d}</Text>
            </View>
          ))}
          {pushOn ? (
            <Text style={{ color: '#2E8A63', fontWeight: '700', marginBottom: space.md }}>Notifications are on.</Text>
          ) : (
            <Button title="Turn on notifications" onPress={turnOnPush} busy={busy} />
          )}
          {pushNote ? <Text style={{ color: 'rgba(28,26,23,0.8)', fontSize: 13, lineHeight: 19, marginBottom: space.md }}>{pushNote}</Text> : null}
          <Text style={{ color: 'rgba(28,26,23,0.6)', fontSize: 13, marginBottom: space.md }}>Change it any time in Settings. I never send marketing.</Text>
        </>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button title={last ? (id === 'push' && !pushOn ? 'Not now, meet Tali' : 'Meet Tali') : id === 'hq' ? 'Looks good' : 'Next'} kind={id === 'push' && !pushOn ? 'ghost' : 'primary'} onPress={next} busy={busy && id !== 'push'} />
      {canSkip && !last ? <Button title="Skip" kind="ghost" onPress={() => { setError(''); setStep(step + 1); }} disabled={busy} /> : null}
      {step > 0 ? <Button title="Back" kind="ghost" onPress={() => { setError(''); setStep(step - 1); }} disabled={busy} /> : null}
      {/* 4 Nov 2026: a way out if this isn't your account (shared device, wrong email). */}
      {step === 0 ? <Button title="Not you? Sign out" kind="ghost" onPress={signOut} disabled={busy} /> : null}

      <Sheet visible={tplOpen} title="Start from a template" sub="Tick any that fit. They add to what I built from your answers." onClose={() => setTplOpen(false)}>
        <View style={{ gap: 8 }}>
          {TEMPLATES.filter((t) => biz || t.home !== 'business').map((t) => {
            const on = tplKeys.includes(t.key);
            return (
              <Pressable key={t.key} onPress={() => setTplKeys((k) => (on ? k.filter((x) => x !== t.key) : [...k, t.key]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: on ? 'rgba(59,63,158,0.22)' : '#FFFDF8', borderWidth: 1, borderColor: on ? '#3B3F9E' : 'rgba(28,26,23,0.18)' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1C1A17', fontWeight: '800' }}>{t.name}</Text>
                  <Text style={{ color: '#ABA4D0', fontSize: 12 }}>{t.desc}</Text>
                </View>
                <Text style={{ color: '#3B3F9E', fontWeight: '800' }}>{on ? 'Added' : 'Add'}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ height: space.md }} />
        <Button title="Done" onPress={() => setTplOpen(false)} />
      </Sheet>
    </Screen>
  );
}
