# Plan: her brain inside Claude (10 Nov 2026)

For Taj to say yes, no or change. Nothing here is built.

## What exists today

Two connectors are built for the Livewell database and share one core file:

- **Tali by Totality** (trainers and gym owners): 11 tools. Nine read (clients, client summary, inactive clients, schedule, programme overview, exercise history, membership revenue, check-in inbox, exercise search) and two write (save a programme, reply to a check-in), which need the Tali AI add-on.
- **Tali by Totality Nutrition** (members): 13 tools, such as today's summary, food log, trends, food search, meal planner, grocery list, and logging food, water and weight.

How they sign in: Claude sends the person to the normal Totality sign-in (Supabase sign-in with OAuth). Every call then runs as that person, so the database's own row rules decide what they can see. A plan check runs on every tool call. Claude's own thinking uses no Totality credits.

There is no connector for Tali HQ yet.

## What I recommend

A third connector, **Tali HQ**, built on the same core, so it behaves and signs in the same way.

**Start with four tools:**
1. **Search my brain:** "what do you know about Jess?" Returns her own memories that match.
2. **What's coming up:** what is late, waiting for a yes, due today, and dates she remembers.
3. **Remember this:** saves one new memory, after showing exactly what will be saved.
4. **Forget this:** removes one memory, after showing which one.

**Read first, then write.** Ship tools 1 and 2 first. Add 3 and 4 a week later once the read side has been used. A fifth tool, "ask Tali" (a full chat turn that costs credits), can wait.

**Sign in:** the same Supabase sign-in, on the Tali HQ project. Every call runs as the signed-in person.

**Never exposed:** other people's memories, the shared brain's internals, which AI companies run each part, your founder views, and memories the person marked private unless they ask for them by name.

**Cost:** tools 1, 2 and 4 are database reads and writes, close to free, so no credits. Tool 1 with the better search costs a fraction of a cent. "Remember this" is free too. Only a future "ask Tali" would use credits.

**Who gets it:** paid plans and the trial, same as the app's own memory features. Free could get search only.

## Size

About 3 days for the read tools (the core is already written, it needs pointing at the Tali HQ project and two new database functions), plus 1 to 2 days for the two write tools, then the directory submission. The Totality one is still in review, so expect a wait.

## Your decisions

1. Its own listing ("Tali HQ"), or folded into Tali by Totality? I recommend its own, because Tali HQ is not a fitness product.
2. Read only at launch (recommended), or read and write from day one?
3. Which plans get it?
4. Should private memories be searchable from Claude at all?

## Not checked

- Whether Supabase's OAuth sign-in is switched on for the Tali HQ project. The Livewell project has it; I could not see that setting for Tali HQ from here.
- The Totality connector's review status with Anthropic.
