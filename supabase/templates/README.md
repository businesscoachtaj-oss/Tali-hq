# Auth email templates

Paste each into Supabase (Tali HQ project): Authentication, Emails, Templates.

| File | Template | Subject |
|---|---|---|
| confirm_signup.html | Confirm signup | Confirm your email for Tali HQ |
| reset_password.html | Reset password | Reset your Tali HQ password |
| magic_link.html | Magic link | Your Tali HQ sign-in link |
| change_email.html | Change email address | Confirm your new email for Tali HQ |

They use `{{ .ConfirmationURL }}`, which Supabase fills in.
