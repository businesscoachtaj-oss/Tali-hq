-- 24 Nov 2026 audit fix. profiles uses column level UPDATE grants, and migration 093 added
-- ai_consent_at without one. Saying yes on "Tali and your data" was refused (403), so nobody
-- could turn Tali on: every profile still had ai_consent_at empty and the server's consent
-- check kept her off for everyone.
grant update (ai_consent_at) on public.profiles to authenticated;
