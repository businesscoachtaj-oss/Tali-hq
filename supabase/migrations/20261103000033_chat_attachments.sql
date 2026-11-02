-- Photos and files in Talk (3 Nov 2026). Each message can carry attachments: a list of
-- {kind: image|pdf, path, name, size}. Files live in the private chat-uploads bucket under
-- <user id>/<conversation id>/<file>, so storage policies key on the first folder.

alter table public.messages add column if not exists attachments jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-uploads', 'chat-uploads', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat uploads read own" on storage.objects;
create policy "chat uploads read own" on storage.objects for select to authenticated
  using (bucket_id = 'chat-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "chat uploads write own" on storage.objects;
create policy "chat uploads write own" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "chat uploads delete own" on storage.objects;
create policy "chat uploads delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
