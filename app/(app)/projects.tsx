// 12 Nov 2026 (Taj): Projects. The bigger pieces of work, each with its tasks. Part of the Business plans.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { myCredits, type Credits } from '@/lib/data';
import { addTask, allTasks, deleteProject, deleteTask, projects as loadProjects, saveProject, tickTask, type Project, type ProjectTask } from '@/lib/projects';
import { parseDue } from '@/lib/world';
import { friendlyDate, today } from '@/lib/dates';
import { hasBusinessTools } from '@/lib/plan';
import { ChipPicker } from '@/components/ChipPicker';
import { Button, ErrorText, Field, Label, Loading, Screen, useConfirm } from '@/components/ui';
import { Bar, BLUE, Box, H, Head, Pill, Stats, Sub } from '@/components/Biz';
import { BizLock } from '@/components/BizLock';
import { colours } from '@/constants/theme';

const STATE: Record<Project['status'], string> = { active: 'On the go', paused: 'Paused', done: 'Done' };
function health(p: Project, tasks: ProjectTask[]): { text: string; colour: string } {
  if (p.status === 'done') return { text: 'Done', colour: '#D7B5FF' };
  if (p.status === 'paused') return { text: 'Paused', colour: colours.muted };
  const open = tasks.filter((t) => !t.done_at).length;
  if (p.due_date && p.due_date < today() && open) return { text: 'Past its date', colour: '#FF8A7E' };
  if (!tasks.length) return { text: 'No tasks yet', colour: '#FFB561' };
  if (!open) return { text: 'All ticked', colour: '#7FE0B0' };
  return { text: 'On the go', colour: BLUE };
}

