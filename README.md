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

## Visual memories (6 Nov 2026)

The images Tali made for someone live in the occipital (vision) part of their brain: tap Occipital lobe on the Brain screen and a Visual memories grid shows every image, newest first. Tap one to see it big with what she drew, open it full size, go to the chat it came from (Talk takes `?chat=<conversation id>`) or delete it. Deleting removes the file, leaves a short "You deleted this image" note in the chat and forgets her memory of making it. Migration `20261106000046_visual_memories.sql` (`my_visual_memories`, `delete_visual_memory`, own rows only).

### Models per job (6 Nov 2026)
Taj's call. Everyday Tali (chat, brief, Gmail sorting, shutdown, drafts) stays on `TALI_MODEL` (default claude-haiku-5-5). The weekly review (`tali-review`), monthly patterns (`tali-patterns`) and night school (`tali-night-school`) use `TALI_DEEP_MODEL` (default claude-sonnet-5-5): they are rare and need real thinking across weeks of data. The shared-brain scrub (`tali-brain-share`) uses `TALI_SHARE_MODEL` (default claude-opus-5-5): it decides what is personal before a lesson reaches every user, and runs weekly, so it costs cents. Credits charged to users are unchanged. Change any of the three by setting the secret in Supabase, no deploy needed.

### Deep think and Big brain (6 Nov 2026)
Asked for by Taj. A switch above the composer in Talk sends the next message to a smarter model with more of her brain (30 memories and 12 recent instead of 10 and 8, via the three-argument `tali_context`, and up to 4,000 tokens to answer). Deep think: Sonnet (`TALI_DEEP_MODEL`), 20 credits, on trial, Tali HQ and Pro. Big brain (level `deepest`): Opus (`TALI_DEEPEST_MODEL`), 40 credits, Pro only. Free gets 1 Deep think a month (`plans.deep_month`, usage feature `deep_think_free`, on top of the normal message). On everyday chats Tali can set `suggest_deep` on a big question; the reply gets a "Deep think this" button that resends the question. Deep replies carry `messages.meta.deep` and show a DEEP THINK or BIG BRAIN label. Failed turns refund the credits and the free one. Migration 20261106000048 (`deep_allowance_for`, `my_deep`, `my_credits` with `deep`). Also fixed in `TaliMessage`: a heading line right above a list no longer pushes the first item into the list above it.

### Me tab redesign (6 Nov 2026)
Asked for by Taj after a mockup. Header with initial avatar and a Settings gear; plan card with credits left as a big number, a bar and stat tiles (images, web searches, Deep think, top-up date); a dark "Tali's brain" card that opens /brain; Tali's jobs as two-column icon tiles grouped Your day, Your business and You, with TALI HQ and PRO badges; the memories list, Settings, the tour and Sign out as rows at the bottom. Same screens and data as before.

### Page banners, depth and Sleep (6 Nov 2026)
Asked for by Taj after mockups. Every Me page (Food and training, Goals, Weekly review, Shutdown, Decisions, Clients, Invoices, Money, Inbox, Rules, Night school) opens with its own gradient banner (`SkinHeader` in `components/PageSkin.tsx`): an Ionicon, a kicker line, the title and the sub, with a matching soft page background via `<Screen skin="...">`. Depth pass to match Totality and Nutrition: buttons, inputs, chat bubbles and chips now sit on a soft shadow (`elevation.lift`). Sleep redone as a blend of the night sky look and a calmer layout: Tali asleep in a glowing moon up top, round sound type buttons with line icons, one list of sounds with play and pick, a sliding How long pill (with until morning), and the fade switch under Start.

### Brain: the temporal lobe lights up (6 Nov 2026)
Found while building the website demo. The rule that files cortex dots into parts asked for `y < -0.12`, which no dot ever reached, so the temporal lobe (the people in your world) had no dots and never lit up. It now takes the lower outer sides of each half (about 34 dots).

