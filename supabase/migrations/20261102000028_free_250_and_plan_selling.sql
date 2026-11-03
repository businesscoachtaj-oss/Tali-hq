-- 2 Nov 2026: Free plan goes to 250 messages a month (about 8 a day). Paid plan
-- feature lists rewritten to sell the features, not the credit count. Every line
-- describes something live today except the one marked "Coming soon".
update plans set
  messages_month = 250,
  features = '[
    "Chat with Tali, 250 messages a month",
    "Log food and training by telling her",
    "A private journal Tali reads and remembers",
    "A Friday check-in on your goals"
  ]'::jsonb
where id = 'free';

update plans set
  features = '[
    "Your inbox, sorted: connect Gmail and Tali reads what comes in, flags what needs you and drafts the reply",
    "A morning brief at the time you pick: your day, your money and who has gone quiet",
    "Health checks twice a day: overdue invoices, cold leads and bookings that need a nudge",
    "Clients, leads and invoices in one place, with Stripe invoices sent on your yes",
    "Google Calendar: she knows your week and books into it when you approve",
    "Web search with sources, and a weekly journal of how the business is going",
    "1,000 Tali credits a month"
  ]'::jsonb
where id = 'hq';

update plans set
  features = '[
    "Everything in Tali HQ, with 3,000 credits a month",
    "Your own Tali email address: give it to customers and Tali handles the enquiries, with one-tap replies from that address",
    "Night school: pick what Tali studies each night and she turns up sharper on your industry every morning",
    "Rules: tell Tali what she can do on her own, like replying to booking requests, and she acts inside those lines",
    "First in line for new features",
    "Coming soon: Tali reads her replies out loud in her own voice"
  ]'::jsonb
where id = 'pro';
