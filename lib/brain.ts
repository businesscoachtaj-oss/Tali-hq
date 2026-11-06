// Tali's brain, section by section (6 Nov 2026, asked for by Taj). Each section is named after the
// part of a human brain that does the same job. The data comes from my_brain() (migration
// 20261106000041_brain_sections.sql); the 3D picture is components/BrainGlobe.tsx.
import { supabase } from './supabase';

export type RegionId =
  | 'frontal'
  | 'prefrontal'
  | 'parietal'
  | 'temporal'
  | 'occipital'
  | 'cerebellum'
  | 'hippocampus'
  | 'amygdala'
  | 'thalamus'
  | 'hypothalamus'
  | 'basal_ganglia'
  | 'brainstem'
  | 'corpus_callosum';

export type BrainItem = {
  id?: string;
  text: string;
  kind: string;
  at?: string;
  mine?: boolean;
  urgent?: boolean;
  held?: number;
  broken?: number;
  old?: string; // a contradiction: the older memory
  about?: string[]; // subjects, for knowledge from Tali's education
  private?: boolean; // the user marked it private: never shared (6 Nov 2026)
  shared?: boolean; // the nightly scrub has looked at it
};
export type BrainRegion = { id: RegionId; count: number; items: BrainItem[] };
export type BrainLink = { name: string; regions: RegionId[]; count: number };
export type Brain = { scope: 'main' | 'mine'; total: number; regions: BrainRegion[]; links: BrainLink[] };

// Plain words for each section: what the part does in a person, and what it is in Tali.
export const REGIONS: Record<RegionId, { name: string; human: string; tali: string; colour: string; studies: string }> = {
  frontal: { name: 'Frontal lobe', human: 'Self-control and judgement', tali: 'Rules and preferences she sticks to, and nothing goes out without your yes', colour: '#B9A6FF', studies: 'philosophy, ethics, decision making and logic' },
  prefrontal: { name: 'Prefrontal cortex', human: 'Planning ahead', tali: 'Plans, ideas, your live goals and open decisions', colour: '#D7B5FF', studies: 'strategy, economics, game theory and the history of big decisions' },
  parietal: { name: 'Parietal lobe', human: 'The senses', tali: 'What she can feel: your connected Gmail and Calendar', colour: '#7FD1FF', studies: 'maths, physics and astronomy' },
  temporal: { name: 'Temporal lobe', human: 'Language and who is who', tali: 'The people in your world', colour: '#FFC37A', studies: 'writing, storytelling, language and the psychology of people' },
  occipital: { name: 'Occipital lobe', human: 'Vision', tali: 'What she saw in photos and screenshots you sent, and the images she made for you', colour: '#8EF0C8', studies: 'art, design, photography and film' },
  cerebellum: { name: 'Cerebellum', human: 'Fixing mistakes and fine tuning', tali: 'Lessons and mistakes. Lessons that keep holding become proven', colour: '#FF9EC4', studies: 'sports science, coaching, biomechanics and skill learning' },
  hippocampus: { name: 'Hippocampus', human: 'Memory', tali: 'Facts and events she remembers', colour: '#9FB7FF', studies: 'history, geography and how memory and learning work' },
  amygdala: { name: 'Amygdala', human: 'Urgency and threat', tali: 'Anything urgent, and contradictions for you to settle', colour: '#FF7A6E', studies: 'emotions, stress, risk and safety' },
  thalamus: { name: 'Thalamus', human: 'The relay station', tali: 'The router that files every new memory into the right part', colour: '#FFE38A', studies: 'coding, computing, networks and AI' },
  hypothalamus: { name: 'Hypothalamus', human: 'The body clock', tali: 'Her schedule: morning brief, health checks, shutdown, night school', colour: '#FFB38A', studies: 'nutrition, sleep, hormones and physiology' },
  basal_ganglia: { name: 'Basal ganglia', human: 'Habits', tali: 'Skills and routines she has learned', colour: '#C6F28A', studies: 'habits, behaviour change, music and practice' },
  brainstem: { name: 'Brainstem', human: 'Keeps you alive', tali: 'The core that keeps every memory searchable', colour: '#A6B0C8', studies: 'biology, the body and the basics of medicine' },
  corpus_callosum: { name: 'Corpus callosum', human: 'Joins the two halves', tali: 'The shared brain every Tali learns from, with no personal details', colour: '#E9E4FF', studies: 'big ideas that connect one field to another' },
};

export const REGION_ORDER: RegionId[] = [
  'hippocampus', 'temporal', 'cerebellum', 'frontal', 'prefrontal', 'amygdala', 'occipital',
  'parietal', 'thalamus', 'hypothalamus', 'basal_ganglia', 'brainstem', 'corpus_callosum',
];

export async function myBrain(scope: 'main' | 'mine'): Promise<Brain> {
  const { data, error } = await supabase.rpc('my_brain', { p_scope: scope });
  if (error) throw new Error('Could not load Tali’s brain. Try again in a minute.');
  const d = (data ?? {}) as any;
  return {
    scope: d.scope === 'main' ? 'main' : 'mine',
    total: Number(d.total ?? 0),
    regions: Array.isArray(d.regions) ? d.regions : [],
    links: Array.isArray(d.links) ? d.links : [],
  };
}

// keep: 'new' keeps the newer memory, 'old' the older one, 'both' says both are true.
export async function settleConflict(id: string, keep: 'new' | 'old' | 'both'): Promise<boolean> {
  const { data, error } = await supabase.rpc('settle_conflict', { p_id: id, p_keep: keep });
  if (error) throw new Error('Could not save that. Try again.');
  return data === true;
}

// Lessons that prove themselves: 3 holds and no breaks is proven; more breaks than holds is shaky.
export function lessonState(i: BrainItem): 'proven' | 'shaky' | null {
  const held = i.held ?? 0;
  const broken = i.broken ?? 0;
  if (held >= 3 && broken === 0) return 'proven';
  if (broken >= 2 && broken > held) return 'shaky';
  return null;
}

// A memory marked private is never sent to the shared brain (6 Nov 2026).
export async function setMemoryPrivate(id: string, isPrivate: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_memory_private', { p_id: id, p_private: isPrivate });
  if (error) throw new Error('Could not change that. Try again.');
  return data === true;
}

// Help every Tali learn (anonymously). On by default; switched off in Settings.
export async function shareLearning(userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('share_learning').eq('id', userId).maybeSingle();
  return (data as any)?.share_learning !== false;
}
export async function setShareLearning(userId: string, on: boolean) {
  const { error } = await supabase.from('profiles').update({ share_learning: on }).eq('id', userId);
  if (error) throw new Error('Could not save that. Try again.');
}

// Kinds the nightly scrub can share (once rewritten with no personal details).
export const SHAREABLE_KINDS = ['lesson', 'mistake', 'rule'];
