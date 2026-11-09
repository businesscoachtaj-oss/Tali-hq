// Builds every Tali HQ email (10 Nov 2026). Run from this folder:  node build.mjs
//
// Writes the four Supabase auth templates here (confirm_signup, reset_password, magic_link,
// change_email), welcome.html and day3.html as previews of the two emails Tali sends herself, and
// ../functions/tali-welcome/template.ts, which the tali-welcome function sends.
//
// It replaces build.ts, which leaned on a layout file in another repo. This one stands alone, so the
// emails can be rebuilt from this repo with nothing else checked out.
//
// The look follows the app's night sky: deep navy page, a violet panel with Tali in it, a serif
// heading (Georgia, so no web font is needed) and a rounded violet button. Everything is tables and
// inline styles so Gmail, Apple Mail and Outlook all draw it the same way.
import { writeFileSync } from 'node:fs';

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',Times,serif";
const C = { page: '#0C0A24', card: '#17133A', line: '#3A2F7A', panel: '#5B45C9', text: '#F4F1FF', soft: '#D9D4F0', muted: '#B9B2D9', faint: '#8E88B5', violet: '#B9A6FF', ink: '#141033' };
// Tali's pictures are the ones the live emails already use.
const TALI = (pose) => `https://totality360.com.au/email/tali/${pose}.png`;

const p = (html, o = {}) =>
  `<p style="margin:0 0 14px;font-family:${SANS};font-size:${o.small ? 13 : 15}px;line-height:1.6;color:${o.muted ? C.muted : C.soft};">${html}</p>`;

const button = (label, url) => `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:10px 0 20px;"><tr>
<td align="center" bgcolor="${C.violet}" style="border-radius:999px;background:${C.violet};">
<a href="${url}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:16px;font-weight:700;color:${C.ink};text-decoration:none;border-radius:999px;">${label}</a>
</td></tr></table>`;

// For when the button does not work (some mail apps strip them).
const linkFallback = (url) =>
  `<p style="margin:0 0 14px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.faint};word-break:break-all;">Button not working? Copy this link into your browser:<br><a href="${url}" style="color:${C.violet};">${url}</a></p>`;

const signoff = (name) => `<p style="margin:18px 0 0;font-family:${SERIF};font-size:18px;line-height:1.4;color:${C.text};">${name}</p>`;

const step = (n, title, text) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 14px;"><tr>
<td width="40" valign="top" style="padding-top:2px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="28" height="28" align="center" valign="middle" bgcolor="${C.violet}" style="width:28px;height:28px;border-radius:14px;background:${C.violet};font-family:${SANS};font-size:14px;font-weight:800;color:${C.ink};">${n}</td></tr></table></td>
<td valign="top"><div style="font-family:${SANS};font-size:16px;font-weight:700;line-height:1.4;color:${C.text};">${title}</div><div style="font-family:${SANS};font-size:14px;line-height:1.55;color:${C.muted};">${text}</div></td>
</tr></table>`;

function layout({ preheader, eyebrow, title, pose, body, footnote = '' }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light">
<title>Tali HQ</title></head>
<body bgcolor="${C.page}" style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${preheader}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.page}" style="background:${C.page};"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 6px 14px;font-family:${SERIF};font-size:22px;color:${C.text};">Tali HQ <span style="color:${C.violet};font-size:14px;">&#10022;</span></td></tr>
<tr><td bgcolor="${C.card}" style="background:${C.card};border-radius:20px;border:1px solid ${C.line};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="padding:20px 20px 0;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.panel}" style="background:${C.panel};border-radius:16px;"><tr>
<td valign="middle" style="padding:20px 8px 20px 22px;"><div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#E6DEFF;margin:0 0 8px;">${eyebrow}</div><h1 style="margin:0;font-family:${SERIF};font-size:30px;line-height:1.2;font-weight:400;color:#FFFFFF;">${title}</h1></td>
<td width="84" valign="bottom" align="right" style="padding:14px 20px 0 0;"><img src="${TALI(pose)}" width="56" height="120" alt="Tali, the robot inside Tali HQ" style="display:block;width:56px;height:120px;border:0;outline:none;"></td>
</tr></table>
</td></tr>
<tr><td style="padding:24px 24px 28px;">${body}</td></tr>
</table>
</td></tr>
<tr><td style="padding:18px 8px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.faint};text-align:center;">
${footnote ? footnote + '<br>' : ''}Sent by Tali HQ, made in Australia. <a href="https://totality360.com.au/tali-hq" style="color:${C.faint};">totality360.com.au</a><br>Totality 360 Pty Ltd, ABN 58 698 902 975
</td></tr>
</table>
</td></tr></table>
</body></html>
`;
}

