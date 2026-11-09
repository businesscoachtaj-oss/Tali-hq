# The brain outside the app (10 Nov 2026)

Branch `overhaul-outside`, built on top of `brain-build-10nov`. Nothing here is live. Nothing was
deployed, no migration was run, no email was sent and no mailbox was read while building it.

Four things: forward anything to her, the day 3 email, download your brain, and the day one fill.

## What changed

| File | What |
|---|---|
| `supabase/migrations/20261110000059_brain_outside.sql` | New. Everything the four features need. Run after 056. |
| `supabase/functions/inbound-email/index.ts` | Forwarded email from the owner is remembered, not answered. New signed in action `remember`. |
| `supabase/functions/tali-welcome/index.ts` | New day 3 pass (`{ "kind": "day3" }`). The welcome pass is unchanged. |
| `supabase/functions/tali-welcome/template.ts` | Generated. Now also holds the day 3 email. |
| `supabase/templates/build.mjs`, `day3.html`, `README.md` | The day 3 template and its preview. |
| `supabase/functions/_brain_outside/dayOne.ts` | New shared code for the day one fill. Not a function by itself. |
| `supabase/functions/google-connect/index.ts` | New action `learn_recent`. Disconnect also forgets what day one learned. |
| `supabase/functions/ms-connect/index.ts` | The same two changes for Outlook. |

## 1. Forward anything to her

Pro users already have their own Tali address. Until now every email to it was treated as an enquiry:
summarised, and a reply drafted. Now, when the email is **from the owner's own address**, it is
treated as the owner forwarding something for her to remember.

- **Whose address counts.** The email they sign in with (confirmed), plus the Gmail or Outlook
  address they connected by signing in to it. Nothing else. There is no "add another address" yet.
- **What she keeps.** One AI call pulls out at most 6 lasting facts: who a person is to the owner,
  dates and commitments, amounts and what they were for, a receipt's essentials. Each is saved to
  that owner's brain through `brain_remember_for` with `source_ref` `forwarded/<Resend email id>`,
  as kind person, fact, event or plan.
- **What she never keeps.** Anything that reads like an instruction or a rule for her, passwords,
  codes, card or bank numbers. The AI is told not to, and each fact is checked again in code.
- **No reply is drafted** for a forwarded email.
- **Cost.** 1 credit, the same as any email she reads. Refunded if it fails.
- **The inbox row.** It is still saved to `inbound_emails`. New column `forwarded`:
  `remembered`, `waiting` or `unverified`. Ordinary email leaves it null.

### The sender check, and what it can and cannot prove

The From line on an email can be typed by anyone. Resend runs the usual checks on every email it
receives and reports them in `authentication: { spf, dkim, dmarc }` when the function fetches the
email. The function only remembers on its own when **`authentication.dmarc` is `pass`**. DMARC is the
one check that ties the visible From address to a domain that really sent the message. SPF or DKIM
passing by themselves do not, so they are not accepted.

- **DMARC pass, from an owner address:** remembered straight away.
- **Anything else** (fail, unknown, the field missing, or the fetch from Resend failed): nothing is
  saved. The email sits in the inbox with `forwarded = 'unverified'` and the summary "This says it
  is from you, but I could not confirm that, so I have not saved anything. Tap to have Tali remember
  it." The owner can then tap (see the contract below).
- **What this cannot prove:** that the owner personally pressed send. If someone has broken into the
  owner's mailbox, mail from it passes DMARC. Owners whose domain has no DMARC record will always
  land in the "tap to remember" path, which is safe but slower for them.

### Contract for the app

```
supabase.functions.invoke('inbound-email', { body: { action: 'remember', id } })
```

