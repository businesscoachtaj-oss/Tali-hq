// supabase/functions/tali-learn/index.ts  (Learnéd project jbyzblwrywgxilhmfyjt)
//
// Tali writes the lessons (28 Nov 2026, Taj: "build a huge backlog of lessons so people aren't just
// repeating... one a day for each category so we are always at least one day ahead of any user").
//
// Called three ways:
//   1. Nightly by cron 'tali-learn-writer' (x-tali-key): in every one of the ten categories, writes the
//      next lesson of the live shared course, or plans a new course when the last one is finished. Writes
//      more where someone is within two lessons of the end of what is written. {per_category} (up to 5)
//      builds the backlog faster on a manual run.
//   2. Every 2 hours by cron 'tali-learn-personal' ({personal_only: true}): the next lesson of each
//      personal path whose owner is within two lessons of the end.
//   3. By the app, signed in ({action: 'create', topic}): a personal "learn anything" path. Paid plans and
//      the trial only, up to 3 at once, and only after their yes on "Tali and your data". The first
//      lesson is written straight away in the background.
//
// Every lesson is written, then checked by a second pass before it goes live. Quotes are only ever word
// for word from a book in her library: each one is checked against the passage (learn_quote_ok) and any
// that don't match are taken out. Money and health lessons are general information, never personal advice.
// Deployed with verify_jwt false (the cron sends the vault key; the app call is checked here).
// Secrets: ANTHROPIC_API_KEY, TALI_DEEP_MODEL (optional, default claude-sonnet-5-5).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { claudeMessages } from '../_shared/claude.ts';
import { AI_CONSENT_CODE, AI_CONSENT_MESSAGE, hasAiConsent } from '../_shared/consent.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = Deno.env.get('TALI_DEEP_MODEL') ?? 'claude-sonnet-5-5';
const MAX_PERSONAL = 3;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tali-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (code: string, message: string, status = 400) => json({ ok: false, code, message }, status);
// No em or en dashes anywhere (house rule).
const clean = (s: unknown, max = 4000) => String(s ?? '').replace(/\s*[–—]\s*/g, ', ').replace(/\s+\n/g, '\n').trim().slice(0, max);

type Category = { id: string; name: string; line: string; subjects: string[] };
type OutlineItem = { n: number; title: string; aim: string; book?: string | null };
type Course = { id: string; category: string; owner: string | null; title: string; outline: OutlineItem[]; written: number; live: number; furthest: number; learners: number };
type Block = { t: 'h' | 'p' | 'quote' | 'try'; text: string; by?: string; book?: string; passage?: number };

const VOICE = [
  'You are Tali (said "tally"), the AI inside Learnéd, made in Australia by Totality 360. Learnéd helps grown-ups get a little better every day: a short lesson, a few brain games and a big idea.',
  'You write like a warm, sharp teacher who respects the reader: plain Australian English, short sentences, concrete examples from everyday Australian life, no jargon without explaining it.',
  'Never use em dashes or en dashes. No hype words, no exclamation marks in the lesson body, no "In this lesson we will". Start with something interesting.',
  'Be accurate. Only state what is well established, and say plainly where experts disagree or where something is uncertain. Never make up a statistic, a study, a date or a quote.',
  'Money lessons are general information, not personal financial advice: explain how things work in Australia (super, tax, MoneySmart) and suggest a licensed adviser for big decisions. Health lessons are general information, not medical advice: suggest a GP for anything personal. Never give dosages.',
].join(' ');

// ---------- Claude ----------
async function callTool<T>(system: string, user: string, tool: Record<string, unknown>, maxTokens = 6000): Promise<T> {
  const res = await claudeMessages(ANTHROPIC_KEY, {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: user }],
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const block = (data.content ?? []).find((b: { type: string }) => b.type === 'tool_use');
  if (!block) throw new Error('No tool answer');
  return block.input as T;
}

const PLAN_TOOL = {
  name: 'plan_course',
  description: 'Plan a short course: a run of lessons that build on each other.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The course name, 1 to 5 words, like "Stoicism" or "Money, the basics".' },
      line: { type: 'string', description: 'One line on what it gives the reader, under 70 characters.' },
      sources: { type: 'string', description: 'In plain words, where it draws from, under 90 characters. Name library books by author only if the outline uses them.' },
      lessons: {
        type: 'array', minItems: 6, maxItems: 20,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Lesson title, under 50 characters.' },
            aim: { type: 'string', description: 'What the reader will understand or be able to do after it, one sentence.' },
            book: { type: 'string', description: 'The id of one library book this lesson quotes from, only if one genuinely fits. Empty otherwise.' },
          },
          required: ['title', 'aim'],
        },
      },
    },
    required: ['title', 'line', 'sources', 'lessons'],
  },
};

