-- Tali HQ 014: private storage for Tali's voice clips (Pro). Only the tali-voice function writes here;
-- the app plays clips through short-lived signed links the function hands back.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice', 'voice', false, 5242880, array['audio/mpeg'])
on conflict (id) do nothing;
