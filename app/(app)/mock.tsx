// MOCKUP ONLY, 12 Nov 2026. Not for merge. Team seats and more than one business, drawn with the
// app's own pieces (Screen, Head, Box, Line, Pill, Chips, Stats, TaliLine) so Taj can see how they
// would look before anything is built. Every name and number here is made up.
//   /mock?v=team | invite | person | jobs | job | mate | switch | all | customers | customer | invoices | add
import { type ReactNode } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { Button, Field, Label, Screen } from '@/components/ui';
import { Amount, aud, Bar, BLUE, Box, Chips, H, Head, Line, Next, Pill, Stats, Sub, TaliLine, type Icon } from '@/components/Biz';
import { colours, radius, space } from '@/constants/theme';

const GREEN = '#7FE0B0';
const ORANGE = '#FFB561';
const LAND = { name: 'Coastline Landscapes', short: 'Landscapes', colour: BLUE };
const POOL = { name: 'Coastline Pools', short: 'Pools', colour: GREEN };

function Face({ name, colour = colours.purple, size = 40 }: { name: string; colour?: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colour + '33', borderWidth: 1, borderColor: colour + '99', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colour, fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}
function Toggle({ icon, title, sub, on, locked, first }: { icon: Icon; title: string; sub: string; on: boolean; locked?: boolean; first?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: colours.border }}>
      <Ionicons name={icon} size={20} color={on ? BLUE : colours.faint} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colours.text, fontSize: 15, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{sub}</Text>
      </View>
      {locked ? <Pill text="Always" colour={GREEN} /> : <Switch value={on} onValueChange={() => {}} trackColor={{ true: colours.purple, false: colours.borderStrong }} thumbColor="#FFFFFF" {...({ activeThumbColor: '#FFFFFF' } as object)} />}
    </View>
  );
}
const Group = ({ children }: { children: ReactNode }) => (
  <View style={{ backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, paddingHorizontal: 14, marginBottom: space.md }}>{children}</View>
);
const Note = ({ icon, children }: { icon: Icon; children: ReactNode }) => (
  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colours.sunk, borderRadius: radius.card, borderWidth: 1, borderColor: colours.border, padding: 12, marginBottom: space.md }}>
    <Ionicons name={icon} size={17} color={colours.faint} style={{ marginTop: 1 }} />
    <Text style={{ flex: 1, color: colours.muted, fontSize: 13, lineHeight: 19 }}>{children}</Text>
  </View>
);
const Who = ({ name, colour = colours.purple }: { name: string; colour?: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <Face name={name} colour={colour} size={22} />
    <Text style={{ color: colours.muted, fontSize: 12.5, fontWeight: '700' }}>{name.split(' ')[0]}</Text>
  </View>
);
const Tag = ({ b }: { b: { short: string; colour: string } }) => <Pill text={b.short} colour={b.colour} />;
/** The pill at the top of a screen that says which business you are in. */
function BusinessPill({ label, colour, all }: { label: string; colour: string; all?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colours.surface, borderWidth: 1, borderColor: colour + '99', marginBottom: 4 }}>
      <Ionicons name={all ? 'albums-outline' : 'business-outline'} size={15} color={colour} />
      <Text style={{ color: colours.text, fontSize: 13.5, fontWeight: '800' }}>{label}</Text>
      <Ionicons name="chevron-down" size={14} color={colours.muted} />
    </View>
  );
}

/** Seat level: each seat has its own Tali allowance. Premium is for heavy users. Prices are proposals. */
function SeatPick({ value }: { value: 'standard' | 'premium' }) {
  const opts = [
    { id: 'standard', name: 'Standard seat', price: 'A$19.99 a month', sub: '1,000 Tali credits a month', colour: BLUE },
    { id: 'premium', name: 'Premium seat', price: 'A$49.99 a month', sub: '3,000 Tali credits a month, for heavy use', colour: ORANGE },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: space.md }}>
      {opts.map((o) => {
        const on = o.id === value;
        return (
          <View key={o.id} style={{ flex: 1, backgroundColor: on ? o.colour + '22' : colours.surface, borderRadius: radius.card, borderWidth: on ? 2 : 1, borderColor: on ? o.colour : colours.border, padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: colours.text, fontSize: 14.5, fontWeight: '800' }}>{o.name}</Text>
              {on ? <Ionicons name="checkmark-circle" size={18} color={o.colour} /> : null}
            </View>
            <Text style={{ color: o.colour, fontSize: 13, fontWeight: '800', marginTop: 6 }}>{o.price}</Text>
            <Text style={{ color: colours.muted, fontSize: 12, marginTop: 4, lineHeight: 16 }}>{o.sub}</Text>
          </View>
        );
      })}
    </View>
  );
}
function Usage({ used, of, colour }: { used: number; of: number; colour: string }) {
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ color: colours.muted, fontSize: 12, fontWeight: '600' }}>Tali credits this month</Text>
        <Text style={{ color: used / of > 0.9 ? colours.danger : colours.muted, fontSize: 12, fontWeight: '700' }}>{used.toLocaleString('en-AU')} of {of.toLocaleString('en-AU')}</Text>
      </View>
      <Bar pct={(used / of) * 100} colour={used / of > 0.9 ? colours.danger : colour} />
    </View>
  );
}

