-- Chat history (3 Nov 2026): many chats, each with a title, pinned ones first.
-- Users already own their conversations (RLS "own conversations all"), so rename, pin and delete
-- need no new policies. The title is set automatically from the first message when the user
-- has not named the chat; renaming marks it so the automatic title never overwrites it.

alter table public.conversations
  add column if not exists pinned boolean not null default false,
  add column if not exists title_set_by_user boolean not null default false;

create index if not exists conversations_user_pinned_idx on public.conversations (user_id, pinned desc, updated_at desc);

-- First user message names the chat (unless the user named it) and bumps updated_at.
create or replace function public.messages_name_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'user' then
    update public.conversations c
       set title = case
                     when c.title_set_by_user or (c.title is not null and c.title <> 'Chat with Tali') then c.title
                     else left(regexp_replace(trim(new.content), '\s+', ' ', 'g'), 60)
                   end,
           updated_at = now()
     where c.id = new.conversation_id;
  end if;
  return new;
end $$;
revoke all on function public.messages_name_conversation() from public, anon, authenticated;

drop trigger if exists messages_name_conversation on public.messages;
create trigger messages_name_conversation after insert on public.messages
  for each row execute function public.messages_name_conversation();

-- The list the Talk screen shows: own chats only (RLS applies, security invoker).
create or replace function public.my_conversations()
returns table (id uuid, title text, pinned boolean, updated_at timestamptz, last_message text, message_count bigint)
language sql stable security invoker set search_path = public as $$
  select c.id,
         coalesce(nullif(c.title, ''), 'Chat with Tali') as title,
         c.pinned,
         c.updated_at,
         (select left(m.content, 120) from public.messages m
           where m.conversation_id = c.id and m.role in ('user', 'assistant')
           order by m.created_at desc limit 1) as last_message,
         (select count(*) from public.messages m where m.conversation_id = c.id and m.role in ('user', 'assistant')) as message_count
    from public.conversations c
   where c.user_id = (select auth.uid())
   order by c.pinned desc, c.updated_at desc
   limit 200;
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;
