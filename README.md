# Tali HQ

The app where small business owners work with Tali, an AI teammate who remembers their business. By Totality 360, made in Australia.

## Run it

```bash
npm install
cp .env.example .env
npx expo start          # press w for web, i for iOS simulator, a for Android
npm run typecheck
```

## What's in Phase 1

| Screen | What it does |
|---|---|
| Sign in / Sign up | Email and password through Supabase Auth. Sign-up starts a 14 day Tali HQ trial (database trigger). |
| Onboarding | First name, business name and type, a few words about you. Tali reads this before every reply. |
| Today | What needs your yes, the morning brief, trial days left. |
| Talk | Chat with Tali. Each turn goes through the `tali-chat` edge function, which checks your plan, reads your memories and journal, replies, and saves anything worth remembering. |
| Journal | Journal entries and notes. "Keep this from Tali" hides an entry from her completely. |
| Me | Plan and credits left, "What Tali knows about you" with Forget, sign out. |

## Backend

- Supabase project `jbyzblwrywgxilhmfyjt` ("Tali HQ").
- `supabase/migrations/`: brain schema, app tables (all RLS), chat credit functions.
- `supabase/functions/tali-chat`: needs the `ANTHROPIC_API_KEY` secret set in the project (Edge Functions, Secrets). `TALI_MODEL` is optional (defaults to `claude-haiku-5-5`).
- `supabase/functions/tali-brain-embed`: fills memory embeddings every minute (pg_cron + vault key).

Plans: Free (A$0, 50 messages a month), Tali HQ (A$19.99, 1,000 credits), Pro (A$39.99, 3,000 credits). One chat message costs 1 credit.

## Builds

EAS profiles in `eas.json` carry the public Supabase URL and publishable key (EAS builds from git, so `.env` never reaches it). The app icon and splash are placeholders copied from Totality Nutrition until the Tali HQ art is made.