export default function Projects() {
  const { session } = useAuth();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [list, setList] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(''); const [who, setWho] = useState(''); const [due, setDue] = useState(''); const [notes, setNotes] = useState('');
  const [task, setTask] = useState(''); const [taskWho, setTaskWho] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { armed, confirm } = useConfirm();

  const load = useCallback(async () => {
    setError('');
    try {
      const c = await myCredits();
      setCredits(c);
      if (hasBusinessTools(c, session?.user.id)) {
        const [p, t] = await Promise.all([loadProjects(), allTasks()]);
        setList(p); setTasks(t);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your projects.');
    }
    setLoaded(true);
  }, [session?.user.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!loaded) return <Screen><Loading /></Screen>;
  if (!hasBusinessTools(credits, session?.user.id)) {
    return <BizLock title="Projects" sub="The bigger pieces of work. Tasks, dates and notes for each one in the same place."
      points={[{ icon: 'albums-outline', title: 'One page per project', sub: 'What it is, who it is for, when it is due' }, { icon: 'checkbox-outline', title: 'Tasks with names on them', sub: 'Who is doing what, ticked as you go' }, { icon: 'trending-up-outline', title: 'See what is slipping', sub: 'Anything past its date stands out' }]} />;
  }

  async function run(work: () => Promise<void>, fail: string) {
    setError(''); setBusy(true);
    try { await work(); await load(); } catch (e: any) { setError(e?.message ?? fail); }
    setBusy(false);
  }
  const of = (id: string) => tasks.filter((t) => t.project_id === id);
  const p = list.find((x) => x.id === openId) ?? null;
  const dueDate = () => { if (!due.trim()) return null; const d = parseDue(due); if (!d) throw new Error('I could not read that date. Try 29 Nov or 29/11.'); return d; };

  if (creating || p) {
    const mine = p ? of(p.id) : [];
    const done = mine.filter((t) => t.done_at).length;
    return (
      <Screen>
        <Head back="Projects" to="/projects" over={p ? `Project · ${STATE[p.status]}` : 'New project'} title={p ? p.name : name.trim() || 'New project'} sub={p ? `${p.who_for ? `For ${p.who_for}. ` : ''}${p.due_date ? `Due ${friendlyDate(p.due_date)}. ` : ''}${mine.length ? `${done} of ${mine.length} tasks done.` : 'No tasks yet.'}` : 'What it is, who it is for and when it is due.'} />
        {p && mine.length ? <><Bar pct={(done / mine.length) * 100} colour={health(p, mine).colour} /><View style={{ height: 14 }} /></> : null}
        {!p ? (
          <>
            <Field label="What is the project" value={name} onChangeText={setName} placeholder="New website and booking page" maxLength={160} autoFocus />
            <Field label="Who it is for (optional)" value={who} onChangeText={setWho} placeholder="A customer, or the business" maxLength={120} />
            <Field label="Due (optional)" value={due} onChangeText={setDue} placeholder="29 Nov" autoCapitalize="none" />
            <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={4000} style={{ minHeight: 80, textAlignVertical: 'top' }} />
            <ErrorText>{error}</ErrorText>
            <Button title="Start the project" busy={busy} onPress={() => run(async () => {
              if (!name.trim()) throw new Error('Give the project a name.');
              const saved = await saveProject({ name, who_for: who, due_date: dueDate(), notes });
              setCreating(false); setOpenId(saved.id); setName(''); setWho(''); setDue(''); setNotes('');
            }, 'Could not start that project.')} />
            <Button title="Cancel" kind="ghost" onPress={() => { setCreating(false); setError(''); }} />
          </>
        ) : (
          <>
            <Label>Tasks</Label>
            <Box>
              {!mine.length ? <Sub>Add the first thing that needs doing.</Sub> : null}
              {mine.map((t, i) => (
                <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!t.done_at }} accessibilityLabel={t.title} hitSlop={8} onPress={() => run(() => tickTask(t), 'Could not tick that.')}
                    style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: t.done_at ? colours.purple : 'transparent', borderWidth: 2, borderColor: t.done_at ? colours.purple : colours.purpleInk }}>
                    {t.done_at ? <Ionicons name="checkmark" size={16} color={colours.onPurple} /> : null}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.done_at ? colours.muted : colours.text, fontSize: 15, fontWeight: '600', textDecorationLine: t.done_at ? 'line-through' : 'none' }}>{t.title}</Text>
                    {t.who ? <Text style={{ color: colours.faint, fontSize: 12, marginTop: 1 }}>{t.who}</Text> : null}
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${t.title}`} hitSlop={8} onPress={() => confirm(`t-${t.id}`, () => run(() => deleteTask(t.id), 'Could not remove that.'))}>
                    {armed === `t-${t.id}` ? <Text style={{ color: colours.danger, fontSize: 12.5, fontWeight: '700' }}>Tap again</Text> : <Ionicons name="close" size={18} color={colours.faint} />}
                  </Pressable>
                </View>
              ))}
              <View style={{ height: 8 }} />
              <Field label="New task" value={task} onChangeText={setTask} placeholder="Order the sleepers" maxLength={200} />
              <Field label="Who is doing it (optional)" value={taskWho} onChangeText={setTaskWho} placeholder="You, or a name" maxLength={80} />
              <Button title="Add the task" kind="ghost" disabled={busy} onPress={() => run(async () => { if (!task.trim()) throw new Error('What needs doing?'); await addTask(p.id, task, taskWho, mine.length); setTask(''); setTaskWho(''); }, 'Could not add that task.')} />
            </Box>
            {p.notes ? <><Label>Notes</Label><Box><Text style={{ color: colours.text, fontSize: 14.5, lineHeight: 21 }}>{p.notes}</Text></Box></> : null}
            <Label>Where it is at</Label>
            <ChipPicker options={['active', 'paused', 'done'] as const} value={p.status} label={(s) => STATE[s]} onChange={(s) => run(async () => { await saveProject({ id: p.id, name: p.name, who_for: p.who_for, due_date: p.due_date, notes: p.notes, status: s }); }, 'Could not change that.')} />
            <ErrorText>{error}</ErrorText>
            <Button title={armed === 'del' ? 'Tap again to delete the project' : 'Delete the project'} kind="danger" disabled={busy} onPress={() => confirm('del', () => run(async () => { await deleteProject(p.id); setOpenId(null); }, 'Could not delete that.'))} />
          </>
        )}
      </Screen>
    );
  }

  const active = list.filter((x) => x.status === 'active');
  const late = active.filter((x) => x.due_date && x.due_date < today() && of(x.id).some((t) => !t.done_at));
  const week = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  return (
    <Screen onRefresh={load}>
      <Head over="Business" title="Projects" sub="The bigger pieces of work. Tasks, dates and notes for each one in the same place." />
      <Stats items={[{ label: 'on the go', value: String(active.length) }, { label: 'past their date', value: String(late.length), colour: late.length ? '#FF8A7E' : undefined }, { label: 'due this week', value: String(active.filter((x) => x.due_date && x.due_date >= today() && x.due_date <= week).length) }]} />
      <Button title="Start a project" onPress={() => { setError(''); setCreating(true); }} />
      <ErrorText>{error}</ErrorText>
      <View style={{ height: 12 }} />
      {!list.length ? <Box><Sub>No projects yet. Start one for anything with more than a couple of steps.</Sub></Box> : null}
      {list.map((x) => {
        const mine = of(x.id), done = mine.filter((t) => t.done_at).length, h = health(x, mine), next = mine.find((t) => !t.done_at);
        return (
          <Box key={x.id} onPress={() => { setError(''); setOpenId(x.id); }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1 }}><H>{x.name}</H>{x.who_for ? <Sub>{x.who_for}</Sub> : null}</View>
              <Pill text={h.text} colour={h.colour} />
            </View>
            {mine.length ? <View style={{ marginTop: 12 }}><Bar pct={(done / mine.length) * 100} colour={h.colour} /></View> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: colours.muted, fontSize: 12.5 }}>{mine.length ? `${done} of ${mine.length} tasks` : 'No tasks yet'}</Text>
              <Text style={{ color: colours.muted, fontSize: 12.5 }}>{x.due_date ? `Due ${friendlyDate(x.due_date)}` : 'No date'}</Text>
            </View>
            {next ? <Text style={{ color: colours.text, fontSize: 13.5, marginTop: 8 }}>Next: {next.title}</Text> : null}
          </Box>
        );
      })}
    </Screen>
  );
}
