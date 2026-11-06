-- Tali HQ, 6 Nov 2026: Visual memories (asked for by Taj). Every image Tali made for someone, in the
-- occipital part of their brain, with a way to delete one. Images live on the message they were made
-- in (messages.attachments, see 045); these two functions read and remove them for the signed-in
-- person only. Idempotent.

create or replace function public.my_visual_memories(p_limit integer default 60)
returns table(message_id uuid, conversation_id uuid, idx integer, path text, prompt text, shape text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, m.conversation_id, (a.o - 1)::int, a.v->>'path', a.v->>'prompt', coalesce(a.v->>'shape', 'square'),
         coalesce((a.v->>'made_at')::timestamptz, m.created_at)
    from public.messages m,
         jsonb_array_elements(case when jsonb_typeof(m.attachments) = 'array' then m.attachments else '[]'::jsonb end) with ordinality as a(v, o)
   where m.user_id = (select auth.uid()) and m.role = 'assistant'
     and a.v->>'kind' = 'image' and a.v ? 'prompt' and coalesce(a.v->>'path', '') <> ''
   order by 7 desc
   limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;
revoke all on function public.my_visual_memories(integer) from public, anon;
grant execute on function public.my_visual_memories(integer) to authenticated;

-- Deletes one image Tali made: the chat keeps a short "deleted" note in its place and her memory of
-- making it goes too. Returns the file path so the app can remove the file from storage (the owner's
-- own storage delete policy allows it). Null if it was not theirs.
create or replace function public.delete_visual_memory(p_message_id uuid, p_index integer)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); m record; a jsonb; v_path text;
begin
  if v_uid is null then return null; end if;
  select id, attachments into m from public.messages
   where id = p_message_id and user_id = v_uid and role = 'assistant' for update;
  if not found or jsonb_typeof(m.attachments) <> 'array' then return null; end if;
  a := m.attachments -> p_index;
  if a is null or a->>'kind' <> 'image' or not a ? 'prompt' or coalesce(a->>'path', '') = '' then return null; end if;
  v_path := a->>'path';
  update public.messages
     set attachments = jsonb_set(m.attachments, array[p_index::text],
                                 jsonb_build_object('kind', 'image', 'name', 'Tali image', 'prompt', a->>'prompt', 'shape', a->>'shape', 'deleted', true))
   where id = p_message_id;
  delete from brain.memories
   where user_id = v_uid and kind = 'seen' and source_ref = 'messages/' || p_message_id::text and content like 'Made an image for them:%';
  return v_path;
end $$;
revoke all on function public.delete_visual_memory(uuid, integer) from public, anon;
grant execute on function public.delete_visual_memory(uuid, integer) to authenticated;
