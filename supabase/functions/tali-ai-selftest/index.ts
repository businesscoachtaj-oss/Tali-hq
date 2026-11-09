// Self test (10 Nov 2026): proves the Gemini, Voyage and OpenAI keys and the model ids Tali uses really
// work, with four tiny calls (well under a cent). Guarded by the same vault key as the brain jobs.
// Returns statuses only, never a key or any user data. Safe to delete once the extra AIs are proven.
import { createClient } from "npm:@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const short = (s: string) => s.replace(/\s+/g, " ").slice(0, 220);
async function tryIt(fn: () => Promise<Response>, pick: (j: any) => unknown) {
  try {
    const res = await fn();
    const text = await res.text();
    let j: any = null;
    try { j = JSON.parse(text); } catch { /* not json */ }
    return res.ok ? { ok: true, status: res.status, got: pick(j) } : { ok: false, status: res.status, error: short(j?.error?.message ?? j?.detail ?? text) };
  } catch (e) {
    return { ok: false, status: 0, error: short(String(e)) };
  }
}
Deno.serve(async (req) => {
  const key = req.headers.get("x-tali-key") ?? "";
  if (!key) return new Response("forbidden", { status: 403 });
  const { data: ok, error } = await supabase.rpc("brain_check_key", { p_key: key });
  if (error || ok !== true) return new Response("forbidden", { status: 403 });
  const body = await req.json().catch(() => ({}));
  const G = Deno.env.get("GEMINI_API_KEY") ?? "", V = Deno.env.get("VOYAGE_API_KEY") ?? "", O = Deno.env.get("OPENAI_API_KEY") ?? "";
  const gm = body.gemini ?? Deno.env.get("TALI_VIDEO_MODEL") ?? "gemini-3.8-flash";
  const vm = body.voyage ?? Deno.env.get("TALI_RERANK_MODEL") ?? "rerank-2.5-lite";
  const om = body.openai ?? Deno.env.get("TALI_SECOND_MODEL") ?? "gpt-5.4";
  const out: Record<string, unknown> = { keys: { gemini: !!G, voyage: !!V, openai: !!O }, models: { gm, vm, om } };
  out.gemini = await tryIt(() => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gm}:generateContent`, { method: "POST", headers: { "x-goog-api-key": G, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }], generationConfig: { maxOutputTokens: 200 } }) }), (j) => ({ model: j?.modelVersion, text: short(String(j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "")) }));
  if (body.list) out.gemini_models = await tryIt(() => fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": G } }), (j) => (j?.models ?? []).map((m: any) => String(m.name).replace("models/", "")).filter((n: string) => /flash|pro/.test(n)));
  out.gemini_files = await tryIt(() => fetch("https://generativelanguage.googleapis.com/v1beta/files?pageSize=1", { headers: { "x-goog-api-key": G } }), (j) => ({ reachable: true, files: (j?.files ?? []).length }));
  out.voyage = await tryIt(() => fetch("https://api.voyageai.com/v1/rerank", { method: "POST", headers: { Authorization: `Bearer ${V}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: "when is the invoice due", documents: ["The dog likes the beach.", "Invoice 12 is due on Friday.", "Coffee order for Monday."], model: vm, top_k: 2, truncation: true }) }), (j) => ({ wrapper: Array.isArray(j?.data) ? "data" : Array.isArray(j?.results) ? "results" : "other", order: (j?.data ?? j?.results ?? []).map((r: any) => r.index), tokens: j?.usage?.total_tokens }));
  const oBody = (reason: boolean) => ({ model: om, instructions: "Answer in JSON.", input: "Say whether 2+2=4.", max_output_tokens: 600, ...(reason ? { reasoning: { effort: "low" } } : {}), text: { format: { type: "json_schema", name: "t", strict: true, schema: { type: "object", additionalProperties: false, properties: { agree: { type: "string" } }, required: ["agree"] } } } });
  const oCall = (reason: boolean) => tryIt(() => fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${O}`, "Content-Type": "application/json" }, body: JSON.stringify(oBody(reason)) }), (j) => ({ model: j?.model, status: j?.status, text: short(JSON.stringify((j?.output ?? []).flatMap((o: any) => (o?.content ?? []).map((c: any) => c?.text)).filter(Boolean))) }));
  out.openai_with_reasoning = await oCall(true);
  if (!(out.openai_with_reasoning as any).ok) out.openai_plain = await oCall(false);
  out.moderation = await tryIt(() => fetch("https://api.openai.com/v1/moderations", { method: "POST", headers: { Authorization: `Bearer ${O}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "omni-moderation-latest", input: "What should I charge for a catering job?" }) }), (j) => ({ flagged: j?.results?.[0]?.flagged, has_scores: !!j?.results?.[0]?.category_scores }));
  return Response.json(out);
});