// ---------- the four Supabase auth emails ----------
const U = '{{ .ConfirmationURL }}';
const sign = signoff('Tali');
const auth = {
  confirm_signup: layout({
    preheader: 'One tap to confirm your email, then come and say hi.', eyebrow: 'Welcome', title: 'Nearly there', pose: 'wave',
    body: p("Tap the button to confirm your email and I'll see you inside.") + p('You have 7 days of Tali HQ to try everything. No card needed.') + button('Confirm my email', U) + linkFallback(U) + p("Didn't sign up for Tali HQ? You can ignore this email.", { muted: true, small: true }) + sign,
  }),
  reset_password: layout({
    preheader: 'Pick a new password for Tali HQ.', eyebrow: 'Password', title: 'Reset your password', pose: 'thinking',
    body: p('Tap the button to pick a new password. The link works once and expires soon.') + button('Reset my password', U) + linkFallback(U) + p("Didn't ask for this? Ignore this email and your password stays the same.", { muted: true, small: true }) + sign,
  }),
  magic_link: layout({
    preheader: 'Your sign-in link for Tali HQ.', eyebrow: 'Sign in', title: 'Your sign-in link', pose: 'wave',
    body: p('Tap the button to sign in to Tali HQ. The link works once and expires soon.') + button('Sign me in', U) + linkFallback(U) + p("Didn't ask for this? You can ignore this email.", { muted: true, small: true }) + sign,
  }),
  change_email: layout({
    preheader: 'Confirm your new email for Tali HQ.', eyebrow: 'Your account', title: 'Confirm your new email', pose: 'clipboard',
    body: p('Tap the button to confirm this is your new email for Tali HQ. Until you do, I keep using your old one.') + button('Confirm new email', U) + linkFallback(U) + p("Didn't ask for this? Ignore this email and nothing changes.", { muted: true, small: true }) + sign,
  }),
};
for (const [k, v] of Object.entries(auth)) writeFileSync(`${k}.html`, v);

// ---------- the welcome email (sent once by the tali-welcome function) ----------
// Tokens the function fills in: {{title}} (the greeting, already escaped), {{app_url}}, {{reply_line}}.
const welcomeHtml = layout({
  preheader: 'Three good things to do first.', eyebrow: 'Hello', title: '{{title}}', pose: 'wave',
  body:
    p("I'm Tali, your AI inside Tali HQ. I remember what you tell me, so I get more useful the longer we work together, for your life and your work.") +
    p('Three good things to do first:') +
    step(1, 'Tell me about you', "Who's in your life, what you do, what you're working towards. Messy is fine.") +
    step(2, 'Ask me anything', "A decision you're stuck on, a message you need written, a plan for the week.") +
    step(3, 'Look at my brain', "It shows what I've kept about you. You can make me forget anything, any time.") +
    button('Open Tali HQ', '{{app_url}}') +
    p('You have 7 days of Tali HQ to try everything. After that you can stay on Free or pick a plan.', { muted: true, small: true }) +
    p("Stuck on anything? Ask me in the app and I'll walk you through it.{{reply_line}}", { muted: true, small: true }) +
    sign,
  footnote: "You're getting this once because you just joined Tali HQ.",
});
const welcomeText = `{{title_text}}

I'm Tali, your AI inside Tali HQ. I remember what you tell me, so I get more useful the longer we work together, for your life and your work.

Three good things to do first:

1. Tell me about you
Who's in your life, what you do, what you're working towards. Messy is fine.

2. Ask me anything
A decision you're stuck on, a message you need written, a plan for the week.

3. Look at my brain
It shows what I've kept about you. You can make me forget anything, any time.

Open Tali HQ: {{app_url}}

You have 7 days of Tali HQ to try everything. After that you can stay on Free or pick a plan.

Stuck on anything? Ask me in the app and I'll walk you through it.{{reply_line_text}}

Tali

You're getting this once because you just joined Tali HQ.
Sent by Tali HQ, made in Australia. Totality 360 Pty Ltd, ABN 58 698 902 975
`;

