# Tali HQ emails

Everything is built by `build.mjs` (run `node build.mjs` in this folder). Do not edit the HTML by hand.
Full notes and the go-live steps are in `docs/EMAILS.md`.

## Auth emails

Paste each into Supabase (Tali HQ project): Authentication, Emails, Templates.

| File | Template | Subject |
|---|---|---|
| confirm_signup.html | Confirm signup | Confirm your email for Tali HQ |
| reset_password.html | Reset password | Reset your Tali HQ password |
| magic_link.html | Magic link | Your Tali HQ sign-in link |
| change_email.html | Change email address | Confirm your new email for Tali HQ |

They use `{{ .ConfirmationURL }}`, which Supabase fills in.

## Welcome email

`welcome.html` is only a preview. The real one is sent by the `tali-welcome` edge function from
`supabase/functions/tali-welcome/template.ts`, which `build.mjs` also writes.

## Day 3 email

`day3.html` is only a preview too. "What I've learned about you so far" is sent once, three days
after someone confirms, by the same `tali-welcome` function (`{ "kind": "day3" }`), from the same
`template.ts`. It only goes to people Tali holds at least 3 things about. Notes and go-live steps are
in `docs/BRAIN_OUTSIDE.md`.
