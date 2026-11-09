# Tali HQ build report, 10 November 2026

Everything below is on one pull request: https://github.com/businesscoachtaj-oss/Tali-hq/pull/31 (branch `brain-build-10nov`, 53 files). Nothing is live yet. Claude was blocked from deploying to production, so the last steps are Taj's (section 2).

## 1. What was built

### The look, across the whole app
- **Today opens on her brain.** Tali's head icon, the date and her line in the serif, then her brain with your day as glowing stars wired to it. Under it sit Tali's level card, "Tell her anything", then the rest of Today as it works now (She learned this week, Needs you, Due today, At a glance, Tonight).
- **Every star is real.** A late invoice, a draft waiting for a yes, a new email, something due today, a memory about a person, an idea. Tapping a star lights up what connects to it: the client, days overdue, and other memories that mention the same name. The earlier mockups had made-up connections; those are gone. Each star's button now goes somewhere (Invoices, Email, Talk).
- **Talk is inside her space.** Her words sit in the sky with a small glowing dot, yours glow violet. All current features are still there (Chats, New, attach, mic, Think harder).
- **Your world** has the living map on top (People, Work, Health, Growth, Your words, each with its own moving shape) and the full list underneath. Counts are real ("2 things she knows", "Nothing yet"). The mockup had padded numbers; removed.
- **Every other screen** (Her brain, Me, Plans, Top up, Settings, Your people, Money, Night school, Journal, Email, Invoices, Goals, Food and training) carries the night sky, serif headings and glowing cards.
- **Getting started asks about you first.** First name, "What would you like a hand with?" (week and to-dos, business, money, health and habits, people, big goals), then "Do you run a business?" with "No, just me" as a real answer. Business name and type only appear if you say yes.
- **Sign in** now reads "An AI with a brain that grows with you. For your life and your work."
- Dot Tali is parked on the `look-mind-9nov` branch, as asked.

### The AIs you have keys for
| What | Key | What the customer gets | Cost to them |
|---|---|---|---|
| Watch a video | Gemini | Send a video up to 10 minutes and 200 MB. She watches it, answers, and keeps notes so you can keep talking about it. | 5 credits a started minute |
| Second opinion | OpenAI | A second AI checks her answer: "Agrees" and "Would change". | 20 credits |
| Better memory | Voyage | She pulls a wider set of memories and reranks them, so the right one surfaces as her brain grows. No database change. | Included |
| Safety screen | OpenAI | Typed text is screened. Only the two worst categories block. | Free |
| New memory tag | (none) | After a reply, a tag shows what she kept and which part of her brain it went to. | Included |

- Credits are reserved before each extra and refunded if the extra fails. Free plan gets a clear "not on your plan" answer and is charged nothing.
- What she saw in a video is saved as a memory. A second opinion that really differs is saved as an idea.
- **Vendor and model names are founder only.** Customers see "A second AI". The server only stores and returns the AI names for your account.

### Coming soon (no key yet)
The app asks the server what is switched on. When you add a key, the feature turns on with no new app build (the server side for these three still has to be written first).
- **Tali's voice** (ElevenLabs): on Plans as an add-on, A$4.99 a month, marked Coming soon, with no buy button. Removed the fake "14 minutes left" numbers from Talk, Me and Top up.
- **Reads long documents** (Mistral): on Plans, Coming soon.
- **Better live web answers** (Perplexity): not shown as missing, because web search with sources already works today at 2 credits a search.

### Emails
- **There was no welcome email at all.** New: "Hi {first name}, I'm Tali", sent once, a few minutes after someone confirms. What she is, three things to do first, a button to open the app.
- The four sign-in emails (confirm, reset password, magic link, change email) are redesigned to match the app.
- Safety: only people who confirm after it goes live get it, never twice, and there is a pause switch. Existing members get nothing.
- Day 3 and trial-ending emails are drafted as copy in `docs/EMAILS.md`, not wired.

## 2. What you need to do, in order