// ───────────────────────────── Team seats ─────────────────────────────

function Team() {
  const people = [
    { name: 'Sam Carter', role: 'You', access: 'Owner', colour: colours.purple, line: 'Sees everything', seat: '', used: 0, of: 0 },
    { name: 'Jess Tran', role: 'Leading hand', access: 'Jobs, customers', colour: BLUE, line: '4 jobs · 6 tasks this week', seat: 'Premium seat', used: 1840, of: 3000 },
    { name: 'Dan Okafor', role: 'Apprentice', access: 'Jobs and tasks only', colour: GREEN, line: '2 jobs · 5 tasks this week', seat: 'Standard seat', used: 960, of: 1000 },
    { name: 'Priya Shah', role: 'Bookkeeper', access: 'Invoices and money', colour: ORANGE, line: 'Invite sent 2 days ago', seat: 'Standard seat', used: 0, of: 1000 },
  ];
  return (
    <Screen>
      <Head over="Business" title="Your team" sub="Give someone a job or a task and they see just that. You choose what else each person can see." />
      <Stats items={[{ label: 'seats in use', value: '3' }, { label: 'jobs given out', value: '6', colour: BLUE }, { label: 'seats a month', value: 'A$89.97', colour: ORANGE }]} />
      <TaliLine>Dan has nearly used his Tali credits for the month. A Premium seat would cover him, or he waits until the 1st.</TaliLine>
      {people.map((p) => (
        <Box key={p.name} onPress={() => {}}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Face name={p.name} colour={p.colour} />
            <View style={{ flex: 1 }}>
              <H>{p.name}</H>
              <Sub>{p.role} · {p.line}</Sub>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colours.faint} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Pill text={p.access} colour={p.colour} />
            {p.seat ? <Pill text={p.seat} colour={p.seat.startsWith('Premium') ? ORANGE : colours.faint} /> : null}
          </View>
          {p.of ? <Usage used={p.used} of={p.of} colour={p.colour} /> : null}
        </Box>
      ))}
      <Button title="Invite a teammate" onPress={() => {}} />
      <View style={{ height: 12 }} />
      <Note icon="lock-closed-outline">Nobody on your team sees your journal, your Life side, or what Tali remembers about you. That stays yours.</Note>
    </Screen>
  );
}

function Invite() {
  return (
    <Screen>
      <Head back="Your team" to="/mock?v=team" over="New teammate" title="Invite someone" sub="They get their own login. You can change what they see at any time." />
      <Field label="Their name" value="Dan Okafor" onChangeText={() => {}} />
      <Field label="Their email" value="dan@example.com" onChangeText={() => {}} autoCapitalize="none" />
      <Field label="What they do (optional)" value="Apprentice" onChangeText={() => {}} />
      <Label>Their seat</Label>
      <SeatPick value="standard" />
      <Label>What they can see</Label>
      <Group>
        <Toggle first locked on icon="hammer-outline" title="Jobs and tasks you give them" sub="The job, where it is, what to do and when. Nothing else about the customer." />
        <Toggle on={false} icon="people-outline" title="Customers" sub="Names, phone numbers and notes for every customer." />
        <Toggle on={false} icon="pricetag-outline" title="Quotes and prices" sub="What each job is quoted at. Off means prices are hidden on their jobs." />
        <Toggle on={false} icon="cash-outline" title="Invoices and money" sub="Invoices, what is owed and the bookkeeping pack." />
        <Toggle on={false} icon="funnel-outline" title="Pipeline and bookings" sub="New enquiries, and who is booked in." />
      </Group>
      <Note icon="sparkles-outline">Dan gets his own Tali and his own credits. She only knows what Dan is allowed to see. You can move him to Premium later.</Note>
      <Button title="Send the invite" onPress={() => {}} />
      <Button title="Not now" kind="ghost" onPress={() => {}} />
    </Screen>
  );
}

