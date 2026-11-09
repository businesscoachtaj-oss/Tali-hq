// supabase/functions/_shared/brainEmbed.ts
// ADDED (10 Nov 2026, brain overhaul, asked for by Taj): the stronger search numbers for Tali's brain.
//
// A memory and a question are each turned into 1,024 numbers that capture what they mean, so she can
// find a memory by meaning and not only by matching words. Used in two places:
//   tali-brain-embed  fills the numbers for every memory (the every minute job, and the backfill)
//   tali-chat         turns the question into numbers before recall
//
// Safe with no key: both helpers return null and the caller carries on the old way. Nothing throws.
// Secrets: VOYAGE_API_KEY (optional), TALI_EMBED_MODEL (optional override).
// Docs: https://docs.voyageai.com/docs/embeddings and https://docs.voyageai.com/reference/embeddings-api

const VOYAGE_KEY = Deno.env.get('VOYAGE_API_KEY') ?? '';
// The 4 series models share one space, so a later move between them needs no re-index.
export const EMBED_MODEL = Deno.env.get('TALI_EMBED_MODEL') ?? 'voyage-4';
export const EMBED_DIMS = 1024;
export const embedReady = () => !!VOYAGE_KEY;

// Unit length, so "how alike" is the same sum whichever way the database measures it.
function unit(v: number[]): number[] | null {
  let sum = 0;
  for (const x of v) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return null;
    sum += x * x;
  }
  const len = Math.sqrt(sum);
  if (!len) return null;
  return v.map((x) => x / len);
}

// The text form the database takes: "[0.1,0.2,...]"
export const vectorText = (v: number[]) => `[${v.map((x) => Number(x.toFixed(7))).join(',')}]`;

export type EmbedResult = { vectors: (number[] | null)[]; model: string; tokens: number };

// Turns a list of texts into search numbers, in order. `kind` tells the model whether these are
// memories ("document") or a question ("query"). Returns null on any problem (no key, a refused
// call, a timeout, the wrong shape back), with the reason in `why` when asked for.
export async function embedTexts(texts: string[], kind: 'document' | 'query', timeoutMs = 20000, why?: { error?: string }): Promise<EmbedResult | null> {
  const fail = (reason: string) => {
    if (why) why.error = reason;
    return null;
  };
  if (!VOYAGE_KEY) return fail('no key');
  if (!texts.length) return { vectors: [], model: EMBED_MODEL, tokens: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${VOYAGE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: texts.map((t) => String(t ?? '').slice(0, 8000) || '-'),
        model: EMBED_MODEL,
        input_type: kind,
        output_dimension: EMBED_DIMS,
        truncation: true,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return fail(`search numbers ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
    const data: any = await res.json();
    // Usual shape: { data: [{ embedding: [...], index: 0 }, ...], model, usage: { total_tokens } }
    const rows: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data?.embeddings) ? data.embeddings.map((e: any, i: number) => ({ embedding: e, index: i })) : [];
    if (!rows.length) return fail('nothing came back');
    const vectors: (number[] | null)[] = texts.map(() => null);
    rows.forEach((r, i) => {
      const at = Number.isInteger(r?.index) ? Number(r.index) : i;
      const v = Array.isArray(r?.embedding) ? r.embedding : null;
      if (at >= 0 && at < vectors.length && v && v.length === EMBED_DIMS) vectors[at] = unit(v);
    });
    if (vectors.every((v) => v === null)) return fail('wrong shape back');
    return { vectors, model: String(data?.model ?? EMBED_MODEL), tokens: Number(data?.usage?.total_tokens ?? data?.total_tokens ?? 0) };
  } catch (e) {
    return fail(String(e).slice(0, 160));
  } finally {
    clearTimeout(timer);
  }
}

// One question, as the text form the database takes, or null. Kept quick: recall waits on it.
export async function embedQuery(text: string, timeoutMs = 2500): Promise<string | null> {
  const t = String(text ?? '').trim();
  if (t.length < 3) return null;
  const r = await embedTexts([t.slice(0, 2000)], 'query', timeoutMs);
  const v = r?.vectors[0];
  return v ? vectorText(v) : null;
}