### Brain screen laid out like the website (6 Nov 2026)
Asked for by Taj after the website demo. One night card holds the 3D brain, then the part you picked (what it does in you, in Tali, what she studies at night, and the memories she keeps there as cards with a coloured edge, with Forget, Private and settle still working), then every part as a dark chip with its count. The panel always shows a part: the one you tapped, or the first with something in it.

### Tali grows, receipts and top ups (6 Nov 2026)
Asked for by Taj after mockups, from what was in his own Tali HQ dashboard. Migration 20261106000049.
- **Brain screen:** her level with the whole ladder of titles (from `my_tali_level`), a search box across everything she keeps, and New this week (memories from the last 7 days).
- **Tali suggests (Rules, Pro):** the weekly review (`tali-review`) can suggest up to two rules into `rule_suggestions`: a habit (how she works, saved as a preference in her brain on yes) or an automation (turns on a Rules template with settings on yes). `my_rule_suggestions`, `answer_rule_suggestion`. Never repeats a rule they have or one already suggested.
- **An idea from night school (Today):** `tali-night-school` now saves one `idea` and `idea_why` per class. `my_night_idea` shows the newest unanswered one from the last 3 days. Let's try it opens Talk with the idea ready and saves it to her brain as an idea; Not for me hides it (`answer_night_idea`).
- **Receipts (Me, Tali HQ and Pro):** private `receipts` bucket and table. Snap or add a file, `tali-receipts` (action read, Haiku, no credits) fills in vendor, date, total, GST and type, you check and save. Download the financial year as one zip with `receipts.csv` (action zip, `receipt-exports` bucket, signed link for an hour).
- **Top up (Me):** one-off Stripe Checkout payments for extra credits, images or a bundle. Packs live in `supabase/functions/_shared/topups.ts` (the app list in `app/(app)/top-up.tsx` must match). `create-checkout` takes `{ topup }`; `stripe-webhook` records a paid session once with `add_topup`. Extras never expire and are used after the month's own: `usage.extra_credits` records the part of a charge taken from extras, images from extras are `usage.feature = 'image_extra'`. `chat_try_consume`, `image_try_consume`, `image_allowance_for` and `my_credits` know about them. Out of credits in Talk shows a Top up button. Shown on every platform for now, iPhone included (Taj's call, 6 Nov 2026).

### Top ups in the founder revenue (6 Nov 2026)
Asked for by Taj. The Founder page's revenue tile is now "Revenue this month": plan list price times paying accounts plus top ups sold this month, with a Top ups this month tile (packs sold and all time). `founder_topups()` (migration 20261106000050, founder only) reads `public.topups`. His Tali HQ dashboard artifact shows the same in the pulse tile and the Money card.

### Who wrote each memory (7 Nov 2026)
Asked for by Taj, so the brain can be used to train Tali's own open model one day. Anthropic's and OpenAI's terms stop us training a competing model on their outputs, so `brain.memories.written_by` says who wrote each memory: `claude`, `openai`, `taj`, `user` or `original` (the source text Tali studied, with `source_url` and `licence`). Default `claude`, and all 315 memories as of today are Claude's: Tali keeps using them, they just never go into training. `brain.training_safe` (server only) lists the pile that is safe to train on: Taj's own words and openly licensed originals (public domain, CC0, CC BY, CC BY-SA), never private ones. User words join only once a consent setting exists (not built). Nothing changes in the app. Migration `20261107000052_brain_written_by.sql`.

## Tuesday list (9 Nov 2026)

