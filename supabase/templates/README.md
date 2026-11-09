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
