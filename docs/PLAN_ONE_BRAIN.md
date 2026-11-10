# Plan: one brain across your apps (10 Nov 2026)

For Taj to say yes, no or change. Nothing here is built.

## What is true today

- **Tali HQ** (its own database) is the only place Tali has a memory of a person: 375 memories across 2 people so far.
- **Totality and Totality Nutrition** (the shared Livewell database, 67 accounts) have no per-person memory. Tali there works from the data on screen. What exists:
  - `onboarding_responses` (12 rows) and `nutrition_onboarding_responses` (17 rows): goals and preferences people typed at sign-up.
  - `ai_weekly_summaries` (2 rows): her weekly write-ups.
  - `ai_usage` (80 rows, 12 people): a log of what was used, not what was said. Chats are not stored.
  - `tali_brain` (184 memories): your own early brain, with no user column. It is not customer data.
- **Who is in both today:** 1 person by exact email (David). Catelyn is in both, but her two emails differ by one digit, so email matching misses her. Your own two accounts use different emails too.

## What I recommend

Tali HQ is the one brain. The other apps send her a small, safe summary about the person, and only when that person asks for it.

- **Direction:** one way, Totality and Nutrition into Tali HQ. Nothing flows back yet.
- **Consent:** opt in, inside Tali HQ. A card on Her brain: "Use Totality too? I can bring across what you told me there, so you don't have to tell me twice." Then a sign-in to Totality or Nutrition to prove it is the same person. This also solves the typo problem, because the link is made by signing in, not by matching emails.
- **What crosses:** the person's own sign-up answers (goals, how they like to train or eat, their timezone), their own plan name, and her weekly summaries about them. Saved in Tali HQ as normal memories they can see and forget.
- **What never crosses:** anything about a trainer's clients, any client's health details or check-ins, food logs line by line, body weight history, payments, cards, and anything from a gym's records.
- **How it works:** Tali HQ never gets a key to the Livewell database. Livewell gets one small function, "my summary for Tali HQ", that answers only for the person signed in and only with the fields above. Tali HQ calls it once at linking and saves the result.
- **Off switch:** "Unlink Totality" removes the link and the memories that came from it.

## What could go wrong

- Someone links the wrong account. The sign-in step prevents it.
- Health details slipping through in free-text sign-up answers. The function sends named fields only, and anything free text goes through the same private-details scrub the shared brain uses.
- People expecting it to work both ways. The card says plainly which way it goes.

## Size

About 3 to 4 days: 1 for the Livewell function, 1 for linking and saving in Tali HQ, 1 for the card and unlink, plus testing with David's kind of account (a gym admin).

## The main alternative

Match by email automatically and copy across with no sign-in. Faster to build, but it misses typos like Catelyn's, and it moves personal data without asking. I would not do it.

## Your three decisions

1. Opt in with a sign-in (recommended), or automatic by email?
2. Is the "what crosses" list right, or do you want weight and food trends included?
3. One way for now (recommended), or should Totality's Tali also read the Tali HQ brain? That roughly doubles the job.

## Decided (10 Nov 2026, Taj)

1. Opt in with a sign in.
2. Basics only.
3. One way for now.

Built the same day. See `docs/ONE_BRAIN.md`. One change from the plan: Tali's weekly summaries do not cross, because they are free text about weight and food.