const LESSON_TOOL = {
  name: 'write_lesson',
  description: 'Write one lesson.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The lesson title, under 50 characters.' },
      teaser: { type: 'string', description: 'One line that makes someone want to read it, under 120 characters.' },
      mins: { type: 'integer', description: 'Minutes to read and answer, 5 to 9.' },
      body: {
        type: 'array', minItems: 4, maxItems: 14,
        description: 'The lesson in order, 450 to 750 words in all. p is a paragraph of 2 to 4 sentences. h is a short subheading. quote is a line copied word for word from one of the passages you were given (never from memory), with by (author and work) and book and passage set from the passage marker. Use 0 to 2 quotes. End with exactly one try.',
        items: {
          type: 'object',
          properties: {
            t: { type: 'string', enum: ['h', 'p', 'quote', 'try'] },
            text: { type: 'string' },
            by: { type: 'string' },
            book: { type: 'string' },
            passage: { type: 'integer' },
          },
          required: ['t', 'text'],
        },
      },
      questions: {
        type: 'array', minItems: 3, maxItems: 3,
        description: 'Three multiple choice questions that check understanding, not memory of wording. Use everyday situations. Exactly one clearly right option each.',
        items: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            options: { type: 'array', minItems: 3, maxItems: 4, items: { type: 'string' } },
            answer: { type: 'integer', description: 'Index of the right option, from 0.' },
            why: { type: 'string', description: 'One or two sentences on why it is right.' },
          },
          required: ['q', 'options', 'answer', 'why'],
        },
      },
      recall: {
        type: 'array', minItems: 2, maxItems: 3,
        description: 'Flash cards that come back in the days after, to make it stick. A short question and a short answer.',
        items: { type: 'object', properties: { q: { type: 'string' }, a: { type: 'string' } }, required: ['q', 'a'] },
      },
    },
    required: ['title', 'teaser', 'mins', 'body', 'questions', 'recall'],
  },
};

const CHECK_TOOL = {
  name: 'check_lesson',
  description: 'Say whether this lesson is ready for people to read.',
  input_schema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean', description: 'True only if it is accurate, safe, clear and every question has exactly one right answer that matches the lesson.' },
      problems: { type: 'array', items: { type: 'string' }, description: 'Anything wrong, one line each. Empty when ok.' },
    },
    required: ['ok', 'problems'],
  },
};

const CHECK_SYSTEM = [
  'You check lessons before they go live in Learnéd, an Australian learning app for grown-ups. Be strict about facts and fair about style.',
  'Fail it for: anything factually wrong or overstated, a made up statistic, study or date, a quote that is not marked as a quote, personal financial or medical advice (general information is fine), anything unsafe, a question with no right answer or more than one, an answer index that points at the wrong option, or a lesson that does not match its title.',
  'Do not fail it for style you would have done differently. Passages from library books are given so you can see the quotes are real.',
].join(' ');

