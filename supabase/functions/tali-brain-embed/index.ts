import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// Tali HQ: embeds new brain memories and queued questions (gte-small, 384 dims).
// Called every minute by pg_cron (migration 006) and by brain.ask(). Deployed with verify_jwt false;
// it checks its own x-tali-key against the vault secret instead.
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BATCH = 5;
// @ts-ignore Supabase.ai is provided by the edge runtime
const model = new Supabase.ai.Session("gte-small");

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
  return Response.json({ ok: failures.length === 0, embedded: done, batch: todo.length, failures });
});
