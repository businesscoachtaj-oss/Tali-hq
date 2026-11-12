// 12 Nov 2026 (Taj): the public website, talihq.com.au/site/<name>. No sign in.
// The page itself is components/PublicSiteView.tsx, which an owner's own domain shows too.
import { useLocalSearchParams } from 'expo-router';
import { PublicSiteView } from '@/components/PublicSiteView';

export default function Site() {
  const { slug: raw } = useLocalSearchParams<{ slug?: string }>();
  return <PublicSiteView slug={String(Array.isArray(raw) ? raw[0] : raw ?? '')} />;
}
