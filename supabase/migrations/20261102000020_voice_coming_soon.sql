-- Tali HQ 020: Tali's voice is coming soon (the voice server isn't hosted yet), so the Pro list says so.
update public.plans set features = '["Everything in Tali HQ, 3,000 credits a month","Night school: you pick what Tali studies each night","Your own Tali email address for enquiries","Automatic actions inside rules you set","Coming soon: Tali reads her replies out loud in her own voice"]'::jsonb
 where id = 'pro';