// ---------- Courses ----------
async function planCourse(cat: Category, opts: { owner?: string; asked?: string; previous: string[] }) {
  const { data: books } = await admin.rpc('learn_books', { p_subjects: cat.subjects });
  const bookList = (books ?? []) as { id: string; title: string; author: string }[];
  const personal = !!opts.owner;
  const prompt = [
    personal
      ? `Plan a personal course for someone who asked to learn: "${clean(opts.asked, 200)}". 8 to 12 lessons, each about 7 minutes, starting from zero and building to real understanding they can use.`
      : `Plan the next course in the ${cat.name} category (${cat.line}). 12 to 20 lessons, each about 7 minutes, for curious grown-ups starting from zero. Pick a topic that is useful or fascinating, and different from the courses already in this category.`,
    opts.previous.length ? `Courses already written here: ${opts.previous.join('; ')}.` : '',
    bookList.length
      ? `Books in Tali's library you can quote from (id: title, author): ${bookList.map((b) => `${b.id}: ${b.title}, ${b.author}`).join(' | ')}. Only set book on a lesson where that book genuinely fits.`
      : 'There are no library books for this one, so leave book empty.',
  ].filter(Boolean).join('\n\n');
  const out = await callTool<{ title: string; line: string; sources: string; lessons: { title: string; aim: string; book?: string }[] }>(VOICE, prompt, PLAN_TOOL, 4000);
  const ids = new Set(bookList.map((b) => b.id));
  const outline: OutlineItem[] = (out.lessons ?? []).slice(0, 20).map((l, i) => ({ n: i + 1, title: clean(l.title, 60), aim: clean(l.aim, 240), book: l.book && ids.has(l.book) ? l.book : null }));
  if (outline.length < 4) throw new Error('Outline too short');
  const { data, error } = await admin.from('learn_courses').insert({
    category: cat.id, owner: opts.owner ?? null, title: clean(out.title, 60), line: clean(out.line, 90), sources: clean(out.sources, 120),
    asked: personal ? clean(opts.asked, 200) : null, outline,
  }).select('id').single();
  if (error) throw error;
  return { id: data.id as string, category: cat.id, owner: opts.owner ?? null, title: clean(out.title, 60), outline, written: 0, live: 0, furthest: 0, learners: 0 } as Course;
}

// ---------- One lesson ----------
async function writeLesson(cat: Category, course: Course, n: number): Promise<'live' | 'failed' | 'skipped'> {
  const item = course.outline.find((o) => o.n === n);
  if (!item) return 'skipped';
  const { data: existing } = await admin.from('learn_lessons').select('id, status, tries').eq('course_id', course.id).eq('n', n).maybeSingle();
  if (existing?.status === 'live') return 'skipped';
  if ((existing?.tries ?? 0) >= 3) return 'skipped';

  const query = `${item.title} ${item.aim}`.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 3).slice(0, 8).join(' or ');
  const { data: passages } = await admin.rpc('learn_passages', { p_subjects: cat.subjects, p_query: query, p_book: item.book ?? null, p_limit: 6 });
  const pass = (passages ?? []) as { book_id: string; title: string; author: string; n: number; content: string }[];
  const { data: prev } = await admin.from('learn_lessons').select('n, title, teaser').eq('course_id', course.id).eq('status', 'live').lt('n', n).order('n', { ascending: false }).limit(2);

  const prompt = [
    `Course: ${course.title} (${cat.name}). Lesson ${n} of ${course.outline.length}: "${item.title}". Aim: ${item.aim}`,
    `The whole course: ${course.outline.map((o) => `${o.n}. ${o.title}`).join('; ')}`,
    prev?.length ? `Just before this: ${prev.map((p: { n: number; title: string }) => `lesson ${p.n}, "${p.title}"`).join(', ')}. Build on it, don't repeat it.` : 'This is the first lesson, so start where a beginner is.',
    pass.length
      ? `Passages from Tali's library. You may quote a line from these word for word, setting book and passage from the marker. Never quote anything else.\n${pass.map((p) => `[book=${p.book_id} passage=${p.n}] ${p.title}, ${p.author}:\n${p.content}`).join('\n\n')}`
      : 'No library passages fit this one, so use no quotes.',
  ].join('\n\n');

  const out = await callTool<{ title: string; teaser: string; mins: number; body: Block[]; questions: { q: string; options: string[]; answer: number; why: string }[]; recall: { q: string; a: string }[] }>(VOICE, prompt, LESSON_TOOL, 6000);

  // Quotes: keep only those that are really in the passage.
  const body: Block[] = [];
  for (const b of out.body ?? []) {
    const t = ['h', 'p', 'quote', 'try'].includes(b.t) ? b.t : 'p';
    const text = clean(b.text, 1600);
    if (!text) continue;
    if (t === 'quote') {
      if (!b.book || !b.passage) continue;
      const { data: ok } = await admin.rpc('learn_quote_ok', { p_book: b.book, p_passage: b.passage, p_quote: b.text });
      if (ok !== true) continue;
      body.push({ t, text: String(b.text).trim().slice(0, 600), by: clean(b.by, 120), book: b.book, passage: b.passage });
    } else body.push({ t, text });
  }
  const questions = (out.questions ?? []).slice(0, 3).map((q) => ({
    q: clean(q.q, 300), options: (q.options ?? []).slice(0, 4).map((o) => clean(o, 200)), answer: Math.max(0, Math.min(Number(q.answer) || 0, (q.options?.length ?? 1) - 1)), why: clean(q.why, 400),
  })).filter((q) => q.q && q.options.length >= 3);
  const recall = (out.recall ?? []).slice(0, 3).map((r) => ({ q: clean(r.q, 300), a: clean(r.a, 500) })).filter((r) => r.q && r.a);
  const row = {
    course_id: course.id, n, title: clean(out.title || item.title, 60), teaser: clean(out.teaser, 160), mins: Math.max(4, Math.min(Number(out.mins) || 7, 10)),
    body, questions, recall, model: MODEL, tries: (existing?.tries ?? 0) + 1,
  };

  // The check pass.
  let ok = body.filter((b) => b.t === 'p').length >= 3 && questions.length === 3;
  let notes = ok ? '' : 'Too short or missing questions.';
  if (ok) {
    const check = await callTool<{ ok: boolean; problems: string[] }>(CHECK_SYSTEM,
      `Lesson: ${JSON.stringify({ title: row.title, body, questions, recall })}\n\nLibrary passages it may quote: ${pass.map((p) => `[${p.book_id} ${p.n}] ${p.content.slice(0, 600)}`).join('\n') || 'none'}`,
      CHECK_TOOL, 1500);
    ok = !!check.ok;
    notes = (check.problems ?? []).map((p) => clean(p, 300)).join(' | ');
  }
  const status = ok ? 'live' : 'failed';
  const { error } = await admin.from('learn_lessons').upsert({ ...row, status, check_notes: notes || null, live_at: ok ? new Date().toISOString() : null }, { onConflict: 'course_id,n' });
  if (error) throw error;
  if (ok && n === course.outline.length) await admin.from('learn_courses').update({ status: 'finished' }).eq('id', course.id).is('owner', null).then(() => {}, () => {});
  return status;
}

