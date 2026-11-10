# One brain: Totality into Tali HQ (10 Nov 2026)

Built from `docs/PLAN_ONE_BRAIN.md` with Taj's three answers: opt in with a sign in, basics only, one way.

## What a person sees

On Her brain, under their memories: "Use Totality too?" They tap Link Totality, enter their Totality email and password, and Tali brings across what they picked at sign-up. One link covers Totality and Totality Nutrition, because they share accounts. The card then shows how many things came across, with Unlink.

## What crosses

Picked answers only: role (trainer, gym owner, member), business name, plan name (paying trainers and gym owners), main training goal, days a week, experience, equipment and training style, and their Nutrition goal.

## What never crosses

Anything about a trainer's clients, injuries or health notes, weight, height, date of birth, food logs, check-ins, payments, and anything typed as free text. Tali's weekly summaries were in the plan but are **left out**: they are free text that talks about weight and food, which is on the never list.

## How it works

1. `tali-link-app` (Tali HQ edge function) checks the Tali HQ sign in, then counts the try (5 an hour).
2. It signs in to Totality as the person, using Totality's public app key. The password is used once, never stored, never logged.
3. It calls `public.my_summary_for_tali_hq()` in the Totality database as them. That function answers only for the signed in person.
4. It signs that session out, turns the answers into plain sentences, and saves them with `app_link_save` as normal memories (source `totality`).
5. `my_app_unlink('totality')` deletes the link and those memories. Linking again refreshes them.

Tali HQ holds no service key to the Totality database. One Totality account can link to one Tali HQ account.

## Checked

- Totality function: signed out returns nothing; a real trainer and a real client each get only the named fields; the public key alone is refused.
- Tali HQ database, rolled back: save, bad kinds skipped, a second person refused the same Totality account, relink refreshes, unlink removes only the linked memories and leaves the person's own, another person cannot unlink it, the sixth try in an hour is refused.
- `tali-link-app` boots and refuses a call with no sign in. Totality's sign in answers a wrong password the way the function expects.

## Not verified

- A real link from the app with a real Totality password. Nobody has done one yet.
- People who sign in to Totality with Google or Apple have no password, so they cannot link this way yet.
