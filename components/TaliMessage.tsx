import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colours, radius } from '@/constants/theme';

// Tali's replies in Talk, laid out instead of one wall of text (mockup, 5 Nov 2026).
// A small hand-rolled reader for the few patterns Tali writes, no markdown library:
//   **bold**, "- " or "• " bullets, "1. " numbered steps, a short lead line,
//   a drafted message in quotes (or fenced as ```draft) shown as a Draft card with Copy,
//   blank lines between paragraphs, and "Next step:" / "Tali's take:" callouts.
// Anything it does not recognise is shown as plain text, so an odd reply never breaks.

type Block =
  | { type: 'lead'; text: string }
  | { type: 'para'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'steps'; items: { n: string; text: string }[] }
  | { type: 'draft'; text: string }
  | { type: 'callout'; label: string; text: string };

const BULLET = /^\s*(?:[-•*])\s+(.*)$/;
const STEP = /^\s*(\d{1,2})[.)]\s+(.*)$/;
const CALLOUT = /^\s*(?:\*\*)?(Next step|Tali's take|Tali’s take)(?:\*\*)?\s*[:.]\s*(?:\*\*)?\s*/i;
const OPEN_Q = /^["“]/;
const CLOSE_Q = /["”]$/;
const FENCE = /^\s*```\s*(draft)?\s*$/i;
const LEAD_MAX = 90;

function stripQuotes(s: string) {
  return s.trim().replace(OPEN_Q, '').replace(CLOSE_Q, '').trim();
}

// A paragraph wrapped in quotes and long enough to be a message (not a quoted word or two).
function isQuotedDraft(p: string) {
  const t = p.trim();
  return OPEN_Q.test(t) && CLOSE_Q.test(t) && t.length >= 40;
}

export function parseTali(raw: string): Block[] {
  const text = (raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  // 1. Pull out ``` fenced drafts first, so their blank lines stay inside the card.
  const chunks: ({ kind: 'text'; text: string } | { kind: 'draft'; text: string })[] = [];
  const lines = text.split('\n');
  let buf: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (FENCE.test(line)) {
      if (inFence) { chunks.push({ kind: 'draft', text: buf.join('\n').trim() }); buf = []; inFence = false; }
      else { if (buf.length) chunks.push({ kind: 'text', text: buf.join('\n') }); buf = []; inFence = true; }
      continue;
    }
    buf.push(line);
  }
  if (buf.length) chunks.push({ kind: inFence ? 'draft' : 'text', text: buf.join('\n') });

  const blocks: Block[] = [];
  for (const c of chunks) {
    if (c.kind === 'draft') { if (c.text) blocks.push({ type: 'draft', text: c.text }); continue; }
    // 2. A quoted draft can run over several paragraphs: join from an opening quote to its closing one.
    const paras = c.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    for (let i = 0; i < paras.length; i++) {
      const p = paras[i];
      if (OPEN_Q.test(p) && !CLOSE_Q.test(p)) {
        const end = paras.findIndex((q, j) => j > i && CLOSE_Q.test(q) && !OPEN_Q.test(q));
        if (end > i && end - i <= 4) {
          const joined = paras.slice(i, end + 1).join('\n\n');
          blocks.push({ type: 'draft', text: stripQuotes(joined) });
          i = end;
          continue;
        }
      }
      if (isQuotedDraft(p)) { blocks.push({ type: 'draft', text: stripQuotes(p) }); continue; }
      const co = p.match(CALLOUT);
      if (co) {
        const rest = p.slice(co[0].length).trim();
        blocks.push({ type: 'callout', label: /next/i.test(co[1]) ? 'Next step' : "Tali's take", text: rest.charAt(0).toUpperCase() + rest.slice(1) });
        continue;
      }
      // 3. Inside a paragraph, runs of bullet or numbered lines become lists; other lines stay text.
      let textRun: string[] = [];
      const flush = () => { if (textRun.length) { blocks.push({ type: 'para', text: textRun.join('\n') }); textRun = []; } };
      for (const line of p.split('\n')) {
        const b = line.match(BULLET);
        const s = line.match(STEP);
        const last = blocks[blocks.length - 1];
        if (b) {
          flush();
          if (last?.type === 'bullets' && !textRun.length) last.items.push(b[1]);
          else blocks.push({ type: 'bullets', items: [b[1]] });
        } else if (s) {
          flush();
          if (last?.type === 'steps') last.items.push({ n: s[1], text: s[2] });
          else blocks.push({ type: 'steps', items: [{ n: s[1], text: s[2] }] });
        } else if (line.trim() && (last?.type === 'bullets' || last?.type === 'steps') && !textRun.length && /^\s{2,}/.test(line)) {
          // an indented follow-on line belongs to the item above
          if (last.type === 'bullets') last.items[last.items.length - 1] += ' ' + line.trim();
          else last.items[last.items.length - 1].text += ' ' + line.trim();
        } else {
          textRun.push(line);
        }
      }
      flush();
    }
  }

  // 4. Lead line: only when there is more to the reply. A one liner stays a plain one liner.
  const first = blocks[0];
  if (first?.type === 'para' && blocks.length + (first.text.includes('\n') ? 1 : 0) > 1) {
    const t = first.text;
    const firstLine = t.split('\n')[0];
    const sentence = firstLine.match(/^(.+?[.!?])(\s+|$)/);
    if (!t.includes('\n') && t.length <= LEAD_MAX) {
      blocks[0] = { type: 'lead', text: t };
    } else if (sentence && sentence[1].length <= LEAD_MAX) {
      const rest = t.slice(sentence[0].length).trim();
      blocks.splice(0, 1, { type: 'lead', text: sentence[1] }, ...(rest ? [{ type: 'para', text: rest } as Block] : []));
    } else if (firstLine.length <= LEAD_MAX && t.includes('\n')) {
      blocks.splice(0, 1, { type: 'lead', text: firstLine }, { type: 'para', text: t.slice(firstLine.length).trim() });
    }
  }
  return blocks;
}

// **bold** inside a line. An unmatched ** is dropped rather than shown.
function Inline({ text, style }: { text: string; style?: object }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <Text style={style}>
      {parts.map((p, i) => (i % 2 ? <Text key={i} style={{ fontWeight: '700' }}>{p}</Text> : p.replace(/\*\*/g, '')))}
    </Text>
  );
}

