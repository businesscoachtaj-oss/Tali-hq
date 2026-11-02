// Push to every device a user has: Expo tokens (phone builds) and web push subscriptions (the PWA).
// Added 2 Nov 2026. The VAPID key pair lives in public.web_push_keys (server only); it is generated
// here the first time it is needed, so no secret has to be pasted anywhere.
//
// Web push is sent with jsr:@negrel/webpush (RFC 8291 encryption and RFC 8292 VAPID, WebCrypto only).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';
import * as webpush from 'jsr:@negrel/webpush@0.5.0';

const CONTACT = 'mailto:tali@totality360.com.au';
let appServer: webpush.ApplicationServer | null = null;

async function server(admin: SupabaseClient) {
  if (appServer) return appServer;
  const { data } = await admin.from('web_push_keys').select('public_key_jwk, private_key_jwk').eq('id', 1).maybeSingle();
  let keys: CryptoKeyPair;
  if (data) {
    keys = await webpush.importVapidKeys({ publicKey: data.public_key_jwk, privateKey: data.private_key_jwk }, { extractable: false });
  } else {
    keys = await webpush.generateVapidKeys({ extractable: true });
    const exported = await webpush.exportVapidKeys(keys);
    const publicKey = await webpush.exportApplicationServerKey(keys);
    const { error } = await admin.from('web_push_keys').insert({ id: 1, public_key: publicKey, public_key_jwk: exported.publicKey, private_key_jwk: exported.privateKey });
    if (error) {
      // Another instance got there first: use theirs.
      const { data: again } = await admin.from('web_push_keys').select('public_key_jwk, private_key_jwk').eq('id', 1).single();
      keys = await webpush.importVapidKeys({ publicKey: again!.public_key_jwk, privateKey: again!.private_key_jwk }, { extractable: false });
    }
  }
  appServer = await webpush.ApplicationServer.new({ contactInformation: CONTACT, vapidKeys: keys });
  return appServer;
}

export type PushMessage = { title: string; body: string; url?: string };

// Sends to all of this user's devices. Never throws; dead web subscriptions are removed.
export async function pushUser(admin: SupabaseClient, userId: string, msg: PushMessage): Promise<{ expo: number; web: number }> {
  const { data: rows } = await admin.from('push_tokens').select('token, platform, subscription').eq('user_id', userId);
  const out = { expo: 0, web: 0 };
  if (!rows?.length) return out;
  const url = msg.url ?? '/';
  const body = msg.body.slice(0, 160);

  const expo = rows.filter((r) => r.platform !== 'web');
  if (expo.length) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(expo.map((t) => ({ to: t.token, title: msg.title, body, sound: 'default', data: { url } }))),
      });
      out.expo = expo.length;
    } catch (e) {
      console.warn('expo push failed', String(e));
    }
  }

  const web = rows.filter((r) => r.platform === 'web' && r.subscription);
  if (web.length) {
    let as: webpush.ApplicationServer;
    try {
      as = await server(admin);
    } catch (e) {
      console.error('web push keys failed', String(e));
      return out;
    }
    const payload = JSON.stringify({ title: msg.title, body, url });
    await Promise.all(
      web.map(async (t) => {
        try {
          await as.subscribe(t.subscription as webpush.PushSubscription).pushTextMessage(payload, { ttl: 24 * 3600, urgency: webpush.Urgency.Normal, topic: 'tali' });
          out.web++;
        } catch (e) {
          if (e instanceof webpush.PushMessageError && e.isGone()) {
            await admin.from('push_tokens').delete().eq('token', t.token);
          } else {
            console.warn('web push failed', String(e));
          }
        }
      }),
    );
  }
  return out;
}