function Person() {
  return (
    <Screen>
      <Head back="Your team" to="/mock?v=team" over="Leading hand · On the team since March" title="Jess Tran" sub="4 jobs and 6 tasks this week. She sees her own jobs, plus what you switch on below." />
      <Stats items={[{ label: 'jobs on now', value: '4', colour: BLUE }, { label: 'tasks open', value: '6', colour: ORANGE }, { label: 'done this month', value: '9', colour: GREEN }]} />
      <Label>Her seat</Label>
      <SeatPick value="premium" />
      <Box>
        <H>Tali use this month</H>
        <Usage used={1840} of={3000} colour={BLUE} />
        <Sub>Resets on the 1st. Her credits are hers, they do not come out of yours.</Sub>
      </Box>
      <Label>What Jess can see</Label>
      <Group>
        <Toggle first locked on icon="hammer-outline" title="Jobs and tasks you give her" sub="Always on. It is how she gets her work." />
        <Toggle on icon="people-outline" title="Customers" sub="She can look up a customer and add a note." />
        <Toggle on={false} icon="pricetag-outline" title="Quotes and prices" sub="Prices are hidden on her jobs." />
        <Toggle on={false} icon="cash-outline" title="Invoices and money" sub="She cannot see what is owed or paid." />
        <Toggle on icon="funnel-outline" title="Pipeline and bookings" sub="She can see who is booked in." />
      </Group>
      <Label>On her plate</Label>
      <Group>
        <Line first icon="hammer-outline" title="Retaining wall and steps" sub="Hall family · on now · due Friday" right={<Pill text="On now" colour={BLUE} />} />
        <Line icon="hammer-outline" title="Front garden makeover" sub="Mia Torres · starts Monday" right={<Pill text="Accepted" colour={GREEN} />} />
        <Line icon="checkbox-outline" title="Order sandstone for the Hall job" sub="Task · due tomorrow" colour={ORANGE} />
      </Group>
      <Button title="Give Jess a job" onPress={() => {}} />
      <Button title="Remove from the team" kind="danger" onPress={() => {}} />
    </Screen>
  );
}

function JobsMock() {
  const rows = [
    { title: 'Retaining wall and steps', sub: 'Hall family · Q-0027', total: 8400, status: 'On now', colour: BLUE, who: 'Jess Tran', whoColour: BLUE, pct: 60, next: 'Jess ticked off the footings yesterday. Sandstone arrives Thursday.' },
    { title: 'Front garden makeover', sub: 'Mia Torres · Q-0031', total: 3250, status: 'Accepted', colour: GREEN, who: 'Jess Tran', whoColour: BLUE, pct: 35, next: null },
    { title: 'Hedge and tidy before sale', sub: 'Priya Shah · Q-0029', total: 640, status: 'On now', colour: BLUE, who: 'Dan Okafor', whoColour: GREEN, pct: 80, next: null },
    { title: 'Pool surround paving', sub: 'Jordan Pike · Q-0033', total: 5200, status: 'Quote sent', colour: ORANGE, who: null, whoColour: '', pct: 0, next: 'Nobody is on this one yet. Give it to someone once Jordan says yes.' },
  ];
  return (
    <Screen>
      <Head over="Business" title="Jobs and quotes" sub="A quote becomes a job, and a job becomes an invoice. Each one shows who is on it." />
      <Stats items={[{ label: 'quotes out', value: aud(5200), colour: ORANGE }, { label: 'jobs on now', value: '3' }, { label: 'not given out', value: '1', colour: colours.danger }]} />
      <Button title="New quote" onPress={() => {}} />
      <View style={{ height: 12 }} />
      <Chips options={['Everyone', 'Me', 'Jess', 'Dan', 'Not given out']} value="Everyone" onChange={() => {}} />
      {rows.map((j) => (
        <Box key={j.title} onPress={() => {}}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}><H>{j.title}</H><Sub>{j.sub}</Sub></View>
            <Amount>{aud(j.total)}</Amount>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <Pill text={j.status} colour={j.colour} />
            {j.who ? <Who name={j.who} colour={j.whoColour} /> : <Text style={{ color: colours.danger, fontSize: 12.5, fontWeight: '700' }}>Nobody on it</Text>}
          </View>
          {j.pct ? <View style={{ marginTop: 10 }}><Bar pct={j.pct} colour={j.colour} /></View> : null}
          {j.next ? <Next>{j.next}</Next> : null}
        </Box>
      ))}
    </Screen>
  );
}

