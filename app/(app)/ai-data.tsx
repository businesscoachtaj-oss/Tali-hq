// app/(app)/ai-data.tsx (22 Nov 2026): "Tali and your data" from Me, to say yes later or turn it off.
// Also where any of Tali's functions send you when they answer 'ai_consent' (lib/supabase.ts).
import { BackLink, Screen, goBack } from '@/components/ui';
import { AiConsent } from '@/components/AiConsent';

export default function AiData() {
  return (
    <Screen>
      <BackLink onPress={() => goBack('/me')} />
      <AiConsent gate={false} onDone={() => goBack('/me')} />
    </Screen>
  );
}
