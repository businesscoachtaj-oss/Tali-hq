# Brain overhaul, part 2 (10 Nov 2026)

Asked for by Taj: "overhaul the brain itself". Part 1 (the morning of 10 Nov, `docs/BRAIN_OVERHAUL.md`) added search by meaning, connections, dates, corrections and a weekly tidy. Part 2 adds the three things that were still missing. Everything here is applied to the Tali HQ database and tested. One switch is deliberately left off (see Sleep).

## 1. A recall test, so changes are measured

- `brain.eval_cases`: 40 real questions about the founder's brain and the shared brain, each with the memory or memories that count as the right answer.
- `brain.eval_run('label')`: asks every question two ways (words only, and words and meaning together) and saves the score to `brain.eval_runs`. A run puts recall counts back as it found them.
- `brain.eval_prepare()`: gets search numbers for new questions through the every minute embed job. That job's wake condition was missing a case (a question that only needed the new numbers) and is fixed.

First scores, 40 questions, 10 Nov 2026:

| | Right memory first | Right memory in the top 5 |
|---|---|---|
| Words only (how chat recall worked until this morning) | 50% | 60% |
| Words and meaning (live now) | 80% | 100% |

`recall_margin` was tried at 0.1, 0.2 and 0.35. The difference is one or two questions, which is noise on 40, so it stays at 0.2. The score covers the database step only. The reranker in `tali-chat` runs on top and is not measured here.

To add a question: insert into `brain.eval_cases (user_id, question, expect)`, run `select brain.eval_prepare();` until it returns 0, then `select brain.eval_run('why you are running it');`.

## 2. Memories that age

- New column `brain.memories.last_confirmed_at`, set by a trigger whenever a memory proves right (`confirmed_count` goes up) or the owner corrects it.
- When Tali is handed an old fact, plan, event, idea or thing she saw that nobody has confirmed in 45 days, the date rides along: "(noted 3 Aug 2026, not confirmed since)". People, preferences, lessons, rules and yearly dates never get the note. This is in the four argument `public.tali_context`, the one chat uses when search by meaning is on. The two and three argument versions are unchanged.
- Fading is part of Sleep, below.

Already there before today and left alone: contradictions are flagged at the moment Tali saves a memory (`brain.conflicts`, settled by the owner in Her brain), and lessons gain or lose weight as they hold or break (`brain_evidence_for`).

## 3. Sleep, for everyone

Once a night, between 2am and 5am in the owner's own timezone, for anyone with a new memory since their last sleep:

1. `brain_sleep_material(user)` hands over the day's new memories and the older ones closest in meaning.
2. `tali-brain-sleep` (edge function, version 2) asks the everyday model three things: does a new memory make an older one out of date, are a few scattered notes really one fact, and what did she learn today in two or three lines.
3. `brain_sleep_apply(...)` checks every item again before touching anything (same person, same kind, not urgent, not corrected by the owner, not in an open contradiction, the replaced one must be older), then also merges plain repeats and lets small stale notes fade (things she saw or one-off events, low importance, four months old, never confirmed or recalled lately).
4. The night is saved to `public.brain_sleeps`: what she learnt, and every change with what it replaced.

For the app: `public.my_sleeps(p_limit)` returns the last nights, and `public.my_sleep_undo(sleep_id, index)` puts one change back. Nothing is ever deleted. The founder's brain is skipped, his own nightly Sleep task is untouched, and the weekly customer tidy still runs.

**Not switched on.** The hourly cron job is written at the bottom of migration 063 but commented out. It waits until Her brain shows each night with an undo, so nobody's memories change where they cannot see it. The screen needs a mock first.

No credits are charged for sleep. Cost is one small model call per active person per night.

## Checked, and how

- Recall test: run three times on the live brain (above). Recall counts confirmed restored.
- Sleep, in a rolled back transaction on a real customer brain: a newer price replaced the older one, two notes folded into one, a 200 day old note faded; an item pointing at another person's memory, a backwards replace and rubbish ids were all refused; the other person's memories were untouched; a second run the same night was refused; undo put each change back and retired the folded memory; undo twice and undo by another person were refused.
- `tali-brain-sleep` called for real with its key: the self test returned a correct replace, a correct fold and two plain lines, and a normal run found nobody due (it was 6pm).
- The age note returned the right words for an 80 day old fact and nothing for a person or a fresh fact.

## Not verified

- A real night on a real customer brain (the job is off).
- The age note inside a live chat. The database returns it; no chat turn was run to read Tali's reply with one.
- The 45 day and four month thresholds are first guesses. The app is ten days old, so nothing is old enough to test them on real data yet.
- The test set is 40 questions written in one sitting from the founder's brain. It is a start, not a benchmark.
