-- 12 Nov 2026 (Taj): a profile photo in Tali HQ. A private bucket, one folder per person, and the
-- path of the current photo on the profile. Only the person can read, add or remove their own photo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "avatars read own" on storage.objects;
create policy "avatars read own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatars write own" on storage.objects;
create policy "avatars write own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter table public.profiles add column if not exists avatar_path text;
grant update (avatar_path) on public.profiles to authenticated;
