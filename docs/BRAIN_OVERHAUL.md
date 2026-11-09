# Brain overhaul, core (10 Nov 2026)

Branch `overhaul-core`, built on `brain-build-10nov`. Nothing here is deployed and the migration has not been run. Everything is additive: the old search column, the old functions the live app calls, and the founder's nightly Sleep job are untouched.

## What changed

| # | What | Where |
|---|---|---|
| 1 | Better search: a second, stronger set of search numbers (1,024 per memory) and recall by words and meaning together | migration 058, `tali-brain-embed`, `_shared/brainEmbed.ts`, `tali-chat` |
| 2 | Real connections for the app | `public.my_connections` |
| 3 | Dates on memories, and what is coming up | `due_on`, `yearly`, `public.my_upcoming`, `tali-chat` memory tool |
| 4 | Correct a memory | `public.my_memory_update` |
| 5 | A careful weekly tidy for customers | `public.brain_tidy_customers`, cron `tali-brain-tidy` |

### What I found first (so the changes make sense)

- **Chat recall was words only.** `tali_context` calls `brain.recall`, which is full text search plus letter similarity. The 384 number column was only used by `brain.answer`, `brain.related` and `brain.near_duplicates`, which the scheduled jobs use, not chat. So "swap the search engine" really meant adding meaning to chat recall for the first time.
- **"About" was mostly empty on chat memories.** 8 of the 13 memories saved from Tali HQ chats had no names in `about`, and the only other customer's 2 memories had none. `brain.entities` (24 rows) is all the founder's, seeded on 24 and 25 October by hand. tali-chat never wrote to it. So there was little for "connections" to stand on.
- **The tidy is not in the database.** See "The tidy" below.

### 1. Better search