function JobMock() {
  const tasks = [
    { t: 'Mark out and dig footings', who: 'Jess Tran', c: BLUE, done: true },
    { t: 'Order sandstone', who: 'Jess Tran', c: BLUE, done: false, due: 'Due tomorrow' },
    { t: 'Lay the first two courses', who: 'Dan Okafor', c: GREEN, done: false, due: 'Thursday' },
    { t: 'Check drainage behind the wall', who: 'Sam Carter', c: colours.purple, done: false, due: 'Friday' },
  ];
  return (
    <Screen>
      <Head back="Jobs and quotes" to="/mock?v=jobs" over="Q-0027 · On now" title="Retaining wall and steps" sub="Hall family, 4 Ridge Road, Jan Juc. Due Friday." />
      <Label>Who is on it</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md }}>
        {[{ n: 'Jess Tran', c: BLUE, on: true }, { n: 'Dan Okafor', c: GREEN, on: true }, { n: 'Sam Carter', c: colours.purple, on: false }].map((p) => (
          <Pressable key={p.n} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.pill, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, backgroundColor: p.on ? p.c + '26' : colours.sunk, borderWidth: 1, borderColor: p.on ? p.c + '99' : colours.border }}>
            <Face name={p.n} colour={p.c} size={26} />
            <Text style={{ color: p.on ? colours.text : colours.muted, fontSize: 13.5, fontWeight: '700' }}>{p.n.split(' ')[0]}</Text>
            {p.on ? <Ionicons name="checkmark" size={14} color={p.c} /> : null}
          </Pressable>
        ))}
      </View>
      <Note icon="eye-outline">Jess and Dan see this job, the address and the tasks. They do not see the A$8,400 quote or the Hall family's other jobs.</Note>
      <Label>Tasks</Label>
      <Group>
        {tasks.map((x, i) => (
          <View key={x.t} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
            <Ionicons name={x.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={x.done ? GREEN : colours.faint} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: x.done ? colours.faint : colours.text, fontSize: 15, fontWeight: '600', textDecorationLine: x.done ? 'line-through' : 'none' }}>{x.t}</Text>
              {x.due ? <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 1 }}>{x.due}</Text> : null}
            </View>
            <Who name={x.who} colour={x.c} />
          </View>
        ))}
      </Group>
      <Button title="Add a task" kind="ghost" onPress={() => {}} />
      <Button title="The job is done" onPress={() => {}} />
    </Screen>
  );
}