- Check before sending: `components/SendChecks.tsx` on every draft. Leftover [placeholder] text holds Copy and Send. Edge function `sending-health` (verify_jwt on, read only) says which address the draft goes from and, for the Tali address, bounces in 30 days from Resend.
- Brain: skills show used, worked and last used (migration `20261109000053_brain_skill_stats.sql`, my_brain adds uses, wins, last_used, status). Lessons and mistakes say how many times they held. How Tali thinks (`app/(app)/brain-ai.tsx`, founder only): each part's AI now and planned, from `claude/Tali_Brain_AI_Map.md`.
- Founder: trials and conversions for Totality, Nutrition and Tali HQ, To confirm, health light. Edge function `founder-ops` (verify_jwt on, founder only) reads Livewell through `tali_hq_founder_snapshot(p_key)` (run `supabase/livewell/20261109_tali_hq_founder_snapshot.sql` in the Livewell project) with the shared key in the Livewell vault (`tali_hq_founder_key`) and this project's secret `LIVEWELL_FOUNDER_KEY`. Migration `20261109000054_founder_ops.sql`: `founder_to_confirm` table, `founder_to_confirm()`, `founder_confirm_done(id)`, `founder_model_checked(model)`, and `founder_add_to_confirm(text, source)` for Tali's jobs.
- Banners (PageSkin) on Settings, Plans, Brain, Founder and Users; Journal restyled in plum.

## 2026-11-10: brain look across the app, extra AIs, emails (PR #31)

- Today opens on her brain with the day as stars (components/BrainSky.tsx), Talk sits in her space with "New memory" tags, Your world has the living map (components/WorldMap.tsx), night sky theme on every screen, getting started asks about you first.
- Extra AIs through tali-chat and supabase/functions/_shared/brainAi.ts: watch a video (5 credits a started minute), second opinion (20 credits), reranked memory search, safety screen. The app asks what is switched on (lib/capabilities.ts), so features without a key show as Coming soon. Contract in docs/BRAIN_AI_CONTRACT.md.
- Emails: welcome email (tali-welcome) and redesigned auth templates. Steps in docs/EMAILS.md.
- Full report and the steps to put it live: docs/BUILD_REPORT_2026-11-10.md.
- The checker: tali-checker runs nightly for everyone who chatted and turns Tali's corrected mistakes into lessons in that person's own brain (migration 20261110000057, free to the user).
- Brain overhaul (same PR): Voyage embeddings beside the old index, my_connections, my_upcoming, my_memory_update, weekly tidy for customers, day one fill, forward to Tali, day 3 email, my_brain_export, share card. Docs: docs/BRAIN_OVERHAUL.md, docs/BRAIN_OUTSIDE.md. One file to run: docs/RUN_10NOV_ALL.sql.

## 10 Nov 2026: onboarding, tour and Tali HQ Max

- **Onboarding** (`app/onboarding.tsx`): one question a screen in her night sky (name, what you want a hand with, business or just you, anything she should know). Saves the same profile fields as before.
- **Tour** (`lib/tour.ts`, `components/AppTour.tsx`): rewritten for the brain Today and the real tabs (Today, Talk, Her brain, Your world, Me). The old steps pointed at Clients and Journal tabs that no longer exist. New targets `brain`, `level` and `tell` are registered in `components/BrainSky.tsx`. Night sky card, serif titles, step bar.
- **Tali HQ Max** (plan id `max`): A$99.99 a month, A$1,019.90 a year. 10,000 credits and 300 images a month. Deep think, Big brain and second opinions cost half the credits, and she brings up to twice as many memories to each reply (both in `tali-chat`, paying Max members only). Everything Pro can do, Max can do (`isPro` counts Max; `isMax` for the half-price labels).
  - Stripe: product `prod_VbDF03EfaCxpDJ`, monthly `price_1Ua0ohPy9YlWBZ02UFtAJDRn`, yearly `price_1Ua0otPy9YlWBZ02sl7BwXb7`. Founders use coupon `TALIHQ_FOUNDING_MAX` (42.5% off, Max product only) because the first founding coupon is tied to the HQ and Pro products.
  - Database: `supabase/migrations/20261110000060_max_plan.sql` adds the plan row and adds `max` to every function that lists the paid plans.
  - Deploy order: functions first (`create-checkout`, `stripe-webhook`, `tali-chat`, `tali-review`, `tali-transcribe`, `tali-patterns`, `tali-receipts`), then the SQL. The plan card shows as soon as the SQL runs.