- New columns `brain.memories.embedding_v2` and `brain.queries.embedding_v2` (`vector(1024)`), with an HNSW cosine index on memories. The 384 column stays and keeps being filled.
- Model: `voyage-4`, 1,024 dimensions, `input_type` `document` for memories and `query` for questions (https://docs.voyageai.com/docs/embeddings, https://docs.voyageai.com/reference/embeddings-api). Override with the secret `TALI_EMBED_MODEL`. The 4 series models share one space, so moving to `voyage-4-lite` or `voyage-4-large` later needs no re-index.
- `tali-brain-embed` now does two steps each run: the original 5 rows with gte-small, then up to 64 memories (and up to 8 fresh questions) in one call for the new column. The migration reschedules the every minute job so it also wakes while there is a backlog. 339 active memories is about 6 runs, so the backfill takes roughly 6 minutes.
- `brain.recall_hybrid(p_user_id, p_query, p_qvec vector(1024), p_limit, p_kinds, p_include_shared)`: same columns as `brain.recall`. Takes the best matches by words (the old scoring) and the nearest by meaning, and blends the two lists by rank. A memory with no new numbers yet is still found by its words. With `p_qvec` null it simply calls `brain.recall`.
- `public.tali_context(p_user_id, p_query, p_limit, p_qvec text)`: a new four argument version. The two and three argument versions the live app calls are unchanged. Adds `"search": "words" | "words and meaning"` to the result.
- `tali-chat`: when the key is set it turns the question into numbers first (2.5 second limit), calls the four argument version, and falls back to the old call if either step fails. The reranker still runs on top.
- `brain.answer` and `brain.related` keep their signatures and now prefer the new numbers when both sides have them.
- Shared brain rows are embedded and searched the same way.

### 2. Real connections

```
public.my_connections(p_text text, p_limit integer default 3) returns jsonb
-> [{ "id": uuid, "text": string, "kind": string, "region": string | null }]
```

- For the signed in user only (`auth.uid()`), their own active memories only, shared brain excluded. Signed out returns `[]`. `p_limit` is clamped to 1 to 10.
- `p_text` can be a name ("Bayside Physio"), a sender, or the words of one of their own memories. A memory's text cut short with `…` or `...` on the end is matched by its start (12 characters or more).
- Evidence, strongest first: the memory is about the same name, or a name she knows goes by that name (3); its words mention the name as a whole word (2); it means nearly the same as the memory tapped (1 plus how alike), only above a floor.
- Names come from `about`, `brain.entities` (names and aliases) and the user's `clients`.
- Order: strongest evidence, then importance, then newest.
- The floors live in `brain.embed_state` (`conn_floor_v2` 0.62, `conn_floor_v1` 0.86) so they can be tuned with one update and no deploy.

The save path is fixed so there is something to connect:
- `public.brain_remember_v2(p_user_id, p_kind, p_content, p_about, p_source_ref, p_urgent, p_due_on date, p_yearly boolean) returns uuid` (service role only). It calls the existing `brain_remember_for`, then: adds the names she already knows that the sentence mentions (her entities and aliases, and the user's clients) when `about` came back short; keeps a `person` card in `brain.entities` for each name she gave on a `person` memory (never for a client name); and keeps the date.
- `tali-chat` calls it and falls back to `brain_remember_for` if it errors, so a memory is never lost. The memory tool's `about` description is now firm about filling names in.

### 3. Dates

- New columns `due_on date`, `yearly boolean not null default false`.
- The memory tool has two new optional fields, `date` (YYYY-MM-DD) and `yearly`. Tali already gets today's date in her prompt.
- If she gives no date, `brain.date_in_text(text, today)` reads one out of the sentence, carefully: exactly one date, not a range, not the word "may" in lower case, and it must be a birthday or anniversary or read as something still to come. A note about a day that has been ("On 4 Nov 2026 the health check found...") is left alone.

```
public.my_upcoming(p_days integer default 45) returns jsonb
-> [{ "id": uuid, "text": string, "kind": string, "date": "YYYY-MM-DD", "days_away": integer, "yearly": boolean }]
```

- Signed in user only, active memories, soonest first, at most 10. `p_days` is clamped to 1 to 366. "Today" is in the user's own timezone. Yearly dates show their next occurrence (29 February shows as 28 February in other years). `days_away` is 0 for today.
- Backfill in the migration: only memories kept from Tali HQ chats (`source = 'tali hq chat'`), kinds fact, person, event, plan and idea, where the sentence holds one clear date. I looked at where dates sit in the live brain: almost all are the scheduled jobs' own notes that start with the day they ran, which is why those sources are left out. Expect the backfill to set very few rows.

### 4. Correct a memory

```
public.my_memory_update(p_id uuid, p_content text) returns boolean
```

- The signed in user edits the words of one of their own active memories. Text is trimmed and inner runs of spaces collapsed; it must be 3 to 600 characters.
- Clears both sets of search numbers (the every minute job redoes them), re-reads the date when the new words hold one clear date (otherwise the old date stays), sets `corrected_at = now()` and lifts confidence to at least 0.95.
- Returns `false` when signed out, when the memory is not theirs or not active, or when the text is too short or too long. Never touches shared or other users' rows.
- New column `corrected_at timestamptz`.

### 5. The tidy

**What exists today:** the nightly "Sleep" is not a database job and not an edge function. It is a scheduled Claude task that runs outside the database, on the founder's own brain only. `brain.sleep_log` has 13 runs, the latest on 8 November 2026, one a night. From the log: it merges 1 to 4 repeats a night, has never faded or promoted anything (both columns are 0 on every run), mirrors the notebook into the brain, and checks that night school's lesson was saved. There is no cron job for it in Postgres. Customers get no tidy at all. Across the whole brain 27 memories are marked merged, all the founder's.

**What I added, and only this:** `public.brain_tidy_customers(p_max_per_user integer default 20) returns jsonb` on cron `tali-brain-tidy`, Saturdays 16:17 UTC (Sunday 3:17am Sydney in summer). For every user except the founder it merges repeats. A pair is merged only when all of these hold: same person, same kind, both active, neither urgent, neither in an open conflict, the original search numbers say 0.95 or more alike, and the words are 0.55 or more alike by letters. The stronger memory is kept and takes the other's names, tags and confirmations. The other is marked `merged` and points at the keeper. Nothing is deleted, nothing is faded or retired. Each run that merges anything writes one line to `brain.sleep_log`.

I left `brain.near_duplicates` alone on purpose. The founder's Sleep task uses it with a threshold tuned to the old numbers, and swapping the model under it would change what that threshold means.

## Put it live

Either order works. Each side checks for the other and carries on the old way if it is not there.

1. Run `supabase/migrations/20261110000058_brain_overhaul.sql` in the SQL editor: https://supabase.com/dashboard/project/jbyzblwrywgxilhmfyjt/sql/new
2. Deploy two functions:

```
npx supabase functions deploy tali-brain-embed --no-verify-jwt --project-ref jbyzblwrywgxilhmfyjt
npx supabase functions deploy tali-chat --no-verify-jwt --project-ref jbyzblwrywgxilhmfyjt
```

`VOYAGE_API_KEY` is already set. No new secret is needed.

### Watch the backfill

```sql
select public.brain_embed_v2_progress();
-- {"on": true, "model": "voyage-4", "done": 339, "to_go": 0, "last_ok": "...", "last_error": null}
```

`to_go` should reach 0 within about 10 minutes of the function being deployed. If `on` is false, `last_error` says why (no key, a refused call, the wrong shape back). It switches itself back on the next time a call works, which is tried whenever a new memory is saved. To force a retry: `update brain.embed_state set v2_on = true;`

To see what chat recall is using, the fourth argument version of `tali_context` returns `"search": "words and meaning"` when the question had numbers.

### Tune without a deploy

```sql
update brain.embed_state set conn_floor_v2 = 0.62, conn_floor_v1 = 0.86, recall_margin = 0.2;
```

`recall_margin` is how far behind the best match by meaning a memory can be and still be recalled by meaning.

## Roll back

- **Chat recall back to words only, at once:** `update brain.embed_state set v2_on = false; update brain.memories set embedding_v2 = null;` With no new numbers on any memory, the blended recall returns exactly the word matches. Or remove the secret `VOYAGE_API_KEY` (this also turns the reranker off).
- **Functions:** redeploy the previous `tali-chat` and `tali-brain-embed` from `brain-build-10nov`. They do not use anything this migration adds.
- **The tidy:** `select cron.unschedule('tali-brain-tidy');` To put a merged memory back: `update brain.memories set status = 'active', merged_into = null where id = '...';`
- **The every minute job:** the migration replaces its schedule with the same call and one more wake condition. To restore the original condition, reschedule it without the last `or (...)` line.
- **Everything else** (columns, new functions) can stay. Nothing live reads them. `brain.answer` and `brain.related` behave as before when no row has new numbers.

## Checked, and how

- The migration parses (pglast, 48 statements) and was run twice in a row on a local Postgres 16 against a copy of the brain's tables and the live definitions of `brain.recall`, `brain.remember` and `brain_remember_for`. pgvector could not be installed here, so the vector type was a stand-in with the same two operators. All five parts were exercised: dates (14 sentences, including ranges, "3 may be", 31 June, 29 February and log style notes), saving with names and dates, upcoming, connections (by name, by alias, from a memory cut short, another user's rows never returned, signed out returns nothing, special characters safe), correcting (another user refused, too short refused, numbers cleared, date re-read), the embed plumbing, blended recall (meaning found three memories that words missed), `answer`, `related` and the tidy (one true repeat merged, a different kind and the founder's rows left alone, a second run did nothing).
- `deno check` passes for `tali-chat`, `tali-brain-embed` and `_shared/brainEmbed.ts` (with the `jsr:` types import removed, because jsr.io is blocked here).
- `tali-brain-embed` was run against stubbed services in five cases: working, no key, a refused key, the wrong number of dimensions back, and the migration not run yet. The old 384 step ran in every case.

## Not verified

- **No real call to the embeddings service.** The request fields are from the docs above. The docs page shows no response example, so the response shape (`data[].embedding`, `data[].index`, `usage.total_tokens`) is from my knowledge of the API; the code also accepts a bare `embeddings` list. If the shape is different, the function reports "wrong shape back" and everything stays on the old path.
- **The real pgvector type.** `vector(1024)`, the `<=>` operator, the `vector_cosine_ops` HNSW index and the text cast `'[...]'::vector(1024)` are standard pgvector (0.8.2 is installed) but did not run here.
- **The three thresholds** (`conn_floor_v2`, `conn_floor_v1`, `recall_margin`) and the tidy's 0.95 and 0.55 are first guesses. They are safe on the careful side but have not been tuned on real numbers.
- **Recall quality.** I could not measure it. One known effect: with meaning switched on, recall can return memories that match no words, so Tali sees more memories on thin brains than before. The margin and the reranker are what keep that in check.
- **The date fields in the memory tool** depend on the model filling them in sensibly. The server only accepts dates from a year back to ten years ahead.
- **The four argument `tali_context`** is picked by PostgREST from the argument names. Three overloads with different names is supported, but this one has not been called through the API.
- `my_brain` does not return `due_on` or `corrected_at`. The app gets dates from `my_upcoming`. If the Her brain list should show "corrected by you", `my_brain` needs a small follow up.