function Mate() {
  return (
    <Screen>
      <View style={{ marginTop: 6, marginBottom: 18 }}>
        <Text style={{ color: BLUE, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>COASTLINE LANDSCAPES</Text>
        <Text style={{ color: '#F4F1FF', fontSize: 42, lineHeight: 46, marginTop: 6, fontFamily: 'InstrumentSerif_400Regular' }}>Morning, Dan</Text>
        <Text style={{ color: '#B9B2D9', fontSize: 15, lineHeight: 22, marginTop: 8 }}>Two jobs and three tasks today. This is everything Sam has given you.</Text>
      </View>
      <TaliLine>Start with the hedge at Priya's, she is home until 10. The sandstone for the Hall job lands Thursday.</TaliLine>
      <Label>Your jobs</Label>
      <Box onPress={() => {}}>
        <H>Hedge and tidy before sale</H>
        <Sub>Priya Shah · 18 Beach Road, Torquay</Sub>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <Pill text="On now" colour={BLUE} />
          <Text style={{ color: colours.muted, fontSize: 12.5, fontWeight: '700' }}>Today, 8am</Text>
        </View>
        <View style={{ marginTop: 10 }}><Bar pct={80} colour={BLUE} /></View>
      </Box>
      <Box onPress={() => {}}>
        <H>Retaining wall and steps</H>
        <Sub>Hall family · 4 Ridge Road, Jan Juc</Sub>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <Pill text="On now" colour={BLUE} />
          <Who name="Jess Tran" colour={BLUE} />
        </View>
      </Box>
      <Label>Your tasks</Label>
      <Group>
        <Line first icon="ellipse-outline" colour={colours.faint} title="Trim and shape the front hedge" sub="Hedge and tidy · today" />
        <Line icon="ellipse-outline" colour={colours.faint} title="Green waste to the tip" sub="Hedge and tidy · today" />
        <Line icon="ellipse-outline" colour={colours.faint} title="Lay the first two courses" sub="Retaining wall · Thursday" />
      </Group>
      <Note icon="lock-closed-outline">Prices, invoices and other customers are hidden. Ask Sam if you need to see more.</Note>
    </Screen>
  );
}

// ───────────────────────────── More than one business ─────────────────────────────

function Switcher() {
  const Row = ({ icon, colour, title, sub, on, first }: { icon: Icon; colour: string; title: string; sub: string; on?: boolean; first?: boolean }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, borderTopWidth: first ? 0 : 1, borderTopColor: colours.border }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colour + '26', borderWidth: 1, borderColor: colour + '80', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={20} color={colour} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colours.text, fontSize: 16, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: colours.muted, fontSize: 12.5, marginTop: 2 }}>{sub}</Text>
      </View>
      {on ? <Ionicons name="checkmark-circle" size={22} color={colour} /> : null}
    </View>
  );
  return (
    <Screen>
      <Head over="Business" title="Which business?" sub="Each one keeps its own customers, jobs and invoices. Pick one, or see them together." />
      <BusinessPill label={LAND.name} colour={LAND.colour} />
      <View style={{ height: 12 }} />
      <Group>
        <Row first on icon="leaf-outline" colour={LAND.colour} title={LAND.name} sub="14 customers · 3 jobs on now · A$1,240 owed to you" />
        <Row icon="water-outline" colour={POOL.colour} title={POOL.name} sub="6 customers · 1 job on now · A$3,900 owed to you" />
        <Row icon="albums-outline" colour={colours.purple} title="All businesses" sub="Everything together, each item tagged with its business" />
      </Group>
      <Button title="Add a business" kind="ghost" onPress={() => {}} />
      <View style={{ height: 12 }} />
      <Note icon="sparkles-outline">Tali knows both. Ask her "what is owed across both businesses" and she adds them up.</Note>
    </Screen>
  );
}

