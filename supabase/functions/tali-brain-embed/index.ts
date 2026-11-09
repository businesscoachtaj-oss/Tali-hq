import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { embedReady, embedTexts, vectorText } from "../_shared/brainEmbed.ts";

// Tali HQ: embeds new brain memories and queued questions.
// Called every minute by pg_cron (migration 006, rescheduled in 20261110000058) and by brain.ask().
// Deployed with verify_jwt false; it checks its own x-tali-key against the vault secret instead.
//
// Two sets of search numbers per memory:
//   1. the original (gte-small, 384 dims, built into the edge runtime). Unchanged, always filled.
//   2. ADDED (10 Nov 2026, brain overhaul): the stronger set (1,024 dims), filled when VOYAGE_API_KEY
//      is set. One call covers a whole batch, so the first run after the migration works through the
//      existing brain a batch a minute. If the key is missing, the call fails, or the migration has
//      not been run yet, step 2 is skipped and step 1 carries on exactly as before.
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BATCH = 5;
const BATCH_V2 = 64;
// @ts-ignore Supabase.ai is provided by the edge runtime
const model = new Supabase.ai.Session("gte-small");

type Pending = { tbl: string; id: string; body: string };

// Step 2. Returns a short note for the response, never throws.
async function fillStronger(): Promise<Record<string, unknown>> {
  try {
    const { data: rows, error } = await supabase.rpc("brain_pending_v2", { p_limit: BATCH_V2 });
    // Not there yet (migration not run): nothing to do, and nothing to report.
    if (error) return { skipped: "not set up yet" };
    const todo = ((rows ?? []) as Pending[]).slice(0, BATCH_V2 + 8);
    if (!embedReady()) {
      // Tell the database so cron stops waking us for a backfill we cannot do.
      if (todo.length) await supabase.rpc("brain_embed_v2_note", { p_on: false, p_error: "no key set" });
      return { skipped: "no key" };
    }
    if (!todo.length) return { embedded: 0 };
    let done = 0;
    let modelUsed = "";
    // Questions and memories are asked for separately: the model treats them differently.
    for (const kind of ["query", "document"] as const) {
      const part = todo.filter((r) => (r.tbl === "queries") === (kind === "query"));
      if (!part.length) continue;
      const why: { error?: string } = {};
      const res = await embedTexts(part.map((r) => String(r.body ?? "")), kind, 25000, why);
      if (!res) {
        await supabase.rpc("brain_embed_v2_note", { p_on: false, p_error: why.error ?? "call failed" });
        return { embedded: done, failed: why.error ?? "call failed" };
      }
      modelUsed = res.model;
      const payload = part
        .map((r, i) => (res.vectors[i] ? { tbl: r.tbl, id: r.id, embedding: vectorText(res.vectors[i]!) } : null))
        .filter(Boolean);
      if (!payload.length) continue;
      const { data: n, error: setErr } = await supabase.rpc("brain_set_embeddings_v2", { p_rows: payload, p_model: modelUsed });
      if (setErr) return { embedded: done, failed: setErr.message.slice(0, 160) };
      done += Number(n ?? 0);
    }
    return { embedded: done, batch: todo.length, model: modelUsed };
  } catch (e) {
    return { failed: String(e).slice(0, 160) };
  }
}

Deno.serve(async (req) => {
  const key = req.headers.get("x-tali-key") ?? "";
  if (!key) return new Response("forbidden", { status: 403 });
  const { data: ok, error: keyErr } = await supabase.rpc("brain_check_key", { p_key: key });
  if (keyErr || ok !== true) return new Response("forbidden", { status: 403 });

  const { data: rows, error } = await supabase.rpc("brain_pending", { p_limit: BATCH });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const todo = (rows ?? []).slice(0, BATCH);
  let done = 0;
  const failures: string[] = [];
  for (const row of todo) {
    try {
      const text = String(row.body).slice(0, 1500);
      const vec = await model.run(text, { mean_pool: true, normalize: true });
      const { error: setErr } = await supabase.rpc("brain_set_embedding", { p_tbl: row.tbl, p_id: row.id, p_embedding: JSON.stringify(Array.from(vec as number[])) });
      if (setErr) failures.push(`${row.id}: ${setErr.message}`); else done++;
    } catch (e) {
      failures.push(`${row.id}: ${(e as Error).message}`);
    }
  }
  const stronger = await fillStronger();
  return Response.json({ ok: failures.length === 0, embedded: done, batch: todo.length, failures, stronger });
});