// ---------- Runs ----------
async function categories(): Promise<Category[]> {
  const { data } = await admin.from('learn_categories').select('id, name, line, subjects').order('sort');
  return (data ?? []) as Category[];
}
async function state(): Promise<Course[]> {
  const { data } = await admin.rpc('learn_writer_state');
  return ((data ?? []) as Course[]).map((c) => ({ ...c, outline: Array.isArray(c.outline) ? c.outline : [] }));
}

/** Shared library: in every category, one lesson a night, more where someone is close to the end. */
async function nightly(perCategory: number, only?: string) {
  const cats = (await categories()).filter((c) => !only || c.id === only);
  const courses = await state();
  const results = await Promise.all(cats.map(async (cat) => {
    const log: string[] = [];
    try {
      let course = courses.find((c) => c.category === cat.id && !c.owner && c.written < c.outline.length);
      if (!course) {
        const { data: prev } = await admin.from('learn_courses').select('title').eq('category', cat.id).is('owner', null);
        course = await planCourse(cat, { previous: (prev ?? []).map((p: { title: string }) => p.title) });
        log.push(`planned ${course.title}`);
      }
      // Stay at least two lessons ahead of the furthest learner, and always add the night's lesson.
      const want = Math.min(5, Math.max(perCategory, course.furthest + 2 - course.live));
      for (let i = 0; i < want && course.written < course.outline.length; i++) {
        const st = await writeLesson(cat, course, course.written + 1);
        log.push(`${course.title} ${course.written + 1}: ${st}`);
        if (st === 'failed') break; // try again next run
        course.written++;
        if (st === 'live') course.live++;
      }
    } catch (e) {
      log.push(`error: ${String(e).slice(0, 200)}`);
    }
    return { category: cat.id, log };
  }));
  return results;
}

/** Personal paths: keep each one at least two lessons ahead of its owner. */
async function personal() {
  const cats = await categories();
  const courses = (await state()).filter((c) => c.owner && c.written < c.outline.length && c.live - c.furthest < 2);
  const out = await Promise.all(courses.slice(0, 12).map(async (c) => {
    const cat = cats.find((x) => x.id === c.category);
    if (!cat) return null;
    try { return `${c.title} ${c.written + 1}: ${await writeLesson(cat, c, c.written + 1)}`; } catch (e) { return `${c.title}: ${String(e).slice(0, 160)}`; }
  }));
  return out.filter(Boolean);
}

