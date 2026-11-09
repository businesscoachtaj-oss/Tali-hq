# Brain AI contract (10 Nov 2026)

What the app can ask `tali-chat` for now that the extra AIs are built, and what comes back.
Branch: `brain-apis-10nov`. Nothing here is deployed or applied yet.

## What needs doing before it is live

1. Run the migration `supabase/migrations/20261110000055_chat_video_uploads.sql` (SQL editor: https://supabase.com/dashboard/project/jbyzblwrywgxilhmfyjt/sql/new). It lets the `chat-uploads` bucket take videos (mp4, mov, webm) up to 200 MB. Only needed for video. Everything else works without it.
2. Deploy one function: `tali-chat` (it now imports `supabase/functions/_shared/brainAi.ts`).
3. Secrets already set: `GEMINI_API_KEY`, `VOYAGE_API_KEY`, `OPENAI_API_KEY`. Optional overrides: `TALI_VIDEO_MODEL`, `TALI_RERANK_MODEL`, `TALI_SECOND_MODEL`.

The app that is live today sends none of the new fields and keeps working as it does now. The only things it would notice: memory search is reordered (Voyage), the safety screen runs, and replies after a web search carry `meta.sources`.

## Requests (all POST to `tali-chat`, signed in)

### What is switched on
```json
{ "action": "capabilities" }
```
Returns, with no vendor names and no charge:
```json
{ "ok": true,
  "capabilities": { "video": true, "second_opinion": true, "better_memory": true, "web_sources": false, "voice": false, "documents": false },
  "costs": { "second_opinion": 20, "video_per_minute": 5, "video_max_seconds": 600 } }
```
Each flag is true when its key is set: `video` GEMINI_API_KEY, `second_opinion` OPENAI_API_KEY, `better_memory` VOYAGE_API_KEY, `web_sources` PERPLEXITY_API_KEY, `voice` ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID, `documents` MISTRAL_API_KEY. The last three are not built. They only report false so the app can show "Coming soon". Adding a key later flips the flag but the feature still needs building.

### A chat turn (existing fields unchanged)
```json
{ "conversationId": "...", "text": "...", "attachments": [ ... ], "deep": "deep", "second_opinion": true }
```
- `second_opinion: true` (new, optional). 20 credits, reserved before she thinks. Ignored when OPENAI_API_KEY is not set (no charge).
- `attachments[]` may now include one video: `{ "kind": "video", "path": "<uid>/<conversationId>/<id>.mp4", "name": "ad.mp4", "size": 12345678, "seconds": 134 }`. Same folder rule as photos. One video a message (extra ones are dropped). Up to 4 attachments in total, as before.

## What it costs the user

| Thing | Credits | Notes |
|---|---|---|
| Video | 5 per started minute | Reserved after the real length is known and before she watches. Usage row feature `video`. |
| Second opinion | 20 | Reserved first. Usage row feature `second_opinion`. |
| Better memory search | 0 | Included. |
| Safety screen | 0 | Free endpoint. |

- A message with a video and no other files costs the normal 1 credit plus the video. Photos and PDFs still add 1.
- Video length used for billing: the length Gemini reports, else the app's `seconds`, else a guess from file size (size / 250 kB, minimum 60 s).
- Longer than 10 minutes: the turn stops with code `video_too_long` (413) and nothing is charged.
- Free plan: a video or `second_opinion: true` stops the turn with `no_access` (402), nothing charged. Trial, Tali HQ and Pro can use both.
- Not enough credits for the extra: the turn stops with `out_of_credits` (402) and a message naming the cost, and the whole turn is refunded.
- If the video cannot be opened or watched, or the second opinion call fails, that extra is refunded and the chat turn still answers. For a failed video she says plainly she could not watch it.
- If the whole turn fails, everything reserved for it is refunded.

## What comes back

The turn response gains `meta` (the same object saved on her message), and `remaining` now takes the extras into account. A blocked message returns `{ ok: true, reply, messageId, remembered: 0, declined: true, remaining: null }`.

Assistant `messages.meta` (all optional):
```ts
{
  deep?: 'deep' | 'deepest';
  suggest_deep?: boolean;
  watched?: { seconds: number; credits: number };
  second_opinion?: { by: string; agree: string; differ: string; credits: number };  // by is 'A second AI' for customers
  sources?: { title: string; url: string }[];   // up to 5 pages from her web search
  kept?: { text: string; part: string };        // first memory saved this turn
  declined?: true;                              // safety screen said no
  model?: string;                               // founder only
  routed?: { part: string; ai: string; credits: number };  // founder only
}
```
- `kept.part` is one of: Your people, How you like things, Your life and work, Plans and ideas, What she has learned. (person; preference; fact, event, seen; idea, plan; lesson, mistake.)
- Vendor and model names: `model` and `routed` are stored and returned only for the founder (`e89ca9de-a86e-4dd6-8094-bc518566352e`). Before this change `meta.model` was stored for everyone; the app never read it. `second_opinion.by` is the model id for the founder and "A second AI" for everyone else.
- User `messages.attachments[]` for a watched video gains `watched_notes` (up to 4,000 characters of her notes) so later turns in the chat can still talk about it. The app can ignore it.

## What each AI does

- **Video (Gemini).** The file is streamed from storage to Gemini's Files API in 8 MB pieces (never held whole in memory), she waits until it is ready, reads the real length, reserves credits, then one `generateContent` call returns a summary, a timeline with timestamps, a transcript and on-screen text. Those notes go to Claude with the message. The file is deleted from Gemini afterwards. Photos, screenshots and PDFs still go straight to Claude as before.
- **Better memory search (Voyage rerank).** No schema change. Recall fetches a wider pool (24 instead of 10; 40 instead of 30 on a Deep think) and the reranker picks the same number as before for this message. 3.5 second limit, falls back to the old order.
- **Second opinion (OpenAI, Responses API).** After Claude answers, the question, her answer and the owner's profile go to the second model, which returns `agree`, `differ` and whether the difference is worth remembering.
- **Safety screen (OpenAI moderation).** Runs on what they typed, 3 second limit, fails open. It only blocks sexual content involving minors (score 0.6 or more) or very clear help with serious violence (`illicit/violent` 0.93 or more). A blocked message gets a kind no from Tali and costs nothing. Signs of self harm never block: she is told to answer with care and mention Lifeline 13 11 14.
- **Memory write back.** A watched video saves a `seen` memory ("Watched their video ...: summary"), and Claude is told to remember anything worth keeping from it. A second opinion that really differed saves an `idea` memory. Both go through `brain_remember_for` for that user only.

## Models chosen (checked 10 Nov 2026)

| Job | Model id | Source |
|---|---|---|
| Video | `gemini-3.8-flash` | https://ai.google.dev/gemini-api/docs/video-understanding and https://ai.google.dev/api/generate-content |
| Files upload | resumable upload, `v1beta/files` | https://ai.google.dev/api/files |
| Rerank | `rerank-2.5-lite` at `POST https://api.voyageai.com/v1/rerank` | https://docs.voyageai.com/reference/reranker-api |
| Second opinion | `gpt-5.4` (listed as current; it is the model the 20 credit price was worked out on) | https://developers.openai.com/api/docs/models/all |
| Safety | `omni-moderation-latest` | https://developers.openai.com/api/docs/models/all |

## Not built, on purpose

- (Built later the same day, see "The checker" below.)
- **Embeddings.** Still gte-small. Voyage is only used to rerank, so nothing in the database changed.
- **Perplexity, ElevenLabs, Mistral.** Not set up. Capabilities report false.

## Could not verify (no deploy, no live keys here)

- No real call was made to Gemini, Voyage or OpenAI. The code type checks (`deno check`), and the chunked video upload and the rerank ordering were run against stubbed responses.
- Voyage's response wrapper is read as `data[]` (falls back to `results[]`); the reference page did not show a full example.
- OpenAI Responses API structured output (`text.format` json_schema) and `reasoning.effort: 'low'` on `gpt-5.4`: if the reasoning setting is refused the call is retried once without it.
- Gemini accepts `video/mov` for iPhone .mov files (the bucket stores them as `video/quicktime`, which is mapped).
- A 200 MB video through an edge function: memory is fine (8 MB at a time) but the function's time and CPU limits have not been tested with a big file. Worth having the app compress videos before upload and testing a 10 minute one first.
- Moderation thresholds are a first guess set high on purpose. Watch the logs for `declined` messages in the first week.

## The checker (added 10 Nov 2026, later)

Function `tali-checker`, migration `20261110000057_checker.sql`. Deploy with verify JWT off.

- Every 30 minutes cron calls it only when `public.due_checker()` has someone due: onboarded, chatted at least twice since their last check, between 1am and 5am their time, not checked in the last 20 hours.
- It reads that one user's own messages since the last check (up to 60, at most 2 days back) and asks OpenAI (`TALI_CHECKER_MODEL`, default `gpt-5.4-nano`, falling back to `TALI_SECOND_MODEL`) for places Tali was wrong and the person corrected her.
- A finding is kept only if its evidence is a real quote from one of the person's own messages, it is not already in `checker_findings`, and there are at most 2 a night.
- Each one is saved to that user's brain as a `mistake` memory ("... Next time: ...") through `brain_remember_for`, source `checker/<date>`.
- Costs the user nothing. Logged in `usage` as feature `checker` with 0 credits, and in `job_runs` as job `checker`.
- Off switch: `select cron.unschedule('tali-checker');`
- Tested against stubbed services only (real mistake kept, invented evidence dropped, repeat dropped, model fallback, OpenAI outage). Never run live. The model id `gpt-5.4-nano` is proven by `tali-ai-selftest`.
