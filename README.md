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
| Connections: Google | One sign-in for Gmail and Google Calendar (Settings, Connections; trial, Tali HQ and Pro). Every 10 minutes Tali reads new inbox mail (only from the moment of connecting, promotions and social skipped), sorts it into Needs you / FYI / Junk, and drafts a reply for each Needs you email. Replies and anything she writes in chat land on Today with a "Send from Gmail" button; bookings she drafts get a "Book it" button that creates the Google Calendar event and emails the attendee. Her brief and chat see today and tomorrow with free gaps. Tokens are server only; disconnecting revokes the token and deletes everything that came from Gmail. Edge function `google-connect`, shared helper `_shared/google.ts`, scopes gmail.readonly, gmail.send, calendar.events, calendar.readonly. |
| Sign in / Sign up / Reset password | Email and password through Supabase Auth. Sign-up starts a 7 day Tali HQ trial (14 days before 2 Nov 2026) (database trigger). Waitlist emails get founding member pricing. |
| Onboarding | First name, business name and type, a few words about you. Tali reads this before every reply. |
| Tali sprite | `components/TaliAvatar.tsx`, like Totality's: her head bobs and blinks; full-body Tali stands still, blinks, and fades into another pose every 6 to 8 seconds (peek, wink, look right, curious, cheeky, shy, giggle) for 2 to 3 seconds, then fades back. Used in every Tali speech bubble, Talk's header and empty state, and the thinking row. The extra poses come from Tali's 100 pose set, lined up to the app sprite frame. |
| First-run tour | Shows once on Today after onboarding. Rewritten 3 Nov 2026: 11 steps that point at real spots on Today (the hero and brief, Tali's level, Needs your yes, Due today, At a glance) with a rounded highlight, then the Talk, Clients, Journal and Me tabs with a ring, then a "You're all set" card. Tali is on every card and there is a Back button. Steps in `lib/tour.ts`; a screen registers spots with `registerTarget` from `lib/tourTargets.ts` and the tour scrolls them into view. Skip ends it. Saved in `profiles.tour_done_at`. "Show me around again" in Me replays it. |
| Today | Business health (trial and paid), reminders and follow-ups due, add a reminder, Your day (food estimates, weight, today's session with a Done button), drafts waiting for your yes, the morning brief, trial days left. |
| Talk | Chat with Tali through `tali-chat` (her head sprite and bouncing dots while she thinks): checks your plan, reads your memories and journal, replies, saves what is worth remembering, and puts anything you ask her to write on Today as a draft. New chat button. |
| Clients | Clients and leads with status, follow-up dates and notes. Tali can add or update people and set reminders when you ask her in Talk. Invoices button. |
| Stripe (trial and paid) | Settings, Payments: Connect Stripe links the business's own Stripe account (Connect Standard, OAuth through `stripe-invoices`). Then Tali's invoice drafts land on Today with Send with Stripe, the invoice screen gets Send with Stripe, Stripe emails the client a pay by card link, and `tali-stripe-invoices` (pg_cron, 15 min) marks it paid and pushes "Jordan paid". Nothing is sent without the user's tap. Needs STRIPE_SECRET_KEY and STRIPE_CONNECT_CLIENT_ID, with the redirect URI https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/stripe-invoices added in Stripe Connect settings, OAuth. |
| Invoices (trial and paid) | List with owed and overdue totals, editor with line items and GST, your invoice details (ABN, how to pay), mark sent or paid, Share PDF (share sheet on phones, print to PDF on web). Tali can draft one from Talk. Tali never sends an invoice. |
| Journal | Yours: entries and notes, "Keep this from Tali" hides an entry from her completely. Tali's: her Sunday journal about the week (trial and paid). |
| Food and training | Logged by chatting with Tali. Food is her estimate (always shown as "about"), weight history, the weekly plan of day labels she writes, sessions this week and the streak. |
| Sleep (all plans, no credits) | Me, Sleep. 35 seamless sound loops in seven categories (Noise, Rain, Wind, Water, Fire, Night, Hum, five each): pick a category chip, then one or two tiles, and mix the levels. The loops are Pixabay Content Licence recordings, re-encoded to AAC (about 1 MB each) and hosted with the web app in `public/sounds/` (Vercel serves them at `/sounds/<id>.m4a` with `audio/mp4` and a one year cache, see `vercel.json`). They are not inside the native binary: the web app loads them by relative path and phone builds stream them from `SOUNDS_BASE` in `constants/business.ts` (`https://talihq.com.au/sounds`). Pick a timer (15 min to 90 min, or until morning), and the last 5 minutes fade to silence, then it stops. Keeps playing with the phone locked (expo-audio background mode, lock screen controls); on the web it plays while the tab is open. The screen is its own dark purple and blue and dims after 20 seconds. Picks and timer are remembered on the device. Engine and catalogue in `lib/sleep.ts`, screen `app/(app)/sleep.tsx`. Native builds after 2 Nov 2026 need the expo-audio plugin in `app.config.js`, already added. |
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

Plans: Free (A$0, 250 messages a month), Tali HQ (A$19.99, 1,000 credits), Pro (A$39.99, 3,000 credits, plus night school, voice, Tali's email and rules). A chat message, brief, journal, inbound email or voice clip costs 1 credit; each web search 2 more.

`expo-asset` is pinned to the SDK 54 version with an npm override, because `expo-audio` asks for any version.

## Web build

```bash
npm run build:web   # outputs dist/, vercel.json handles routing
```

Installable as a PWA (Add to Home Screen on iPhone, Install on Chrome): `public/index.html` links `public/manifest.json`, Tali's icons (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`), the purple theme colour and the iPhone home screen tags. No service worker on purpose (Expo warns they cache too hard), so updates show on the next open.

Vercel: import the repo once (vercel.com/new). `vercel.json` sets the install and build commands and the `dist` output, and `.env.production` gives the build the public Supabase URL and publishable key, so no environment variables are needed. Every push to main redeploys. After the first deploy, add the site address in Supabase (Authentication, URL Configuration: Site URL and redirect URLs) and as the `APP_URLS` edge function secret for Stripe checkout.

## OTA updates

Set up 3 Nov 2026, the same way as Totality and Nutrition: `expo-updates`, `runtimeVersion: { policy: 'appVersion' }` and `updates.url` in `app.config.js`, and `.eas/workflows/publish-update.yml`. The first store build after that commit is the one that turns OTA on (earlier builds have no `expo-updates` and never check). From then on a JavaScript-only change goes out by pushing to the `ota-publish` branch, which runs the workflow and publishes to the production channel; a build only picks up updates for its own app version, so don't bump `version` for an OTA.

## Builds

EAS profiles in `eas.json` carry the public Supabase URL and publishable key (EAS builds from git, so `.env` never reaches it). The app icon and splash use Tali's icon art (assets/icon.png).

### Notifications (2 Nov 2026)
Push reaches every device a user has. Phone builds use Expo push tokens. The web app and PWA use standard web push: `public/sw.js` is the service worker, the VAPID key pair is generated once by the `push-send` function and kept in `public.web_push_keys` (server only), and the app reads the public key through `vapid_public_key()`. On iPhone, web push only works once Tali HQ is added to the Home Screen. Every sender (brief, Gmail sort, Tali's email, Stripe invoices, reminders, health checks) goes through `_shared/push.ts` or `public.push_user()`.

### Talk back to a draft, and Share to Tali (2 Nov 2026)
On any draft card on Today: "Tali, make it shorter / warmer / more formal / something else..." sends the instruction to `tali-draft-edit`, which rewrites the draft in place (1 credit, old text kept in `draft.previous`). Calendar bookings and Stripe invoices are not editable this way. The PWA is also a share target (`share_target` in `public/manifest.json`): on Android, Share from any app and pick Tali HQ, and the text or link lands in Talk's composer for the user to send. iPhone does not offer web share targets.

### Microsoft 365 / Outlook (2 Nov 2026)
The twin of the Google connection. `ms-connect` (mirrors google-connect) and `_shared/microsoft.ts` use Microsoft Graph with delegated scopes Mail.Read, Mail.Send, Calendars.ReadWrite, User.Read, offline_access. Tokens live in `microsoft_connections` (server only). Outlook mail lands in `inbound_emails` with `source = 'outlook'`, sorted every 10 minutes by cron `tali-outlook-sync`, and drafts on Today use `outlook_send` / `outlook_calendar_create`. Chat and the brief read whichever calendar is connected (Google first). Needs an Entra app registration (any org + personal accounts, redirect `https://jbyzblwrywgxilhmfyjt.supabase.co/functions/v1/ms-connect`) and the secrets `MS_CLIENT_ID` and `MS_CLIENT_SECRET`; until then the Settings card says it switches on soon.

### Voice notes and Patterns (3 Nov 2026)
Voice notes (parked: built but switched off with `VOICE_NOTES_ON = false` in `lib/voiceNotes.ts` until we use an OpenAI key; when on, Tali HQ and trial 1,800 seconds a month, Pro uncapped, 1 credit a note): the mic in Talk's composer. Tap to record (pulsing red dot and a clock, 3 minutes tops), tap to stop, and the words land in the box to check before Send. The clip goes to the private `chat-uploads` bucket under `<uid>/voice/`, `tali-transcribe` turns it into text with OpenAI `gpt-4o-mini-transcribe` (secret `OPENAI_API_KEY`; without it the app says voice notes are not switched on yet), writes the clip length onto the usage row and deletes the clip. Recording logic in `lib/voiceNotes.ts`, button in `components/MicButton.tsx`. Switching it on also needs the expo-audio `microphonePermission` back in `app.config.js` and a new native build.

Patterns (Pro, 10 credits, monthly, automatic): `tali-patterns` runs from the cron in migration 034 (x-tali-key) for every Pro user with 14 or more days of data in the last 60, reads journal, shutdown moods, reminders done and missed by weekday, clients added and gone quiet, invoices paid and overdue, commitments, goals, chat days, food and weight, and asks Claude for up to 3 patterns with the numbers behind each. Saved as a `briefs` row (kind `patterns`), pushed as "Tali noticed something". POST with the user's JWT runs it for that user now (Run now on Me). App: `components/PatternsCard.tsx` (Today, Journal's Tali tab, the Patterns row on Me), `lib/patterns.ts`. Migration 035 (`_sense`): audio mime types on the bucket and `my_voice_seconds()`.

### The owner's rhythm: shutdown, weekly review, goals (3 Nov 2026)
Schema in migrations 034 and 035 (035 also lets `shutdown` through `chat_try_consume` on Free, counted as a message, and adds `tali_review_context`).
- **Shut the day down** (all plans, 1 credit, a message on Free): `app/(app)/shutdown.tsx`, Today card `components/ShutdownCard.tsx` (shows from two hours before the shutdown time, then "Day closed"). Edge function `tali-shutdown` saves the day, writes the note to the journal (title "Shutdown"), turns tomorrow's three into 9am reminders and returns Tali's one line sign off. Settings: shutdown time and "Nudge me to shut down". Push `/shutdown` comes from the `tali-shutdown-nudge` cron.
- **Weekly review** (trial, HQ, Pro, 3 credits): `app/(app)/review.tsx`, Today card `components/WeekCard.tsx` (this week's three with tick boxes, review prompt on the review day until done; Free sees a line and a Plans button). Edge function `tali-review` reviews the week ending the day before the review day (Monday to Sunday for a Sunday review), saves to `reviews`, and the app saves the three commitments for the following Monday. Settings: review day and time.
- **Goals** (trial, HQ, Pro, no credits): `app/(app)/goals.tsx`, Today card `components/GoalsCard.tsx`. Add, edit, update the number, done or dropped, "Ask Tali" opens Talk prefilled. Tali can save goals from chat through `tali_save_goal`.
- App helpers in `lib/rhythm.ts`.

## Today, calmer, with Tali's level (3 Nov 2026)
- Today is now: Tali's card (greeting, her line, "Read your brief", Tali's level), a one-line meeting nudge, drafts as tap-to-open rows, due today, the evening shutdown card, four "at a glance" tiles (money, health, this week, goals) and one "More from Tali" row for calendar, your day, patterns, decisions and older notes.
- Tali's level: XP from active memories (2), night school nights (15), journal entries (3), jobs done (1) and chats (2). Nine levels from New starter to Chief of staff (`lib/level.ts`). Counts come from `my_tali_level()` (migration 036).

### Quality of life pass (4 Nov 2026)
One sweep across every screen. Shared bits in `components/ui.tsx`: `Screen` takes `onRefresh` (pull to refresh on every list screen), `goBack(fallback)` so back links return to where you came from, and `useConfirm()` for two-tap "Sure?" on anything destructive (Not needed, Delete, Void, Remove, Sign out, discarding a journal edit). Today: a nudge card when an email needs a look, night mode once the day is shut down (night sky hero, "Day's done. Bed time?", a Sleep sounds button; `components/NightSky.tsx` is shared with Sleep), Tomorrow and Delete on reminders, follow-ups open the person, "Earlier notes" open the full brief, no empty-state flash before data loads. Sleep: one player registry so changing sounds or pressing Start again never stacks players, and a five second preview on each tile. Email: the address picker (`claim_tali_inbox(p_alias)` and `suggest_tali_alias()` in migration 20261104300000, company words like Pty Ltd stripped from the suggestion), Tali's address shown first for Pro users without Gmail, an empty state, Junk everywhere, replies to Tali's address sent through the connected Gmail or Outlook when there is one (`tali-send`), the inbound push opens Email, and a decided approval marks its email handled (trigger `approvals_mark_email_handled`). Me: Settings up top, memories collapsed, Goals, Weekly review and Shut the day down in Tali's jobs. Settings: Save waits for the rhythm settings to load, "Saved." clears on edit, Connections reachable from Me. Talk: failed sends keep the text with Try again, starter chips fill the box instead of sending, plan re-checked on focus. Plus the long tail: Rules key fix (saved rules showed defaults), Goals "Ask Tali" param, date validation on Decisions, invoice notes and Void confirm, Money opens the invoice, Plans shows HQ users how to move to Pro, sign-in errors in Tali's voice, resend on sign-up, sign out on onboarding, native connect cards point to the web app.

## Tali's brain, in sections (6 Nov 2026)

- Every memory is filed into a part of the brain by a router trigger (`brain.route_memory`): hippocampus (facts, events), temporal (people), cerebellum (lessons, mistakes), frontal (rules, preferences), prefrontal (plans, ideas, plus live goals and open decisions), occipital (`seen`: what was in a photo), amygdala (`urgent`, plus contradictions to settle). Thalamus, hypothalamus, parietal, basal ganglia, brainstem and corpus callosum are counted from what already exists.
- Contradictions: tali-chat flags a new memory that contradicts an old one (`brain.conflicts`); the user settles it on the Brain screen (keep new, keep old, both true). The one not kept is marked as merged.
- Lessons that prove themselves: tali-chat reports which lessons, rules and mistakes held (`confirmed_count`) or broke (`broken_count`). 3 holds and no breaks = proven (recalled first), 2+ breaks and more breaks than holds = not holding up (recalled last).
- Links: names shared across parts are drawn as lines in the 3D brain.
- Screen: `app/(app)/brain.tsx` with `components/BrainGlobe.tsx` (Reanimated and gesture handler, no 3D library, so it ships over the air). `my_brain('mine')` for everyone; `my_brain('main')` for the founder: every user's memories count, only his own and the shared brain are readable.
- Migration `20261106000041_brain_sections.sql` must run before the tali-chat deploy and before the app update.

## The shared brain learns from everyone (6 Nov 2026)

- Lessons, mistakes and rules from every user (night school lessons straight away, chat ones once proven: held 3+ times, never broken) are sent to the shared brain by `tali-brain-share` (weekly, Sunday 2:47am Sydney, via pg_cron), after Claude rewrites each with no names, clients, places, prices or contact details, or drops it. Facts, people, events, photos, journal and chats are never shared.
- On by default: `profiles.share_learning`, switched off in Settings (Your privacy, Help every Tali learn). One memory can be marked Private on the Brain screen (`brain.memories.private`). `shared_at` marks a memory the scrub has looked at.
- The tour's second last step says how to switch it off. The privacy policy (totality360.com.au/privacy.html, Tali HQ section) says the same.
- Migration `20261106000042_shared_learning.sql`; deploy `tali-brain-share` with verify_jwt false.

## Tali's education (6 Nov 2026)

- A nightly scheduled task ("Tali: Education") studies real subjects for two parts of the brain a night, oldest first, and saves what it learnt to the shared brain with `brain_learn(region, content, about, ref, confidence)` as kind `knowledge` (user_id null). Subjects per part are in `lib/brain.ts` (REGIONS.studies). `brain_education_progress()` shows how far each part has got.
- Everyone's Brain screen shows the shared knowledge in each part; it is general knowledge with sources, never personal.
- Migration `20261106000043_education.sql` (also replaces my_brain so every part counts its own memories).

## Images (6 Nov 2026)

Tali makes images in Talk. When someone asks for one, `tali-chat` fills `make_image` and saves her reply with a placeholder attachment (`making: true`, the prompt and a shape). The app then calls `tali-image`, which reserves one image (`image_try_consume`), draws it with OpenAI (`gpt-image-2`, medium quality, square, portrait or landscape), saves the PNG to the private `chat-uploads` bucket, swaps the placeholder for the file and remembers it in the occipital part of her brain (kind `seen`). A failure refunds the image and the placeholder shows the reason, with Try again where it can work.

Images are counted on their own, separate from credits (`plans.images_month`): Free none, the 7 day trial 5, Tali HQ 30 a month, Pro 100 a month. Long founder trials get the full plan. Me shows images left.

Secrets: `OPENAI_API_KEY` (required, also turns on voice notes), optional `TALI_IMAGE_MODEL`. Migration `20261106000045_images.sql`. Deploy `tali-image` with `--no-verify-jwt`, and redeploy `tali-chat`.

### Free web search (6 Nov 2026)
Free gets 10 web searches a month (asked for by Taj, so Free Tali is not behind the free chat apps). Counted on their own: one `usage` row per search with feature `web_search_free` and 0 credits, so they never touch the 250 messages. `plans.searches_month` (Free 10, others 0), `search_allowance_for(user)` (service role) and `my_searches()` (app) in migration 20261106000047; `my_credits` carries `searches` for Free. `tali-chat` turns the search tool on for Free while searches remain (at most 3 per message), tells Tali how many are left, and when they are gone she says she cannot search, gives what she knows as possibly out of date and mentions Tali HQ once. Trial, Tali HQ and Pro are unchanged (2 extra credits a search). Me shows "X of 10 web searches left this month." for Free; the Free plan list says it; the Founder screen labels the usage. Deploy: run the migration SQL, then deploy `tali-chat` and push an OTA.
