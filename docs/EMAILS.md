# Tali HQ emails (10 Nov 2026)

Branch `emails-10nov`. Nothing in here is live yet. Nothing was deployed, no migration was run and no
email was sent while building it.

## What was there

Four Supabase auth emails (confirm signup, reset password, magic link, change email) in the light
Totality layout, built from a layout file that lives in another repo. No welcome email at all: after
confirming, a new person heard nothing from Tali outside the app.

## What changed

1. **The four auth emails** are redesigned to match the app's night sky look: deep navy page, a
   violet panel with Tali in it, a serif heading (Georgia, no web font needed), a rounded violet
   button. Tables and inline styles only, with `bgcolor` fallbacks for Outlook, alt text on Tali,
   and a "Button not working? Copy this link" line under every button.
2. **Copy fixes.** The confirm email used to say the trial "starts as soon as you're in". The trial
   really starts at sign up, so it now says "You have 7 days of Tali HQ to try everything. No card
   needed." Sign off is just "Tali".
3. **A welcome email**, written as Tali, sent once a few minutes after someone confirms. Two
   sentences on what she is, three things to do first (tell her about you, ask her anything, look at
   her brain), a button to open the app, the trial in one line, and where to get help. It has a plain
   text version as well as the HTML one.
4. **`build.mjs`** replaces `build.ts`. It stands alone, so every email can be rebuilt from this repo.

Files:

- `supabase/templates/build.mjs`, `README.md`, the four auth `.html` files, `welcome.html` (preview)
- `supabase/functions/tali-welcome/index.ts` and `template.ts` (generated)
- `supabase/migrations/20261110000055_welcome_email.sql`

## Putting the auth emails live (Taj)

Supabase dashboard, Tali HQ project, Authentication, Emails, Templates:
https://supabase.com/dashboard/project/jbyzblwrywgxilhmfyjt/auth/templates

For each row, open the template, paste the whole file over what is there, check the subject, save.

| Template in Supabase | File to paste | Subject |
|---|---|---|
| Confirm signup | `supabase/templates/confirm_signup.html` | Confirm your email for Tali HQ |
| Reset password | `supabase/templates/reset_password.html` | Reset your Tali HQ password |
| Magic link | `supabase/templates/magic_link.html` | Your Tali HQ sign-in link |
| Change email address | `supabase/templates/change_email.html` | Confirm your new email for Tali HQ |

Then send yourself a password reset from the sign in screen to see one for real.

## Putting the welcome email live

How it works: a cron job runs every 5 minutes and calls the `tali-welcome` function only when
`welcome_due()` has someone waiting. The function claims the person, sends through Resend (the same
key and the same verified domain `tali-send` uses), and records it in `welcome_emails`.

Safety rules, all in the migration:

- Only people who confirm their email **after** the migration is run. Existing members get nothing.
  (`welcome_settings.include_existing` can change that. Leave it false.)
- Only confirmed emails, 3 minutes to 7 days after confirming.
- Never twice. A person is claimed in one atomic write before the send, and the send carries an
  idempotency key as a second guard.
- At most 3 tries if sending keeps failing.
- `update public.welcome_settings set paused = true;` stops it at once.

Steps, in this order:

1. Merge `emails-10nov`.
2. Deploy the function **first**: `tali-welcome`, with verify JWT **off** (it checks the vault key
   itself, like `tali-brief`).
3. Optional secrets, Edge Functions, Secrets
   (https://supabase.com/dashboard/project/jbyzblwrywgxilhmfyjt/settings/functions):
   - `WELCOME_REPLY_TO`: a mailbox you actually read. When set, replies go there and the email adds
     "Or just reply to this email." Without it that sentence is left out.
   - `WELCOME_FROM`: defaults to `Tali <tali@tali.totality360.com.au>`.
   - `WELCOME_APP_URL`: defaults to `https://talihq.com.au`.
4. Run the migration `20261110000055_welcome_email.sql` in the SQL editor
   (https://supabase.com/dashboard/project/jbyzblwrywgxilhmfyjt/sql/new). From that moment, new
   confirmed sign ups get the email within about 8 minutes.
5. Check it: sign up with a spare address, confirm, wait. Or look at
   `select * from public.welcome_emails order by updated_at desc;`

## Drafted, not built

Copy only. Neither of these is wired to anything.

### Day 3: what she has learned so far

Would need: a count of that person's own memories (`brain.memories` where `user_id` is theirs), a
second "sent" record like the welcome one, and a rule to skip people with nothing saved yet. The
schema supports all of it.

> **Subject:** What I've learned about you so far
>
> Hi Sam,
>
> Three days in, I've kept 14 things you've told me. You can see every one of them in my brain, and
> make me forget any of them.
>
> The more you tell me, the more I can help with. Today's a good day to tell me about one thing
> you've been putting off.
>
> [Open Tali HQ]
>
> Tali

For someone with nothing saved yet, a different version:

> **Subject:** I'm still getting to know you
>
> Hi Sam,
>
> I haven't learned much about you yet. Tell me one thing about your week and I'll take it from
> there.
>
> [Open Tali HQ]
>
> Tali

### Trial ending

Would need: `subscriptions.status = 'trialing'` and `trial_ends_at` about 2 days away (both exist),
plus a "sent" record. What happens after the trial should be checked against the plans table on the
day it is built, so the email does not promise something that has changed.

> **Subject:** Your Tali HQ trial ends in 2 days
>
> Hi Sam,
>
> Your 7 days of Tali HQ finish on Tuesday. After that you move to Free unless you pick a plan.
>
> On Free we can still chat, and I keep everything I've learned about you. The plans page shows
> what stays and what stops.
>
> [See the plans]
>
> Tali

## Not verified

- **Not type checked.** `deno check` could not download its imports in the build environment. The
  function is short and follows `tali-brief` and `tali-send` line for line, but it has not run.
- **Tali's pictures.** The emails load `https://totality360.com.au/email/tali/wave.png`,
  `thinking.png` and `clipboard.png`, the same ones the live emails use today. I could not open them
  from the build environment. The preview images use her app sprites in their place.
- **Real mail apps.** Checked by rendering in a browser at 600px only. Not opened in Gmail, Apple
  Mail or Outlook. Outlook on Windows will show square corners, which is normal for it.
- **The from address.** `tali.totality360.com.au` is verified for sending in the Resend account I
  can see. I assumed that is the same account as the `RESEND_API_KEY` in Supabase. Replies to
  `tali@tali.totality360.com.au` go nowhere useful, which is why `WELCOME_REPLY_TO` exists.
- **`https://talihq.com.au`** is the address the app itself uses for plans and top ups. I could not
  load it from the build environment.
- **Link expiry.** The emails say links "expire soon" and do not name a time, because that is a
  Supabase setting I did not read.
- **Idempotency key.** Resend accepts an `Idempotency-Key` header on sends as far as I know. If it
  were ignored, the claim in the database still prevents a second email.
