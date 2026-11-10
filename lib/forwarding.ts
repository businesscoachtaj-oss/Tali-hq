// Gmail forwarding (10 Nov 2026, asked for by Taj). Reading Gmail directly needs a paid yearly
// security assessment from Google, so mail now reaches Tali by the owner switching on Gmail's own
// auto-forward to their Tali address. Replies still go out from their own Gmail (sending is a
// lighter permission). This reads where their set-up is up to, for the guide on the Email screen.
import { supabase } from '@/lib/supabase';

export type Forwarding = {
  address: string | null; // their Tali address, e.g. harbourlane@tali.totality360.com.au
  state: 'not_started' | 'code' | 'working';
  code: string | null; // Gmail's confirmation code, once its email has reached Tali
  confirm_url: string | null; // Gmail's own confirm link from that email
  gmail: string | null; // the Gmail address the code was for
  last_at: string | null; // when the latest forwarded email arrived
};

export async function myForwarding(): Promise<Forwarding | null> {
  const { data, error } = await supabase.rpc('my_gmail_forwarding');
  if (error || !data) return null;
  const d = data as any;
  return {
    address: d.address ?? null,
    state: d.state === 'working' ? 'working' : d.state === 'code' ? 'code' : 'not_started',
    code: d.code ?? null,
    confirm_url: d.confirm_url ?? null,
    gmail: d.gmail ?? null,
    last_at: d.last_at ?? null,
  };
}