function AllBusinesses() {
  const Biz = ({ b, lines, owed }: { b: typeof LAND; lines: [string, string][]; owed: number }) => (
    <Box edge={b.colour} onPress={() => {}}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}><H>{b.name}</H></View>
        <Amount colour={GREEN}>{aud(owed)}</Amount>
      </View>
      <Sub>owed to you</Sub>
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        {lines.map(([v, l], i) => (
          <View key={l} style={{ flex: 1, borderLeftWidth: i ? 1 : 0, borderLeftColor: colours.border, paddingLeft: i ? 12 : 0 }}>
            <Text style={{ color: colours.text, fontSize: 18, fontWeight: '800' }}>{v}</Text>
            <Text style={{ color: colours.muted, fontSize: 11.5, fontWeight: '600', marginTop: 1 }}>{l}</Text>
          </View>
        ))}
      </View>
    </Box>
  );
  return (
    <Screen>
      <View style={{ marginTop: 6 }}><BusinessPill all label="All businesses" colour={colours.purple} /></View>
      <View style={{ marginBottom: 18, marginTop: 10 }}>
        <Text style={{ color: BLUE, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>THURSDAY 12 NOVEMBER</Text>
        <Text style={{ color: '#F4F1FF', fontSize: 42, lineHeight: 46, marginTop: 6, fontFamily: 'InstrumentSerif_400Regular' }}>Both businesses</Text>
        <Text style={{ color: '#B9B2D9', fontSize: 15, lineHeight: 22, marginTop: 8 }}>Four jobs on, two quotes out and A$5,140 owed to you across the two.</Text>
      </View>
      <Stats items={[{ label: 'owed to you', value: aud(5140), colour: GREEN }, { label: 'jobs on now', value: '4' }, { label: 'quotes out', value: aud(11800), colour: ORANGE }]} />
      <TaliLine>Pools is owed more than Landscapes this week. The Pike invoice is 9 days late, want me to draft a nudge?</TaliLine>
      <Biz b={LAND} owed={1240} lines={[['3', 'jobs on now'], ['A$5,200', 'quotes out'], ['14', 'customers']]} />
      <Biz b={POOL} owed={3900} lines={[['1', 'job on now'], ['A$6,600', 'quotes out'], ['6', 'customers']]} />
      <Label>Needs you today</Label>
      <Group>
        <Line first icon="cash-outline" colour={ORANGE} title="Jordan Pike is 9 days late" sub="INV-0044 · A$3,900" right={<Tag b={POOL} />} />
        <Line icon="hammer-outline" title="Sandstone lands Thursday" sub="Retaining wall and steps" right={<Tag b={LAND} />} />
        <Line icon="funnel-outline" colour={GREEN} title="New enquiry from the website" sub="Mia Torres, pool fence" right={<Tag b={POOL} />} />
      </Group>
    </Screen>
  );
}

function Customers() {
  const rows = [
    { name: 'Jordan Pike', sub: 'Pool surround paving, and a new pool fence', tags: [LAND, POOL], note: 'A$3,900 owed' },
    { name: 'Hall family', sub: 'Retaining wall and steps, on now', tags: [LAND], note: '' },
    { name: 'Mia Torres', sub: 'Front garden makeover, and asked about a pool fence', tags: [LAND, POOL], note: 'New enquiry' },
    { name: 'Priya Shah', sub: 'Hedge and tidy before sale', tags: [LAND], note: '' },
    { name: 'Okoro Constructions', sub: 'Two pool installs this year', tags: [POOL], note: '' },
  ];
  return (
    <Screen>
      <View style={{ marginTop: 6 }}><BusinessPill all label="All businesses" colour={colours.purple} /></View>
      <View style={{ height: 6 }} />
      <Head back="Today" over="Business" title="Customers" sub="One list across both businesses. A customer in both shows both tags." />
      <Stats items={[{ label: 'customers', value: '18' }, { label: 'in both', value: '2', colour: colours.purple }, { label: 'owe you', value: '3', colour: ORANGE }]} />
      <Chips options={['All', 'Landscapes', 'Pools', 'In both']} value="All" onChange={() => {}} />
      {rows.map((c) => (
        <Box key={c.name} onPress={() => {}}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Face name={c.name} colour={c.tags.length > 1 ? colours.purple : c.tags[0].colour} />
            <View style={{ flex: 1 }}><H>{c.name}</H><Sub>{c.sub}</Sub></View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            {c.tags.map((t) => <Tag key={t.short} b={t} />)}
            <View style={{ flex: 1 }} />
            {c.note ? <Text style={{ color: c.note.includes('owed') ? ORANGE : GREEN, fontSize: 12.5, fontWeight: '700' }}>{c.note}</Text> : null}
          </View>
        </Box>
      ))}
    </Screen>
  );
}

function Customer() {
  return (
    <Screen>
      <Head back="Customers" to="/mock?v=customers" over="Customer · In both businesses" title="Jordan Pike" sub="0400 000 000 · jordan@example.com. One person, one set of notes, work in two businesses." />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: space.md }}><Tag b={LAND} /><Tag b={POOL} /></View>
      <TaliLine>Jordan pays Landscapes on time but the Pools invoice is 9 days late. Same person, so one friendly message covers it.</TaliLine>
      <Box edge={LAND.colour}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}><H>{LAND.name}</H></View><Amount colour={GREEN}>Paid up</Amount></View>
        <View style={{ height: 6 }} />
        <Line first icon="hammer-outline" title="Pool surround paving" sub="Q-0033 · quote sent · A$5,200" colour={LAND.colour} />
        <Line icon="receipt-outline" title="INV-0038 · A$1,150" sub="Garden tidy · paid 2 weeks ago" colour={LAND.colour} right={<Pill text="Paid" colour={GREEN} />} />
      </Box>
      <Box edge={POOL.colour}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}><H>{POOL.name}</H></View><Amount colour={ORANGE}>{aud(3900)} owed</Amount></View>
        <View style={{ height: 6 }} />
        <Line first icon="hammer-outline" title="New pool fence" sub="P-0012 · done" colour={POOL.colour} />
        <Line icon="receipt-outline" title="INV-0044 · A$3,900" sub="Pool fence · 9 days late" colour={POOL.colour} right={<Pill text="Late" colour={ORANGE} />} />
      </Box>
      <Label>Notes</Label>
      <Group>
        <Line first icon="document-text-outline" colour={colours.faint} title="Prefers a text over a call" sub="Shared across both businesses" />
        <Line icon="document-text-outline" colour={colours.faint} title="Side gate code is 4471" sub="Shared across both businesses" />
      </Group>
      <Button title="Ask Tali to draft the nudge" onPress={() => {}} />
    </Screen>
  );
}

