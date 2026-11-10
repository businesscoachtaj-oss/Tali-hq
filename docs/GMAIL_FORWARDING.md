# Gmail by forwarding (10 Nov 2026)

Asked for by Taj after Google's email of 10 Nov: the project needs a paid CASA security assessment by 7 Feb 2027 to keep reading Gmail.

## Why

- Reading Gmail (`gmail.readonly`) is a **restricted** permission. It needs a third party security assessment every year, about US$500 to US$855. There is no free route to the letter Google wants.
- Sending Gmail (`gmail.send`) is only a **sensitive** permission. Normal review, no paid assessment. The verification pack of 2 Nov listed both as restricted, which was wrong.
- So mail now reaches Tali by the owner switching on Gmail's own auto-forward to a Tali address, and replies still go out from their own Gmail.

## Who gets it

Every paid plan (Tali HQ, Pro, Max, and the trial), the same as inbox sorting today. Free does not have inbox sorting and still does not. A public address for enquiries, and "forward anything to her", stay Pro.

## How it works

1. The Email screen shows "Send your Gmail to me" (`components/ForwardGmailGuide.tsx`). `my_gmail_forwarding()` gives a paid person an address the first time, built from their business name.
2. They add that address in Gmail's forwarding settings on a computer. Gmail emails a confirmation code to the address.
3. `inbound-email` recognises that email, saves the code and Gmail's confirm link (`forwarding_code`), and the guide shows them. Nothing else from that email is kept.
4. They switch forwarding on. Each forwarded email carries an `X-Forwarded-For` header naming their Gmail address. It is accepted only when that address is the one the code was for, or the Google account they connected.
5. The email is saved as source `gmail` and sorted exactly as before: needs you, FYI or junk, a one line summary, and a drafted reply on Today that sends from their own Gmail. 1 credit each, feature `gmail_sort`.
6. Once forwarding is working for someone, mail read the old way through Google is skipped for them (a trigger on `inbound_emails`), so nothing shows twice.

## Two phases

- **Phase 1 (this change):** forwarding sits alongside the current Gmail reading. Nobody is cut off.
- **Phase 2 (not done):** once everyone who uses Gmail has moved, remove `gmail.readonly` from `SCOPES.gmail` in `_shared/google.ts`, reword the Email page, remove the scope in the Google Cloud console, and reply to Google's email that the restricted scope is no longer needed.

## Cost to watch

Resend counts every received email against the plan. The free plan is 100 emails a day and 3,000 a month, shared between sending and receiving across Totality, Nutrition and Tali HQ. A few busy inboxes forwarding will reach the daily limit, and then all email stops for the day. Upgrade Resend before that happens.

## Put it live

Migration `20261110000066_gmail_forwarding.sql` is already applied. The function needs one deploy:

```
npx supabase functions deploy inbound-email --no-verify-jwt --project-ref jbyzblwrywgxilhmfyjt
```

## Checked

- Database, in a rolled back transaction on a real trial account: a paid person gets an address, the code shows, the old Google sync still saves while only the code has arrived, forwarding flips to working on the first email, after that the old sync's rows are skipped and forwarded rows save.
- `inbound-email` type checks. Gmail's confirmation email is recognised from its subject and text in a unit run, another sender with the same text is not, and headers are read from both shapes.

## Not verified

- **A real forwarded email end to end.** Three things are unknown until one arrives: the exact wording of Gmail's confirmation email (the parser is written from the known format), whether Resend's received email includes the `X-Forwarded-For` header, and whether the webhook's `to` shows our address for auto-forwarded mail (there is a fallback that looks in the delivery headers).
- A reply to a forwarded email landing in the right Gmail thread. It is sent with `In-Reply-To` but without Gmail's own thread id.
- Sending needs Google connected. Someone who forwards without connecting Google gets drafts but is told to connect Gmail when they tap send.

## Phase 2: Gmail reading wound down (10 Nov 2026)

Taj asked for the full change in one go, before the first real forwarding test.

- Tali no longer asks Google for permission to read Gmail. The Google sign-in now asks for sending (`gmail.send`), the calendar and the email address only. `include_granted_scopes` is off, so a reconnect never carries the old read permission along.
- In `google_connections.scopes`, `gmail` now means "can send replies from their Gmail".
- New column `google_connections.gmail_read`: true only for people who connected before this change. The old 10 minute read keeps going for them until their first forwarded email arrives (it then switches off for good) or until the end of 24 Nov 2026 Sydney time, when it stops for everyone. The cron job stops waking after that too.
- Email screen: the sorted list shows when forwarding is working. People still on the old read see a card saying it stops on 24 November. People forwarding with no Google connected see a card asking them to connect Google so replies go out from their own address.
- Settings Google card and "Get me up to speed" reworded: she can send from Gmail, she cannot read it. For Google, "Get me up to speed" is the calendar only.
- Disconnecting Google now only forgets mail read the old way. Forwarded mail stays.
- Founder screen: "Email coming in" (received today, this month, people forwarding, people still on the old read), from `founder_mail()`.
- Migration `20261110000067_gmail_read_wind_down.sql` applied. `google-connect` deployed as version 13.

Still for Taj to do in Google Cloud (project `starry-runner-513523-r0`) once the old read has ended: remove the `gmail.readonly` scope from the consent screen's data access list, then reply to Google's email.

Not tested for real: a real forwarded Gmail, and a fresh Google sign-in with the smaller permission list.
