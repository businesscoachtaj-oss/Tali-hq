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
| First-run tour | Shows once on Today after onboarding, like the Totality apps: Tali walks through Today, Talk, Clients, Journal and Me with a pulsing ring on each tab, then a "You're all set" card. Skip ends it. Saved in `profiles.tour_done_at`. "Show me around again" in Me replays it. |
| Today | Business health (trial and paid), reminders and follow-ups due, add a reminder, Your day (food estimates, weight, today's session with a Done button), drafts waiting for your yes, the morning brief, trial days left. |
| Talk | Chat with Tali through `tali-chat` (her head sprite and bouncing dots while she thinks): checks your plan, reads your memories and journal, replies, saves what is worth remembering, and puts anything you ask her to write on Today as a draft. New chat button. |
| Clients | Clients and leads with status, follow-up dates and notes. Tali can add or update people and set reminders when you ask her in Talk. Invoices button. |
| Invoices (trial and paid) | List with owed and overdue totals, editor with line items and GST, your invoice details (ABN, how to pay), mark sent or paid, Share PDF (share sheet on phones, print to PDF on web). Tali can draft one from Talk. Tali never sends an invoice. |
| Journal | Yours: entries and notes, "Keep this from Tali" hides an entry from her completely. Tali's: her Sunday journal about the week (trial and paid). |
| Food and training | Logged by chatting with Tali. Food is her estimate (always shown as "about"), weight history, the weekly plan of day labels she writes, sessions this week and the streak. |
| Night school (Pro) | Pick up to 3 topics, every night or Mon, Wed and Fri. She researches one between 11pm and 3am with web search and leaves notes with her sources. |
| Rules (Pro) | Spot quiet clients, never miss a new lead, chase overdue invoices (drafts a reminder for your yes), weekly reminder. Rules only change things inside Tali HQ. |
| Tali's email (Pro) | Claim an address from your business name. Emails are summed up, spam is flagged and a draft reply lands on Today. Shows "switches on soon" until EXPO_PUBLIC_INBOUND_DOMAIN is set. |
| Voice (Pro) | Listen under Tali's replies plays her real voice (the Kokoro blend from her videos) through `tali-voice` and `voice-server/`. |
| Me | Plan and credits left, Tali's jobs menu, "What Tali knows about you" with Forget, Settings, Show me around again, Plans, sign out. |
| Settings | Edit profile, morning brief time, brief notifications, delete account. |
| Plans | Free, Tali HQ and Pro with founding member pricing. Stripe checkout on web only. |

## Backend (Supabase project `jbyzblwrywgxilhmfyjt`)

| Function | What it does | Status |
|---|---|---|
| `tali-chat` | One chat turn (credits reserved first, refunded on failure). Web search on trial and paid (2 credits a search). Drafts, clients, reminders, invoices, food, weight, workouts, training plans | Deployed v5. Needs `ANTHROPIC_API_KEY`. |
| `tali-brief` | Morning brief (trial/paid), Friday check-in (Free), Tali's Sunday journal (trial/paid), learns from new journal entries, push | Deployed v5, every 15 minutes. Needs `ANTHROPIC_API_KEY`. |
| `tali-night-school` | Pro night school with web search | Deployed, every 20 minutes (only does work 11pm to 3am local). |
| `tali-voice` | Pro: MP3 of a reply in Tali's voice, cached in the private `voice` bucket, 1 credit a new clip | Deployed. Needs `TALI_VOICE_URL` and `TALI_VOICE_KEY` (voice-server on Railway). |
| `inbound-email` | Pro: Resend inbound webhook (Svix verified), summary, spam check and draft reply | Deployed. Needs `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `INBOUND_DOMAIN` and the domain's MX records. |
| `tali-brain-embed` | Embeddings for memories and meaning search | Deployed, every minute. |
| pg_cron `tali-reminders`, `tali-health`, `tali-rules` | Reminder pushes (5 min), health nudges (twice a day), Pro rules (hourly) | Live. |
| `delete-account` | In-app account deletion (owner account protected) | Deployed. |
| `create-checkout`, `billing-portal`, `stripe-webhook` | Stripe for web. Live products Tali HQ (A$19.99) and Pro (A$39.99), coupon TALIHQ_FOUNDING (42.5% off forever), webhook endpoint registered. Price ids are built into `_shared/stripe.ts` | Deployed. Needs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `APP_URLS` (the web app address). |

Migrations 001 to 016 are in `supabase/migrations/` and applied. Auth email templates are in `supabase/templates/`.

Plans: Free (A$0, 50 messages a month), Tali HQ (A$19.99, 1,000 credits), Pro (A$39.99, 3,000 credits, plus night school, voice, Tali's email and rules). A chat message, brief, journal, inbound email or voice clip costs 1 credit; each web search 2 more.

`expo-asset` is pinned to the SDK 54 version with an npm override, because `expo-audio` asks for any version.

## Web build

```bash
npm run build:web   # outputs dist/, vercel.json handles routing
```

Installable as a PWA (Add to Home Screen on iPhone, Install on Chrome): `public/index.html` links `public/manifest.json`, Tali's icons (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`), the purple theme colour and the iPhone home screen tags. No service worker on purpose (Expo warns they cache too hard), so updates show on the next open.

Vercel: import the repo once (vercel.com/new). `vercel.json` sets the install and build commands and the `dist` output, and `.env.production` gives the build the public Supabase URL and publishable key, so no environment variables are needed. Every push to main redeploys. After the first deploy, add the site address in Supabase (Authentication, URL Configuration: Site URL and redirect URLs) and as the `APP_URLS` edge function secret for Stripe checkout.

## Builds

EAS profiles in `eas.json` carry the public Supabase URL and publishable key (EAS builds from git, so `.env` never reaches it). The app icon and splash use Tali's icon art (assets/icon.png).
