# Tali HQ

The app where small business owners work with Tali, an AI teammate who remembers their business. By Totality 360, made in Australia.

## Run it

```bash
npm install
cp .env.example .env
npx expo start          # press w for web, i for iOS simulator, a for Android
npm run typecheck
```

## What's in the app

| Screen | What it does |
|---|---|
| Sign in / Sign up / Reset password | Email and password through Supabase Auth. Sign-up starts a 14 day Tali HQ trial (database trigger). Waitlist emails get founding member pricing. |
| Onboarding | First name, business name and type, a few words about you. Tali reads this before every reply. |
| Today | Reminders and client follow-ups due (tick when done), add a reminder, drafts waiting for your yes (Copy, Done, Not needed), the morning brief, trial days left. |
| Talk | Chat with Tali through `tali-chat`: checks your plan, reads your memories and journal, replies, saves what is worth remembering, and puts anything you ask her to write on Today as a draft. New chat button. |
| Clients | Clients and leads with status, follow-up dates and notes. Tali can add or update people and set reminders when you ask her in Talk. |
| Journal | Journal entries and notes. "Keep this from Tali" hides an entry from her completely. |
| Me | Plan and credits left, "What Tali knows about you" with Forget, Settings, Plans, sign out. |
| Settings | Edit profile, morning brief time, brief notifications, delete account. |
| Plans | Free, Tali HQ and Pro with founding member pricing. Stripe checkout on web only. |

## Backend (Supabase project `jbyzblwrywgxilhmfyjt`)

| Function | What it does | Status |
|---|---|---|
| `tali-chat` | One chat turn (credits reserved first, refunded on failure) | Deployed. Needs `ANTHROPIC_API_KEY`. |
| `tali-brief` | Morning brief (trial/paid) and Friday check-in (Free) at each user's time, learns from new journal entries, sends a push | Deployed, runs every 15 minutes via pg_cron. Needs `ANTHROPIC_API_KEY`. |
| `tali-brain-embed` | Embeddings for memories and meaning search | Deployed, every minute. |
| pg_cron `tali-reminders` | Pushes due reminders every 5 minutes straight from the database | Live. |
| `delete-account` | In-app account deletion (owner account protected) | Deployed. |
| `create-checkout`, `billing-portal`, `stripe-webhook` | Stripe for web | Written, not deployed. Needs Stripe products, prices, the founding coupon and secrets. |

Migrations 001 to 011 are in `supabase/migrations/` and applied. Auth email templates are in `supabase/templates/`.

Plans: Free (A$0, 50 messages a month), Tali HQ (A$19.99, 1,000 credits), Pro (A$39.99, 3,000 credits). A chat message or a morning brief costs 1 credit.

## Web build

```bash
npm run build:web   # outputs dist/, vercel.json handles routing
```

## Builds

EAS profiles in `eas.json` carry the public Supabase URL and publishable key (EAS builds from git, so `.env` never reaches it). The app icon and splash use Tali's icon art (assets/icon.png).