async function isPaid(userId: string) {
  const { data } = await admin.from('subscriptions').select('plan_id, status, trial_ends_at').eq('user_id', userId).maybeSingle();
  if (!data) return false;
  if (data.status === 'trialing') return !!data.trial_ends_at && new Date(data.trial_ends_at).getTime() > Date.now();
  return ['hq', 'pro', 'max'].includes(data.plan_id) && ['active', 'past_due'].includes(data.status);
}

const CATEGORY_TOOL = {
  name: 'pick_category',
  description: 'Pick the category this topic belongs in.',
  input_schema: { type: 'object', properties: { category: { type: 'string', enum: ['philosophy', 'mind', 'money', 'history', 'science', 'health', 'writing', 'people', 'world', 'art'] }, safe: { type: 'boolean', description: 'False if the topic is harmful to teach (weapons, hurting people, illegal drugs, self harm, sexual content).' } }, required: ['category', 'safe'] },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('bad_request', 'POST only', 405);
  if (!ANTHROPIC_KEY) return fail('not_configured', 'ANTHROPIC_API_KEY is not set', 500);
  const body = await req.json().catch(() => ({}));

  // Scheduled runs.
  const key = req.headers.get('x-tali-key');
  if (key) {
    const { data: ok } = await admin.rpc('brain_check_key', { p_key: key });
    if (ok !== true) return fail('unauthorized', 'Bad key', 401);
    const per = Math.max(1, Math.min(Number(body.per_category) || 1, 5));
    const work = (async () => {
      const started = new Date().toISOString();
      const result = body.personal_only ? { personal: await personal() } : { shared: await nightly(per, body.category), personal: await personal() };
      await admin.from('job_runs').insert({ job: body.personal_only ? 'learn_personal' : 'learn_writer', status: 'ok', summary: JSON.stringify(result).slice(0, 4000), started_at: started, finished_at: new Date().toISOString() });
    })().catch(async (e) => {
      await admin.from('job_runs').insert({ job: 'learn_writer', status: 'failed', error: String(e).slice(0, 1000), finished_at: new Date().toISOString() });
    });
    EdgeRuntime.waitUntil(work);
    return json({ ok: true, started: true });
  }

  // From the app: start a personal path.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  const user = u?.user;
  if (!user) return fail('unauthorized', 'Please sign in again.', 401);
  if (body.action !== 'create') return fail('bad_request', 'Unknown action');
  const topic = clean(body.topic, 160);
  if (topic.length < 3) return fail('bad_request', 'Tell Tali what you want to learn.');
  if (!(await hasAiConsent(admin, user.id))) return fail(AI_CONSENT_CODE, AI_CONSENT_MESSAGE, 403);
  if (!(await isPaid(user.id))) return fail('no_access', 'Your own paths come with a plan. The lesson library is free for everyone.', 402);
  const { count } = await admin.from('learn_courses').select('id', { count: 'exact', head: true }).eq('owner', user.id).eq('status', 'live');
  if ((count ?? 0) >= MAX_PERSONAL) return fail('too_many', `You have ${MAX_PERSONAL} paths of your own on the go. Finish or remove one to start another.`, 409);

  try {
    const pick = await callTool<{ category: string; safe: boolean }>('You sort learning topics into categories for an Australian learning app.', `Topic: "${topic}"`, CATEGORY_TOOL, 300);
    if (!pick.safe) return fail('not_this', "That's not something Tali can teach. Try another topic.", 400);
    const cat = (await categories()).find((c) => c.id === pick.category) ?? (await categories())[0];
    const course = await planCourse(cat, { owner: user.id, asked: topic, previous: [] });
    await admin.from('learn_enrolments').upsert({ user_id: user.id, course_id: course.id, last_at: new Date().toISOString() });
    EdgeRuntime.waitUntil((async () => {
      const first = await writeLesson(cat, course, 1).catch(() => 'failed' as const);
      if (first === 'live') await writeLesson(cat, course, 2).catch(() => null);
      else await writeLesson(cat, course, 1).catch(() => null); // one more go
    })());
    return json({ ok: true, course: { id: course.id, title: course.title, lessons: course.outline.length } });
  } catch (e) {
    console.error('tali-learn create', e);
    return fail('failed', "Tali couldn't plan that one just now. Try again in a minute.", 500);
  }
});
