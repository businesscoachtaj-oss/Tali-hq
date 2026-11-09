import type { RegionId } from '@/lib/brain';

// The new AIs for Tali's brain (9 Nov 2026 mockups, plan in claude/Tali_Brain_AI_Map.md).
// What customers can use comes from lib/capabilities.ts (the server says what is switched on).
// BRAIN_AI_PREVIEW now only gates the founder's own views (Runs on, How Tali thinks).
export const BRAIN_AI_PREVIEW = true;

// What each new AI costs the user, in credits. Every one of these costs us money per use, so none
// of them is free on any plan.
export const COST = {
  secondOpinion: 20, // GPT-5.4 checks Tali's answer, about A$0.035 to us
  videoPerMinute: 5, // Gemini 3 Flash watches a video, about A$0.015 a minute to us
  webSearch: 2, // Perplexity Sonar, up to A$0.02 a search to us
} as const;

// The voice add-on: ElevenLabs speaks her replies and hears yours. About A$0.06 a spoken minute to us.
export const VOICE_ADDON = { price: 4.99, speakMinutes: 20, listenHours: 3, packPrice: 2.99, packMinutes: 20 } as const;

// Which AI each part of her brain runs on once the plan is built. Shared by Brain and How Tali thinks.
export type PartAi = { id: RegionId; job: string; ai: string; was: string; cost: string };
export const PART_AI: PartAi[] = [
  { id: 'thalamus', job: 'The router: reads what you ask and picks the AI', ai: 'Claude Haiku 5.5', was: 'Fixed per screen', cost: 'Included' },
  { id: 'frontal', job: 'Judgement and rules, most of your chats', ai: 'Claude Haiku 5.5', was: 'Claude Haiku 5.5', cost: '1 credit' },
  { id: 'prefrontal', job: 'Planning, big calls and a second opinion', ai: 'Sonnet, Opus and GPT-5.4', was: 'Sonnet and Opus', cost: '20 to 40 credits' },
  { id: 'occipital', job: 'Seeing photos, screenshots and video', ai: 'Gemini 3 Flash', was: 'Claude vision', cost: `${COST.videoPerMinute} credits a video minute` },
  { id: 'temporal', job: 'Her voice, and hearing yours', ai: 'ElevenLabs Flash and Scribe', was: 'Kokoro (Pro)', cost: 'Voice add-on' },
  { id: 'hippocampus', job: 'Finding memories by meaning', ai: 'Voyage 4 with rerank', was: 'gte-small', cost: 'Included' },
  { id: 'brainstem', job: 'Keeping every memory searchable', ai: 'Voyage 4', was: 'gte-small', cost: 'Included' },
  { id: 'cerebellum', job: 'Checking her own work', ai: 'GPT-5.4 nano', was: 'Claude Sonnet, weekly', cost: 'Included' },
  { id: 'amygdala', job: 'Safety and urgency', ai: 'Claude Haiku and OpenAI moderation', was: 'Claude Haiku', cost: 'Included' },
  { id: 'corpus_callosum', job: 'Research, reading documents, the shared brain', ai: 'Perplexity Sonar and Mistral OCR', was: 'Anthropic web search', cost: `${COST.webSearch} credits a search` },
  { id: 'hypothalamus', job: 'Her schedule, overnight jobs', ai: 'Anthropic batch (half price)', was: 'Scheduled jobs', cost: 'Included' },
  { id: 'basal_ganglia', job: 'Skills and routines', ai: 'Claude Sonnet', was: 'Claude Sonnet', cost: 'Included' },
  { id: 'parietal', job: 'Her senses: your connected apps', ai: 'Gmail, Calendar, Outlook, Stripe', was: 'Same', cost: 'Included' },
];
export const partAi = (id: RegionId) => PART_AI.find((p) => p.id === id);

// Preview data for the router's recent picks. The real list will come from ai_usage once the
// router logs which part and AI handled each job.
export const SAMPLE_PICKS = [
  { ask: 'What is this ad doing wrong? (2:14 video)', part: 'occipital' as RegionId, ai: 'Gemini 3 Flash', credits: 15, when: '9:42am' },
  { ask: 'Should I raise my PT prices in January?', part: 'prefrontal' as RegionId, ai: 'Sonnet, then GPT-5.4', credits: 40, when: '9:15am' },
  { ask: 'What do other Brisbane gyms charge for 10 packs?', part: 'corpus_callosum' as RegionId, ai: 'Perplexity Sonar', credits: 3, when: '8:58am' },
  { ask: 'Draft a reply to Jess about Thursday', part: 'frontal' as RegionId, ai: 'Claude Haiku 5.5', credits: 1, when: '8:31am' },
  { ask: 'Read me the morning brief', part: 'temporal' as RegionId, ai: 'ElevenLabs Flash', credits: 0, when: '7:05am' },
];