## 10 Nov 2026 (later): day into night, the lens, the business switch

- **Day into night** (`lib/sky.ts`, `PageSky` in `components/NightSky.tsx`): the sky is a deeper violet into royal blue through the day and fades into the night sky over the two hours before the shut the day down time. Night straight away once the day is shut down, until dawn (5am to 6am).
- **Day closed** on Today: only her brain (turning at half speed, `speed` on `BrainGlobe`), her goodnight line, Sleep sounds and Journal buttons, and the Day closed card with mood and tomorrow's three. The day's lists come back in the morning.
- **The lens** (`components/BrainSky.tsx`, `app/(app)/index.tsx`): People, Work, Money, Health and Growth under her brain are filters. Tap one and the stars, her line and the sections below follow. Tap again for everything.
- **Business switch** (`lib/business.ts`, `profiles.has_business`, migration 061, already applied): "Do you run a business?" in onboarding and Settings. Off, Your world drops Invoices, Receipts and Rules, Your people is one list with no clients and leads, follow-ups read "Check in with", and the business health tile goes. Nothing is deleted.
- **Fixes**: Her brain cards open; Your world shapes keep moving (Reanimated); receipts readable; prices say A$ everywhere; safe dates; Vercel builds `main` only (`ignoreCommand` in `vercel.json`).

## The sky has depth (10 Nov 2026)

- Taj: "the background doesn't feel like it has depth", worst by day when the stars are gone. The page sky (`PageSky` in `components/NightSky.tsx`) was one smooth gradient with 28 same-size stars.
- It is now built in layers, back to front: the sky (darker overhead, lighter toward the horizon), far colour light with one glow behind her brain, far dust, mid points, a few near out of focus discs and bright stars, then a vignette.
- Each layer drifts at its own speed and moves by its own amount on scroll (`skyScroll`, fed by Today and by `Screen` in `components/ui.tsx`). Drift is off when the phone has Reduce Motion on.
- The glows are two small pictures in `assets/sky/` (`glow.png`, `bokeh.png`), tinted and stretched, so nothing new is installed and it looks the same on phones and the web.
- `Aurora` is now empty: its colour light lives inside the sky. JavaScript and images only, so it can go out as an OTA.
- Fix, same day: on Android Chrome the whole sky flashed off and on. Each glow was one white picture tinted in code, which on the web is a filter the browser redraws whenever the layer moves, and the layers were being moved from JavaScript every frame. Now each glow is its own ready-coloured picture (no filters), and on the web the drift is a CSS animation on a layer the browser slides without redrawing. Phones keep the native animation.

## The lens lights her brain (10 Nov 2026)

- Taj: pick a focus on Today and "lit up the appropriate brain parts only with the white dots in them". `BrainGlobe` takes a new `lit` list of parts; those draw in the picked look (bigger, white core, glow) and the rest dim. The lines between parts hide while a lens is on.
- Which parts each lens lights is `LENS_REGIONS` in `components/BrainSky.tsx`, chosen by what each part holds: People is the temporal lobe; Work is prefrontal, frontal and parietal; Money is hippocampus and amygdala; Health is hypothalamus and brainstem; Growth is cerebellum and basal ganglia.
- Fix, same day, second go: the CSS drift kept eight sky layers in the phone's graphics memory, each bigger than the screen. Phones ran out and the browser dropped pieces of the page (half of Me missing, Your world blank). On the web the sky is now completely still: no drift, no scroll shift, no layers of its own. Phone apps keep the motion, which runs natively.

## Brain overhaul, part 2 (10 Nov 2026, evening)

Full notes: `docs/BRAIN_OVERHAUL_2.md`. Applied to the database and tested. Nothing changes in the app yet.