const body = { color: colours.text, fontSize: 15, lineHeight: 22 };

function DraftBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ backgroundColor: colours.purpleSoft, borderRadius: 14, borderWidth: 1, borderColor: '#E6D6EE', padding: 12, gap: 6 }}>
      <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: colours.purple }}>DRAFT</Text>
      <Inline text={text} style={{ ...body, color: colours.purpleInk }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Copy the draft"
        hitSlop={6}
        onPress={async () => {
          await Clipboard.setStringAsync(text.replace(/\*\*/g, ''));
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        style={{ alignSelf: 'flex-start', marginTop: 4, backgroundColor: colours.surface, borderWidth: 1, borderColor: '#DCC6E6', borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 14 }}>
        <Text style={{ color: colours.purple, fontSize: 13, fontWeight: '700' }}>{copied ? 'Copied' : 'Copy'}</Text>
      </Pressable>
    </View>
  );
}

export function TaliMessage({ content }: { content: string }) {
  const blocks = parseTali(content);
  if (!blocks.length) return null;
  return (
    <View style={{ gap: 10 }}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'lead':
            return <Inline key={i} text={b.text} style={{ color: colours.text, fontSize: 16.5, lineHeight: 23, fontWeight: '700' }} />;
          case 'para':
            return <Inline key={i} text={b.text} style={body} />;
          case 'bullets':
            return (
              <View key={i} style={{ gap: 6 }}>
                {b.items.map((it, j) => (
                  <View key={j} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colours.purple, marginTop: 8, marginLeft: 2 }} />
                    <Inline text={it} style={{ ...body, flex: 1 }} />
                  </View>
                ))}
              </View>
            );
          case 'steps':
            return (
              <View key={i} style={{ gap: 8 }}>
                {b.items.map((it, j) => (
                  <View key={j} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colours.purpleSoft, alignItems: 'center', justifyContent: 'center', marginTop: 0 }}>
                      <Text style={{ color: colours.purple, fontSize: 12, fontWeight: '800' }}>{it.n}</Text>
                    </View>
                    <Inline text={it.text} style={{ ...body, flex: 1 }} />
                  </View>
                ))}
              </View>
            );
          case 'draft':
            return <DraftBlock key={i} text={b.text} />;
          case 'callout':
            return (
              <View key={i} style={{ flexDirection: 'row', gap: 10, backgroundColor: colours.sunk, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
                <View style={{ width: 3, borderRadius: 2, backgroundColor: b.label === 'Next step' ? colours.orange : colours.purple }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: b.label === 'Next step' ? '#B65F00' : colours.purple }}>{b.label.toUpperCase()}</Text>
                  <Inline text={b.text} style={body} />
                </View>
              </View>
            );
        }
      })}
    </View>
  );
}