function Invoices() {
  const rows = [
    { n: 'INV-0044', who: 'Jordan Pike', what: 'Pool fence', total: 3900, state: '9 days late', colour: ORANGE, b: POOL },
    { n: 'INV-0041', who: 'Hall family', what: 'Retaining wall, deposit', total: 840, state: 'Due Friday', colour: BLUE, b: LAND },
    { n: 'INV-0040', who: 'Priya Shah', what: 'Hedge and tidy', total: 400, state: 'Due in 6 days', colour: BLUE, b: LAND },
    { n: 'INV-0039', who: 'Okoro Constructions', what: 'Pool install, stage 2', total: 6200, state: 'Paid Monday', colour: GREEN, b: POOL },
  ];
  return (
    <Screen>
      <View style={{ marginTop: 6 }}><BusinessPill all label="All businesses" colour={colours.purple} /></View>
      <View style={{ height: 6 }} />
      <Head back="Today" over="Business" title="Invoices" sub="Each business keeps its own numbers, ABN and bank details. Here they are side by side." />
      <Stats items={[{ label: 'owed to you', value: aud(5140), colour: GREEN }, { label: 'late', value: aud(3900), colour: ORANGE }, { label: 'paid this month', value: aud(14600) }]} />
      <Chips options={['All', 'Landscapes', 'Pools']} value="All" onChange={() => {}} />
      {rows.map((r) => (
        <Box key={r.n} edge={r.b.colour} onPress={() => {}}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}><H>{r.who}</H><Sub>{r.n} · {r.what}</Sub></View>
            <Amount>{aud(r.total)}</Amount>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <Pill text={r.state} colour={r.colour} />
            <Tag b={r.b} />
          </View>
        </Box>
      ))}
      <Button title="New invoice" onPress={() => {}} />
    </Screen>
  );
}

function AddBusiness() {
  return (
    <Screen>
      <Head back="Which business?" to="/mock?v=switch" over="New business" title="Add a business" sub="It gets its own customers, jobs, invoices and website. You switch between them at the top of the screen." />
      <Field label="What is it called" value="Coastline Pools" onChangeText={() => {}} />
      <Field label="What does it do" value="Pool fencing and pool surrounds" onChangeText={() => {}} />
      <Field label="ABN (optional)" value="" placeholder="For its invoices" onChangeText={() => {}} />
      <Label>Its colour</Label>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: space.md }}>
        {[BLUE, GREEN, ORANGE, '#FF8A7E', colours.purple].map((c) => (
          <View key={c} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, borderWidth: 3, borderColor: c === GREEN ? '#FFFFFF' : 'transparent' }} />
        ))}
      </View>
      <Label>Start it off with</Label>
      <Group>
        <Toggle first on icon="people-outline" title="Customers you already have" sub="Pick who also belongs here. They stay in Landscapes too, with one set of notes." />
        <Toggle on icon="people-circle-outline" title="The same team" sub="Jess, Dan and Priya keep the access you gave them, in this business as well." />
        <Toggle on={false} icon="receipt-outline" title="The same invoice details" sub="Off means this business has its own ABN, bank details and invoice numbers." />
      </Group>
      <Button title="Add Coastline Pools" onPress={() => {}} />
    </Screen>
  );
}

export default function Mock() {
  const { v } = useLocalSearchParams<{ v?: string }>();
  switch (v) {
    case 'invite': return <Invite />;
    case 'person': return <Person />;
    case 'jobs': return <JobsMock />;
    case 'job': return <JobMock />;
    case 'mate': return <Mate />;
    case 'switch': return <Switcher />;
    case 'all': return <AllBusinesses />;
    case 'customers': return <Customers />;
    case 'customer': return <Customer />;
    case 'invoices': return <Invoices />;
    case 'add': return <AddBusiness />;
    default: return <Team />;
  }
}
