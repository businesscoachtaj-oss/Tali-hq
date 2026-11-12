// 12 Nov 2026 (Taj): your own domain. When the web app is opened on an address that is not Tali HQ's
// own, it looks up which published site that domain belongs to and shows it. Nobody signs in here.
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { slugForHost } from '@/lib/site';
import { PublicSiteView } from '@/components/PublicSiteView';
import { Loading } from '@/components/ui';
import { colours } from '@/constants/theme';

const OWN_HOSTS = ['talihq.com.au', 'www.talihq.com.au', 'localhost', '127.0.0.1'];

/** The address this page was opened on, when it is somebody's own domain. Null on Tali HQ's own addresses and in the phone apps. */
export function customHost(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location) return null;
  const h = String(window.location.hostname || '').toLowerCase();
  if (!h || OWN_HOSTS.includes(h) || h.endsWith('.talihq.com.au') || h.endsWith('.vercel.app') || h.endsWith('.local') || /^[0-9.:]+$/.test(h)) return null;
  // Booking and site links opened on the domain still go to their own screens.
  if (/^\/(book|site)\//.test(String(window.location.pathname || ''))) return null;
  return h;
}

export function DomainSite({ host }: { host: string }) {
  const [slug, setSlug] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    slugForHost(host).then((s) => { if (!cancelled) setSlug(s); }).catch(() => { if (!cancelled) setSlug(null); });
    return () => { cancelled = true; };
  }, [host]);
  if (slug === undefined) return <Loading />;
  if (!slug) {
    return (
      <View style={{ flex: 1, backgroundColor: colours.bg, padding: 24, justifyContent: 'center' }}>
        <Text style={{ color: colours.text, fontSize: 30, fontFamily: 'InstrumentSerif_400Regular' }}>Nothing here yet</Text>
        <Text style={{ color: colours.muted, fontSize: 15, marginTop: 8, lineHeight: 22 }}>This domain is not connected to a live site yet.</Text>
      </View>
    );
  }
  return <PublicSiteView slug={slug} />;
}