- Signed in (the person's JWT). `id` is the `inbound_emails.id`.
- Works only on their own row, from their Tali inbox, with `forwarded` of `waiting` or `unverified`.
- Returns `{ ok: true, remembered: <number>, message }`.
- Errors return `{ ok: false, remembered: 0, code, message }`: `unauthorized` (401), `bad_request`
  (400), `not_found` (404, already done or not a forwarded email), `out_of_credits` or `no_access`
  or `slow_down` (402), `failed` (502), `not_ready` (503, the migration has not run).
- Two taps cannot both run: the row is claimed in one write first.

To show the button, the app needs `forwarded` in its `inbound_emails` select and a button on rows
where it is `waiting` or `unverified`. That is app work and is not in this branch. Until then those
emails still show in the inbox with the summary above.

## 2. The day 3 email

"What I've learned about you so far." Sent once, three days after someone confirms their email.

- **Who gets it.** Confirmed 3 to 6 days ago, signed up after the migration ran
  (`welcome_settings.day3_live_from`), and it is between 8am and 6pm where they live.
- **Only if there is something to say.** She must hold at least 3 things about them: their own, not
  marked private, and a kind that is about them (person, preference, plan, idea, fact, event). Her
  mistakes, lessons, night school notes and checker notes never count. With fewer than 3, that person
  is **skipped for good** (`day3_emails.skipped_at`).
- **What it shows.** The count, and up to 4 of those things. Anything that looks sensitive is left
  out of the email even though it stays in her brain: health, money, legal, long numbers, dollar
  amounts, email addresses, links. If fewer than 2 survive that filter, the email gives the count
  with no list.
- **Never twice.** Same pattern as the welcome email, in its own server only table `day3_emails`:
  an atomic claim before the send, an idempotency key on the send, and at most 3 tries.
- **How it is sent.** The existing `tali-welcome` function, called with `{ "kind": "day3" }` by a
  new hourly cron job `tali-day3`, only when `public.day3_due()` has someone.
  `{ "kind": "day3", "dry_run": true }` lists who would get it or be skipped and sends nothing.
- **From, reply to and app address** are the welcome email's (`WELCOME_FROM`, `WELCOME_REPLY_TO`,
  `WELCOME_APP_URL`).

Preview: `supabase/templates/day3.html`. Image: `/tmp/thq_mk/emails/TaliHQ_Email_day3.png`.

One thing to know about the wording: the list shows her memories exactly as she stored them. She
often stores them in the third person ("Works best before 10am"), so a real email will read a
little flatter than the preview, which was written by hand.

## 3. Download your brain

```
const { data } = await supabase.rpc('my_brain_export')
```

Signed in only. Returns:

```
{
  exported_at,
  person: { first_name },
  memories: [ { text, kind, part, saved_at, source, private } ],   // newest first
  counts: { total, included, by_part: {...}, by_kind: {...} },
  truncated                                                        // true if more than 5,000
}
```

- Their own active memories only. Nothing from the shared brain, no search data, no internal ids.
- `part` is the plain label the app already uses: Your people, How you like things, Your life and
  work, Plans and ideas, What she has learned.
- `source` is in plain words: Your chats, An email you forwarded, Your Google mail and calendar,
  Your Outlook mail and calendar, Night school, Her nightly check of her own work.
- Checked read only against the live database with the founder's account: 251 memories came to
  about 107 KB, so 5,000 would be about 2 MB.
- Turning it into a file and the button for it are app work, not in this branch.

## 4. The day one fill

Opt in. The person asks, she looks, she keeps a few things.

```
supabase.functions.invoke('google-connect', { body: { action: 'learn_recent' } })
supabase.functions.invoke('ms-connect',     { body: { action: 'learn_recent' } })
```

Returns `{ ok, learned, message }` (plus `code` when it did not run). `message` is written to be
shown to the person as it is.

- **What she looks at.** The last 14 days of mail: sender, subject and the one line preview only.
  The body of an email is never fetched. And the next 14 days of calendar: title, time, place and who
  is invited.
- **What is skipped.** Newsletters and list mail, no-reply and other machine senders, Gmail's
  promotions, social, forums and updates tabs, Outlook's "Other" pile, sign in and security mail,
  anything marked private or confidential, and mail they sent themselves.
- **Access.** Only what they already agreed to when they connected. No new permission is asked for.
  If they connected calendar only, she looks at the calendar and says so.
- **What she keeps.** At most 15 lasting facts about people and commitments, saved through
  `brain_remember_for` as person, fact, event or plan.
- **What she never keeps.** Passwords, codes, card or bank numbers, health details, home addresses,
  anything marked private or confidential. The AI is told not to, and every fact is checked again in
  code before it is saved.
- **Who and how often.** Trial, Tali HQ and Pro. Once per connected account per 30 days
  (`day_one_runs`, claimed in one write).
- **Cost.** 10 credits, reserved first, usage feature `day_one`. Refunded if it fails, if there was
  nothing to read, or if she kept nothing. In those cases the 30 day claim is handed back too.
- **Codes:** `no_access` (402), `not_connected` (400), `already_done` (200, ok false),
  `out_of_credits` (402), `slow_down` (429), `nothing_to_learn` (200, ok true, learned 0),
  `failed` (502), `not_ready` (503).

### Two things that differ from the brief

1. **`source_ref` is `day_one/<date>/<google|microsoft>`**, not just `day_one/<date>`. The app
   tells people "I've forgotten everything that came from your Gmail" when they disconnect. To keep
   that true, disconnecting now also deletes what day one learned from that account
   (`public.day_one_forget`), and it needs to know which account each memory came from. Anything
   matching `day_one/%` still finds them all.
