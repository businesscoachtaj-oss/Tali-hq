import { renderEmail, p, button, signoff } from '../../../Livewell-1/supabase/functions/_shared/emailLayout.ts' // the shared Totality email layout
const U = '{{ .ConfirmationURL }}'
const sign = signoff('Tali, from Tali HQ')
const out: Record<string, string> = {
  confirm_signup: renderEmail({ brand: 'talihq', tali: 'wave', preheader: 'One tap to confirm your email and meet Tali.', eyebrow: 'Welcome', title: 'Nearly there', body:
    p("Tap the button to confirm your email and I'll see you inside. Your 7 day Tali HQ trial starts as soon as you're in.") + button('Confirm my email', U, 'talihq') + p("Didn't sign up for Tali HQ? You can ignore this email.", { muted: true, small: true }) + sign }),
  reset_password: renderEmail({ brand: 'talihq', tali: 'thinking', preheader: 'Reset your Tali HQ password.', eyebrow: 'Password', title: 'Reset your password', body:
    p("Tap the button to pick a new password. The link works once and expires soon.") + button('Reset my password', U, 'talihq') + p("Didn't ask for this? Ignore this email and your password stays the same.", { muted: true, small: true }) + sign }),
  magic_link: renderEmail({ brand: 'talihq', tali: 'wave', preheader: 'Your Tali HQ sign-in link.', eyebrow: 'Sign in', title: 'Your sign-in link', body:
    p("Tap the button to sign in to Tali HQ. The link works once and expires soon.") + button('Sign me in', U, 'talihq') + p("Didn't ask for this? You can ignore this email.", { muted: true, small: true }) + sign }),
  change_email: renderEmail({ brand: 'talihq', tali: 'clipboard', preheader: 'Confirm your new email for Tali HQ.', eyebrow: 'Your account', title: 'Confirm your new email', body:
    p("Tap the button to confirm this is your new email for Tali HQ.") + button('Confirm new email', U, 'talihq') + p("Didn't ask for this? Ignore this email and nothing changes.", { muted: true, small: true }) + sign }),
}
for (const [k, v] of Object.entries(out)) Deno.writeTextFileSync(`${k}.html`, v)
console.log('ok')
