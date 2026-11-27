# Tali HQ on Zapier

Added 27 Nov 2026. Uses the Tali HQ API (`supabase/functions/tali-api`). An owner on HQ, Pro or Max makes an API key in Tali HQ (Settings, Connections, Zapier and the Tali HQ API) and pastes it into Zapier.

- Triggers (polling): New Lead, New Client, New Website Enquiry, New Booking, Invoice Paid, Quote Accepted
- Actions: Add Lead, Add Client, Add Reminder, Add Note for Tali
- Search: Find Client or Lead (by email), and Find or Add Client

A key can never send, spend or delete anything. Family and friends in Your world never come out through the API.

## Publish (Taj, once)
```
cd integrations/zapier-tali-hq
npm install
npm install -g zapier-platform-cli
zapier login
zapier register "Tali HQ"
zapier push
```
Then in developer.zapier.com: add the logo, category, and invite testers. When it is ready, submit it for the public app directory.