- **Recall test.** 40 real questions with known right answers (`brain.eval_cases`), scored by `brain.eval_run()`. First score: words only put the right memory first 50% of the time and in the top 5 60% of the time. Words and meaning together (live since this morning): 80% and 100%.
- **Memories that age.** Each memory tracks when it was last confirmed. Old facts, plans and events that nobody has confirmed in 45 days are handed to Tali with the date they were noted.
- **Sleep for everyone.** A nightly job (`tali-brain-sleep`) that merges repeats, lets a newer fact replace the older one it updates, folds scattered notes into one, lets small stale notes fade, and writes what she learnt. Every change can be undone (`my_sleeps`, `my_sleep_undo`). Built and tested, but **not switched on** until Her brain shows each night with an undo.
- Migrations: `20261110000062_brain_eval.sql`, `20261110000063_brain_ageing_and_sleep.sql`. Function: `supabase/functions/tali-brain-sleep`.

## One brain and sleep on Her brain (10 Nov 2026, night)

- **While you slept.** A card at the top of Her brain: what Tali learnt overnight and each note she tidied, with Undo (`components/LastNightCard.tsx`, `lib/sleeps.ts`). The nightly job is now switched on (migration 065).
- **Use Totality too?** A card on Her brain that links a Totality or Totality Nutrition account by signing in, and brings across picked sign-up answers only (`components/LinkTotalityCard.tsx`, `lib/appLinks.ts`, function `tali-link-app`, migration 064). Notes: `docs/ONE_BRAIN.md`.

## Gmail by forwarding (10 Nov 2026)

Google needs a paid yearly security assessment for apps that read Gmail. Sending is a lighter permission, so on paid plans mail can now reach Tali by Gmail's own auto-forward to a Tali address, with replies still sent from the owner's Gmail. Phase 1 only: it sits alongside the current Gmail reading. Full notes, the deploy command and what is not yet verified: `docs/GMAIL_FORWARDING.md`. Migration `20261110000066_gmail_forwarding.sql` (applied). Function `inbound-email` (needs deploying). Screen: `components/ForwardGmailGuide.tsx` on Email.

### 10 Nov 2026: Gmail reading wound down

Tali no longer asks to read Gmail. Mail reaches her by forwarding, and Google is only asked for sending and the calendar. People already connected keep the old read until their forwarding works or 24 Nov 2026, whichever comes first. See `docs/GMAIL_FORWARDING.md`.

### 10 Nov 2026: Tali's library

A shelf of 12 out of copyright books she reads a few passages of each night, keeping short lessons in the shared brain. Shown on Her brain as "Her library". See `docs/LIBRARY.md`.

### 10 Nov 2026: caps and prices

Pro is A$49.99 a month (A$509.90 a year) and Max is A$149.99 a month (A$1,529.90 a year). Tali HQ stays A$19.99. New Stripe prices are in `_shared/stripe.ts`; the old ones are still recognised. Two caps: web searches a month on paid plans and the trial (Tali HQ 150, Pro 400, Max 1,000), and on Max half price thinking for the first 100 a month. Migration `20261110000069_caps_and_prices.sql` (applied). `create-checkout` and `stripe-webhook` are deployed (version 17 each). `tali-chat` has the cap changes in this repo but is NOT deployed yet, so the caps are not enforced until it is. The website still shows the old Pro and Max prices.

### 10 Nov 2026 (later): caps switched on, founder pricing closed

`tali-chat` was deployed with the cap changes (version 31), so the web search limits and the Max half price limit are now enforced. The website shows the new prices. Founder pricing is closed to new sign-ups: the three people who signed up while the website promised it were marked as founding members, and the one email on the founding list still gets it (migration `20261110000070_founder_pricing_closed.sql`, applied).

### 11 Nov 2026: her brain moves like the website one