2. **A kept-nothing run is refunded.** The brief said refund on failure. Charging 10 credits for
   "I found nothing" felt wrong, so that is refunded too.

## Putting it live, in order

1. Merge. Run `20261110000055`, `056`, `057` first if they have not been (059 adds to a table 056
   creates).
2. Run `supabase/migrations/20261110000059_brain_outside.sql` in the SQL editor
   (https://supabase.com/dashboard/project/jbyzblwrywgxilhmfyjt/sql/new).
3. Deploy, all with verify JWT off as they are today:

```
npx supabase functions deploy tali-welcome --no-verify-jwt --project-ref jbyzblwrywgxilhmfyjt
npx supabase functions deploy inbound-email --no-verify-jwt --project-ref jbyzblwrywgxilhmfyjt
npx supabase functions deploy google-connect --no-verify-jwt --project-ref jbyzblwrywgxilhmfyjt
npx supabase functions deploy ms-connect --no-verify-jwt --project-ref jbyzblwrywgxilhmfyjt
```

Either order is safe. Each function works without the migration (forwarded mail is still remembered
but not marked, the remember tap and day one answer "not ready", the day 3 job does not exist yet),
and the migration is harmless without the functions (the day 3 job would call the old `tali-welcome`,
which ignores `kind` and runs its normal welcome pass).

## Off switches

- Day 3 email: `update public.welcome_settings set day3_paused = true;` (or
  `select cron.unschedule('tali-day3');`). `paused = true` stops the welcome and day 3 emails both.
- Day one fill: it only runs when someone asks. To stop it, do not show the button, or deploy the
  two connect functions without the `learn_recent` line.
- Forwarding: there is no switch. To stop it, redeploy `inbound-email` from before this change.
- To undo what day one learned for one person:
  `select public.day_one_forget('<user id>', 'google');` (or `'microsoft'`).

## How it was checked

- `deno check` passes on all four functions and the shared file (with the edge runtime types line
  removed and the push helper stubbed, because jsr.io cannot be reached from the build machine).
- The migration parses (28 statements). The export query and the day 3 queries were run read only
  against the live database and return what they should.
- Stubbed runs, no network and no database:
  - **Forwarding:** owner with DMARC pass (kept 2 facts, dropped a password, an instruction and an
    account number), DMARC fail, no verdict at all, the connected Gmail address, a customer (still
    gets the normal draft reply), AI down (credit refunded, left waiting), out of credits, and the
    migration not yet run. The tap: no token, a bad id, first tap, second tap (refused), an unsigned
    webhook (401).
  - **Day 3:** enough to show (sent, sensitive lines left out, HTML escaped), too few (skipped for
    good), lost the claim (not sent), everything sensitive (count only), the same people offered
    again (nothing sent twice), Resend failing (claim released), and a plain `{}` still runs the
    welcome pass.
  - **Day one:** the happy path, not paid, already run, migration missing, out of credits, AI down,
    kept nothing, calendar only, mail failing, both failing, nothing to read, no access at all.

## Not verified

- **None of it has run for real.** No deploy, no live call to Resend, Google, Microsoft or the AI.
- **Resend's `authentication` field.** Taken from Resend's API reference for a received email
  (https://resend.com/docs/api-reference/emails/retrieve-received-email): an object or null with
  `spf`, `dkim` and `dmarc`, each `pass`, `fail`, `gray`, `processing_failed` or `unknown`. I have
  not seen a real one from this account. If it is missing, every forwarded email simply lands in the
  "tap to remember" path.
- **Gmail's `format=metadata` with these header names**, and **Outlook's `sensitivity` and
  `inferenceClassification` in `$select`**, are from my knowledge of those APIs, not checked against
  their docs today. A wrong field name makes the mail read fail, which the function treats as "could
  not read your mail" and carries on with the calendar.
- **Calendar entries marked private.** The shared calendar helper does not return an event's
  privacy flag, and I do not own that file, so private calendar entries are not filtered out before
  the AI sees their titles. The AI is told to skip private and health things and the code check
  catches health words, but a private entry with an ordinary title could be kept.
- **The sensitive word lists** (day 3 and day one) are a first pass. They lean towards leaving
  things out.
- **Tali's picture in the day 3 email** uses the same hosted image as the other emails, which I
  could not load. The preview image uses her app sprite in its place.
- **Mail clients.** The day 3 email was rendered in a browser only.
- **PL/pgSQL bodies** (`day3_claim`, `day_one_claim`, `day_one_forget`, `my_brain_export`) parse, and
  their queries were tried as plain selects, but the functions themselves have never been created.
