// supabase/functions/_shared/claude.ts
// ADDED (6 Nov 2026): one place to call the Anthropic Messages API with a forced tool.
//
// Why: Sonnet 5.5 and Opus 5.5 reject tool_choice "tool" and "any" with a 400
// ("not supported for this model"); Haiku accepts them. This broke Deep think and
// Big brain in tali-chat. Weekly review, monthly patterns, night school (Sonnet)
// and the shared-brain scrub (Opus) used the same forced tool_choice, so they would
// have failed the first time they reached the model.
//
// Fix: send the request as written. If the model refuses the forced tool_choice,
// send it again once with tool_choice auto and a line in the system prompt telling
// Tali to answer by calling the tool. Callers still check for the tool_use block.

const URL = 'https://api.anthropic.com/v1/messages';

export async function claudeMessages(apiKey: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const send = (b: Record<string, unknown>) =>
    fetch(URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(b),
      signal,
    });

  const res = await send(body);
  const tc = body.tool_choice as { type?: string; name?: string } | undefined;
  if (res.status !== 400 || !tc || tc.type === 'auto' || tc.type === 'none') return res;

  const text = await res.text();
  if (!/tool_choice/i.test(text)) return new Response(text, { status: 400, headers: res.headers });

  const hint = tc.type === 'tool' && tc.name
    ? `Answer only by calling the ${tc.name} tool.`
    : 'Answer by calling one of your tools.';
  const system = typeof body.system === 'string' && body.system.trim() ? `${body.system}\n\n${hint}` : hint;
  return send({ ...body, system, tool_choice: { type: 'auto' } });
}