- `components/BrainGlobe.tsx`: sparks run from dot to dot (12 at once), every dot twinkles, she breathes, and a flick keeps her turning before easing back to the slow spin. Sparks start in the part you picked or the parts the Today lens lit. All of it is off when the phone asks for reduced motion.
- `supabase/migrations/20261111000071_recall_library_weight.sql` (already applied): book lessons from her library count for half their match score in recall, so what she knows first hand comes first. Recall check after the big library run: right answer in the top five back to 100%.
- Later the same day: sparks now jump to dots a little further away and leave a fading streak, so they shoot through the brain like the website one. 16 at once. Nothing moves while you are on another tab.
- 11 Nov 2026, later again: on the web her brain is now the website's brain copied across (`components/BrainCanvas.tsx`, a canvas). Same glow, sparks, twinkle, breath, spin speed and flick. The phone apps have no canvas, so they keep the Views version until a store build adds a drawing library.

### 11 Nov 2026: the same brain on iPhone and Android (version 1.0.2)

- `components/BrainCanvas.tsx` draws the website's brain with Skia (`@shopify/react-native-skia` 2.2.12, the version Expo SDK 54 picks). `components/BrainCanvas.web.tsx` is the browser canvas version. `BrainGlobe` uses them everywhere and falls back to the old Views version if drawing fails.
- Skia is a native library, so the app version is now **1.0.2**. Updates over the air only reach builds of the same version, so 1.0.1 builds never receive this code. A new store build is needed.
- Tested: the iPhone bundle builds, and the phone drawing code was run in a browser through CanvasKit and drew the brain with its sparks. Not yet seen on a real phone.

### 11 Nov 2026: "Done with this" on Today

- An idea or a date Tali is reminding you of now has a **Done with this** button on its card (`components/BrainSky.tsx`). It takes that one off Today and the next one gets its turn. She still remembers it. The list of what you are done with is kept on the device.

### 11 Nov 2026: Sleep overhaul

- **Front page** (`app/(app)/sleep.tsx`): one big play button for last night's mix, six ready made scenes that play on a tap (`SCENES` in `lib/sleep.ts`), your saved mixes, and one "Make your own" button. Sleeping Tali stays at the top.
- **Player**: her brain asleep with the time left, a slider for each sound that changes the mix while it plays, Take out, Add a sound, Save this mix, and How long.
- **Make your own**: tap a sound and it joins the mix and plays, tap again and it leaves. No separate hear button and no Start button.
- Saved mixes are kept with the other sleep settings, per account on the device. Still two sounds at once. The sound engine is unchanged.

### 11 Nov 2026: Invoices rework, notifications step, people start, easier chat, journal and notes

- **Invoices** (`app/(app)/invoices.tsx`): one main **Send invoice** button, with Save draft, Share PDF and "I sent it myself" as small links under it. An empty description is flagged on the box itself. Lines billed before show as chips. Without Stripe connected, Send opens a **Get paid by card** step inside the invoice (connecting is still web only). After a send there is a Sent page with the pay link and a copy button. The list says "3 days late" or "Paid by card". Sent and paid invoices get **Bill them again**. Billing someone new saves them to Your people.
- **Onboarding** (`app/onboarding.tsx`): a last step asks for notifications and lists what Tali sends. The phone's own permission box only shows after the tap. Skipped on devices that cannot have them.
- **Your people** (`app/(app)/clients.tsx`): an empty list offers Tell me about them (opens Talk), Paste a list, or add by hand.
- **Talk** (`components/TaliMessage.tsx`): Tali's replies sit on a dark glass panel with bigger text and a Copy link on long replies. The chat prompt in `supabase/functions/tali-chat` asks for shorter list lines. That function still needs deploying.
- **Journal** (`app/(app)/journal.tsx`): the page comes first with an optional prompt as the placeholder, mood moves to the end, and there is no title. The home shows your own entry from this date (a week, a month, three months, six months or a year ago) and the month as a calendar coloured by mood. Tali never speaks in it. Her weekly journal stays on its own tab.
- **Notes** (`app/(app)/notes.tsx`): notes move out of the journal to their own screen under Your world, with search.
- Not in this round: threads, the month page, "things you said you'd do", Life money, photos, export, a journal lock, importing phone contacts, the opened status and overdue nudges for invoices.
- Tested: types check and the web bundle builds. Not yet clicked through signed in, and the Stripe send has still never run against a real connected account.
