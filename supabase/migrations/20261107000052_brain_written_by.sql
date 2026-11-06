-- 7 Nov 2026: who wrote each memory, so the brain can be sorted later.
--
-- Taj wants Tali to one day run on her own open model. Anthropic's and OpenAI's terms stop us
-- training a competing model on their outputs, so every memory now says who wrote it:
--   claude    written by Claude (night school, Education, jobs, chat summaries). Use, never train on.
--   openai    written by an OpenAI model. Use, never train on.
--   taj       Taj's own words.
--   user      a user's own words (training only with that user's consent, not built yet).
--   original  the original text of a source Tali studied, with its link and licence.
-- Everything written so far is Claude's, so the default is 'claude'. Anything that isn't labelled
-- stays out of training.

alter table brain.memories
  add column if not exists written_by text not null default 'claude',
  add column if not exists source_url text,
  add column if not exists licence text;

alter table brain.memories drop constraint if exists memories_written_by_check;
alter table brain.memories add constraint memories_written_by_check
  check (written_by in ('claude', 'openai', 'taj', 'user', 'original'));

comment on column brain.memories.written_by is
  'Who wrote this memory: claude, openai, taj, user or original. Only taj and licensed originals are training-safe.';
comment on column brain.memories.source_url is 'Link to the original source, for written_by = original.';
comment on column brain.memories.licence is 'Licence of the original, e.g. public domain, CC0, CC BY 4.0.';

create index if not exists memories_written_by_idx on brain.memories (written_by);

-- The pile that is safe to train on one day. Users join this only once a consent setting exists.
create or replace view brain.training_safe as
  select id, kind, content, about, tags, region, written_by, source_url, licence, created_at
  from brain.memories
  where status in ('active', 'faded')
    and merged_into is null
    and private is not true
    and (
      written_by = 'taj'
      or (written_by = 'original'
          and source_url is not null
          and lower(coalesce(licence, '')) in ('public domain', 'cc0', 'cc by', 'cc by 4.0', 'cc by 3.0', 'cc by-sa', 'cc by-sa 4.0', 'cc by-sa 3.0'))
    );

revoke all on brain.training_safe from public, anon, authenticated;
