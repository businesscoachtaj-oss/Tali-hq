# Tali HQ: notes for AI agents

## Expo HAS CHANGED

This app is pinned to **Expo SDK 54** (React Native 0.81.5, React 19.1, expo-router 6), the same set Totality and Totality Nutrition ship on. Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code. Do not bump the SDK without Taj's say-so.

## What this is

Tali HQ is Totality 360's app where small business owners work with Tali, an AI teammate who remembers their business. Phase 1: sign up, onboarding, chat with Tali, journal and notes, plan and credits, and "What Tali knows" (view and forget memories).

- Supabase project: **Tali HQ**, ref `jbyzblwrywgxilhmfyjt` (ap-southeast-2). Not the Livewell project.
- Database: `supabase/migrations/`. Public tables are RLS on `auth.uid()`. Schema `brain` is server-only (no API access).
- Tali's brain: `brain.memories` with `user_id` (null = shared brain, never personal details). Taj's own brain is user `e89ca9de-a86e-4dd6-8094-bc518566352e`, which Tali's scheduled jobs also use. Never touch other users' rows from a job.
- Edge functions: `supabase/functions/`. `tali-chat` (one chat turn, credits reserved first), `tali-brain-embed` (embeddings every minute via pg_cron).
- Secrets live in Supabase, never in the app: `ANTHROPIC_API_KEY`, optional `TALI_MODEL`.

## House rules

- Australian English. No em dashes or en dashes anywhere, in UI copy, comments or Tali's replies.
- Tali never sends, spends or changes anything without the user's yes (the `approvals` table).
- Don't make product changes Taj hasn't asked for. Keep product claims accurate.
- Web/PWA deploys and store builds: give Taj the commands, don't deploy yourself.
- Keep `README.md` and the build log (`claude/TaliHQ_Build_Log.md` in the Totality project) up to date, append only.