// A filled in copy to look at in a browser.
writeFileSync('welcome.html', welcomeHtml.replace('{{title}}', 'Good to meet you, Sam').replaceAll('{{app_url}}', 'https://talihq.com.au').replace('{{reply_line}}', ' Or just reply to this email.'));

// ---------- the day 3 email (sent once by the tali-welcome function, kind "day3") ----------
// Tokens the function fills in: {{title}}, {{intro}} (both already escaped), {{memories}} (zero to
// four DAY3_ROW blocks, each with its {{text}} escaped) and {{app_url}}.
const day3Row = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 10px;"><tr>
<td width="22" valign="top" style="padding-top:7px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="8" height="8" bgcolor="${C.violet}" style="width:8px;height:8px;border-radius:4px;background:${C.violet};font-size:0;line-height:0;">&nbsp;</td></tr></table></td>
<td valign="top" style="font-family:${SANS};font-size:15px;line-height:1.5;color:${C.text};">{{text}}</td>
</tr></table>`;
const day3Html = layout({
  preheader: 'A few things I have kept, and how to make me forget any of them.', eyebrow: 'Day three', title: '{{title}}', pose: 'clipboard',
  body:
    p('{{intro}}') +
    '{{memories}}' +
    p('You can see every one of them in my brain, and make me forget any of them.') +
    p("The more you tell me, the more I can help with. Today's a good day to tell me about one thing you've been putting off.") +
    button('Open Tali HQ', '{{app_url}}') +
    sign,
  footnote: "You're getting this once, three days after joining Tali HQ.",
});
const day3Text = `{{title_text}}

{{intro_text}}
{{memories_text}}
You can see every one of them in my brain, and make me forget any of them.

The more you tell me, the more I can help with. Today's a good day to tell me about one thing you've been putting off.

Open Tali HQ: {{app_url}}

Tali

You're getting this once, three days after joining Tali HQ.
Sent by Tali HQ, made in Australia. Totality 360 Pty Ltd, ABN 58 698 902 975
`;
// A filled in copy to look at in a browser.
writeFileSync('day3.html', day3Html
  .replace('{{title}}', 'Three days in, Sam')
  .replace('{{intro}}', "I've kept 14 things about you so far. Here are a few:")
  .replace('{{memories}}', ['Mum&#39;s birthday is 14 December. She loves orchids.', 'You do your best thinking before 10am.', 'You want to run a stall at the Saturday markets in February.', 'Jess looks after the Thursday orders.'].map((t) => day3Row.replace('{{text}}', t)).join(''))
  .replaceAll('{{app_url}}', 'https://talihq.com.au'));

const lit = (s) => '`' + s.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${') + '`';
writeFileSync('../functions/tali-welcome/template.ts',
  `// GENERATED by supabase/templates/build.mjs. Do not edit by hand: change build.mjs and run it again.\n` +
  `export const WELCOME_SUBJECT_NAMED = 'Hi {{first_name}}, I\\'m Tali';\n` +
  `export const WELCOME_SUBJECT = 'Hi, I\\'m Tali';\n` +
  `export const WELCOME_HTML = ${lit(welcomeHtml)};\n` +
  `export const WELCOME_TEXT = ${lit(welcomeText)};\n` +
  `export const DAY3_SUBJECT = 'What I\\'ve learned about you so far';\n` +
  `export const DAY3_HTML = ${lit(day3Html)};\n` +
  `export const DAY3_ROW = ${lit(day3Row)};\n` +
  `export const DAY3_TEXT = ${lit(day3Text)};\n`);
console.log('ok');
