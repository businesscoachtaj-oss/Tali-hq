// Learn (28 Nov 2026, Learnéd): the lesson library, your paths, a lesson, and the recall cards.
// Tables and functions are in migration 103 (learn_*). Tali writes the lessons in the tali-learn function.
import { supabase } from './supabase';

export type NextLesson = { id: string; n: number; title: string; mins: number; teaser: string | null };
export type LearnPath = {
  id: string; title: string; line: string | null; category: string; category_name: string; colour: string; mine: boolean; sources: string | null;
  planned: number; live: number; done: number; done_today: boolean; last_at: string | null; next: NextLesson | null;
};
export type RecallCard = { id: string; q: string; a: string; box: number };
export type CategoryCourses = { id: string; name: string; line: string; colour: string; courses: { id: string; title: string; line: string | null; planned: number; live: number }[] };
export type LearnHome = { today: string; paths: LearnPath[]; recall: RecallCard[]; recall_due: number; categories: CategoryCourses[] };

export async function learnHome(): Promise<LearnHome> {
  const { data, error } = await supabase.rpc('learn_home');
  if (error) throw new Error('Could not load your learning. Try again in a minute.');
  const d = (data ?? {}) as Partial<LearnHome>;
  return { today: d.today ?? '', paths: d.paths ?? [], recall: d.recall ?? [], recall_due: d.recall_due ?? 0, categories: d.categories ?? [] };
}

/** The path to show on Today and the top of Learn: the most recent one with a lesson waiting. */
export function todaysPath(h: LearnHome | null): LearnPath | null {
  if (!h) return null;
  return h.paths.find((p) => p.next && !p.done_today) ?? null;
}

export type Course = { id: string; title: string; line: string | null; category: string; owner: string | null; outline: { n: number; title: string; aim: string }[]; sources: string | null; status: string };
export type LessonRow = { id: string; n: number; title: string; mins: number; teaser: string | null };
export async function course(id: string): Promise<{ course: Course; lessons: LessonRow[]; done: Set<string> }> {
  const [c, l, p] = await Promise.all([
    supabase.from('learn_courses').select('id, title, line, category, owner, outline, sources, status').eq('id', id).maybeSingle(),
    supabase.from('learn_lessons').select('id, n, title, mins, teaser').eq('course_id', id).order('n'),
    supabase.from('learn_progress').select('lesson_id').eq('course_id', id),
  ]);
  if (c.error || !c.data) throw new Error('Could not open that path.');
  return { course: c.data as Course, lessons: (l.data as LessonRow[]) ?? [], done: new Set(((p.data as { lesson_id: string }[]) ?? []).map((x) => x.lesson_id)) };
}

export type Block = { t: 'h' | 'p' | 'quote' | 'try'; text: string; by?: string };
export type Question = { q: string; options: string[]; answer: number; why: string };
export type Lesson = LessonRow & { course_id: string; body: Block[]; questions: Question[] };
export async function lesson(id: string): Promise<Lesson> {
  const { data, error } = await supabase.from('learn_lessons').select('id, n, title, mins, teaser, course_id, body, questions').eq('id', id).maybeSingle();
  if (error || !data) throw new Error('Could not open that lesson.');
  return data as Lesson;
}

export async function enrol(courseId: string) {
  const { data, error } = await supabase.rpc('learn_enrol', { p_course: courseId });
  if (error || data !== true) throw new Error('Could not start that one. Try again.');
}
export async function leavePath(courseId: string) {
  const { error } = await supabase.from('learn_enrolments').update({ paused: true }).eq('course_id', courseId);
  if (error) throw new Error('Could not change that. Try again.');
}
export async function finishLesson(id: string, score: number, outOf: number) {
  const { error } = await supabase.rpc('learn_finish', { p_lesson: id, p_score: score, p_out_of: outOf });
  if (error) throw new Error('Could not save that. Try again.');
}
export async function answerRecall(id: string, knew: boolean) {
  await supabase.rpc('learn_recall_answer', { p_card: id, p_knew: knew });
}

/** A personal path: Tali plans it and writes the first lesson in the background. Paid plans. */
export async function startOwnPath(topic: string): Promise<{ id: string; title: string; lessons: number }> {
  const { data, error } = await supabase.functions.invoke('tali-learn', { body: { action: 'create', topic } });
  let d = (data ?? {}) as any;
  if (d.ok && d.course) return d.course;
  if (error) {
    try { d = (await (error as any).context?.json?.()) ?? d; } catch {}
  }
  throw Object.assign(new Error(d.message || "Tali couldn't plan that one just now. Try again in a minute."), { code: d.code as string | undefined });
}

export const SUGGESTED = ['How memory works', 'The history of Rome', 'Writing clearly', 'The psychology of habits', 'Cooking without a recipe', 'Astronomy for beginners'];
