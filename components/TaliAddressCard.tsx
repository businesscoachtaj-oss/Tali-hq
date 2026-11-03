// Tali's own email address in Settings, Connections (3 Nov 2026). Pro only. Before this the
// only way to get the address was the bottom of Me, Email, which Taj could not find.
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { claimInbox, myCredits, myInbox, type Credits } from '@/lib/data';
import { isPro } from '@/lib/plan';
import { INBOUND_DOMAIN } from '@/constants/business';
import { Button, Card, ErrorText } from '@/components/ui';
import { colours, space } from '@/constants/theme';

export function TaliAddressCard() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [alias, setAlias] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      myCredits()
        .then(async (c) => {
          setCredits(c);
          if (isPro(c)) setAlias(await myInbox().catch(() => null));
        })
        .catch(() => setCredits(null));
    }, []),
  );

  if (!credits) return null;
  const pro = isPro(credits);

  async function claim() {
    setBusy(true);
    setError('');
    try {
      setAlias(await claimInbox());
    } catch (e: any) {
      setError(e?.message ?? 'Could not set up your address.');
    }
    setBusy(false);
  }

  return (
    <Card>
      <Text style={{ fontWeight: '800', color: colours.text, fontSize: 16 }}>Tali's own email address</Text>
      {!pro ? (
        <>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            On Pro, Tali gets her own address for enquiries. She sums up each one and drafts a reply for your yes.
          </Text>
          <Button title="See plans" kind="ghost" onPress={() => router.navigate('/plans')} />
        </>
      ) : alias ? (
        <>
          <Text selectable style={{ fontSize: 16, fontWeight: '800', color: colours.purpleInk, marginTop: space.sm }}>{`${alias}@${INBOUND_DOMAIN}`}</Text>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>Put it on your website or contact form. Enquiries land in Email.</Text>
          <Button title="Open Email" kind="ghost" onPress={() => router.navigate('/inbox')} />
        </>
      ) : (
        <>
          <Text style={{ color: colours.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
            I'll make one from your business name. Put it on your website and I'll sum up each enquiry and draft a reply.
          </Text>
          <Button title="Get my address" onPress={claim} busy={busy} />
          {error ? <ErrorText>{error}</ErrorText> : null}
        </>
      )}
    </Card>
  );
}