1. **Merge** https://github.com/businesscoachtaj-oss/Tali-hq/pull/31
2. **Run two migrations** in the SQL editor (https://supabase.com/dashboard/project/jbyzblwrywgxilhmfyjt/sql/new). Paste each file's contents and press Run:
   - `supabase/migrations/20261110000055_chat_video_uploads.sql` (lets the chat bucket take videos up to 200 MB)
   - `supabase/migrations/20261110000056_welcome_email.sql` (the welcome email record and its 5 minute job)
3. **Storage size limit.** In Supabase, Storage, Settings, check the global upload limit is at least 200 MB. The default is 50 MB, which would stop longer videos.
4. **Deploy three functions** from your Tali HQ folder:

```
git pull origin main
npx supabase functions deploy tali-ai-selftest --no-verify-jwt --project-ref jbyzblwrywgxilhmfyjt
npx supabase functions deploy tali-chat --no-verify-jwt --project-ref jbyzblwrywgxilhmfyjt
npx supabase functions deploy tali-welcome --no-verify-jwt --project-ref jbyzblwrywgxilhmfyjt
```

5. **Tell Claude it's deployed.** Claude runs the self test (four tiny calls, under a cent) to prove the Gemini, Voyage and OpenAI keys and model names really work, and fixes any model name that is wrong.
6. **Put the app live** (Vercel rebuilds from main when you merge; this pushes the phone update):

```
git push origin main:ota-publish
```

7. **Sign-in emails.** Open https://supabase.com/dashboard/project/jbyzblwrywgxilhmfyjt/auth/templates and paste each file from `supabase/templates/` over its template. Subjects stay the same.
8. Optional: set the secret `WELCOME_REPLY_TO` to a mailbox you read, so people can reply to the welcome email.

Safe order: if you only do steps 1 to 5 first, the live app keeps working as it does now. The old app sends none of the new fields.

## 3. Not verified yet (be aware)

- **No live call has been made** to Gemini, Voyage or OpenAI with your keys. The connector blocked deploying even a test function. The model names (`gemini-3.8-flash`, `rerank-2.5-lite`, `gpt-5.4`) came from the vendors' documentation today, and step 5 proves them.
- **A big video has not been tested** through the server. Try a 30 second clip first, then a long one.
- **The welcome email has never run.** It is written to the same pattern as the morning brief.
- **Emails were checked in a browser only**, not in Gmail, Apple Mail or Outlook.
- **The checker that turns her mistakes into lessons is not built.** There is no nightly job that runs for every user to hang it on. It needs its own small job; the shape is written up in `docs/BRAIN_AI_CONTRACT.md`.
- Photos and screenshots still go to her current vision. Only video moved to Gemini.
- Three things change for the live app the moment `tali-chat` is deployed: reranked memories, the safety screen, and source links after web searches.

## 4. A decision for you: self-harm wording

The safety screen never blocks someone who mentions self-harm. It tells Tali to respond with care and mention Lifeline 13 11 14. That is new behaviour you have not seen. If you would rather word it differently, it is one paragraph in `supabase/functions/tali-chat/index.ts`.

## 5. Bugs found and fixed on the way

- "Mum\'s birthday" showed a stray backslash on Your people.
- Star buttons on the brain did nothing. They navigate now.
- "1 things need you" grammar.
- The confirm email said the trial "starts as soon as you're in". It starts at sign-up. Fixed.
- The email build script depended on a file in the Totality repo, so Tali HQ emails could not be rebuilt on their own. Fixed.
- Plans listed web search as a new extra at a guessed price. It already exists at 2 credits; corrected.
- Getting started forced everyone to pick a business type, and its example text was written for a trainer. Both fixed.
- Business type list led with two fitness options. Reordered (values unchanged, so saved answers still match).

## 6. Things worth doing next (not built, your call)

1. **Plan features in the database** still describe the old product. Suggest adding "Watches your videos" and "Second opinions" to Tali HQ and Pro, and removing "Coming soon: Tali reads her replies out loud" from Pro until voice is real.
2. **Day 3 email**, "what I've learned about you so far". Drafted. It is the strongest hook you have, because it shows the brain growing.
3. **Trial ending email**. Drafted. Right now a trial just ends quietly.
4. **Memories flying into her brain**: when the "New memory" tag appears in Talk, a few dots drift down to the Her brain tab. Mocked yesterday, quick to add.
5. **Tap Tali, she becomes her brain** (the dot Tali morph). Parked, works, needs her made rounder.
6. **Video compress before upload** on phones, so a 2 minute phone video is 20 MB, not 200.
7. **The mistakes checker** as a weekly job per user.
8. **A star for today's calendar** on the brain (first meeting, free gaps) for people with Google or Outlook connected.
9. **Free plan teaser**: let Free watch one short video a month, the same way it gets one Deep think.
10. **Pricing**: once the self test passes, set the premium tier. Rough costs to you per use: video about A$0.015 a minute (you charge 5 credits), second opinion about A$0.035 (you charge 20 credits), chat about A$0.0015 a message.

## 7. Two people signed up to both Totality and Tali HQ

- David (dcowell2025@gmail.com): Totality as a gym admin and Tali HQ, both on 4 November.
- Catelyn: Tali HQ on 9 November, Totality as an independent trainer on 10 November. Her two emails differ by one digit (…430233 on Tali HQ, …4303233 on Totality), so one is probably a typo.

## 8. Where things are

- Pull request: https://github.com/businesscoachtaj-oss/Tali-hq/pull/31
- Server contract: `docs/BRAIN_AI_CONTRACT.md`
- Emails: `docs/EMAILS.md`
- Earlier pull request #30 (founder lock on How Tali thinks) is included in this one and can be closed.
