// Tali's own email address in Settings, Connections (3 Nov 2026). Pro only. Before this the
// only way to get the address was the bottom of Me, Email, which Taj could not find.
// 4 Nov 2026: the user picks the word before the @ (pre-filled from their business name).
import { useCallback, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { claimInbox, myCredits, myInbox, suggestInboxAlias, type Credits } from '@/lib/data';
import { isPro } from '@/lib/plan';
import { INBOUND_DOMAIN } from '@/constants/business';
import { Button, Card, ErrorText } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

// The alias box with the domain after it. Shared by Settings and the Email screen.
export function AliasPicker({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit?: () => void }) {
  return (
    <View style={{ marginTop: space.sm }}>
      <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 19, marginBottom: 6 }}>Pick the word before the @.</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24))}
          onSubmitEditing={onSubmit}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={24}
          placeholder="yourbusiness"
          placeholderTextColor={colours.faint}
          accessibilityLabel="The word before the @ in Tali's address"
          style={{ flex: 1, minWidth: 0, borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.input, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colours.text, backgroundColor: colours.surface }}
        />
        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colours.purpleInk, flexShrink: 1 }}>@{INBOUND_DOMAIN}</Text>
      </View>
    </View>
  );
}

// Loads the suggestion and claims the address. Shared state for both places it shows.
export function useAliasClaim(enabled: boolean, onClaimed: (alias: string) => void) {
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      suggestInboxAlias()
        .then((s) => setPick((cur) => cur || s))
        .catch(() => {});
    }, [enabled]),
  );

  async function claim() {
    setBusy(true);
    setError('');
    try {
      onClaimed(await claimInbox(pick));
    } catch (e: any) {
      setError(e?.message ?? 'Could not set up your address.');
    }
    setBusy(false);
  }

  return { pick, setPick, busy, error, claim };
}

export function TaliAddressCard() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [alias, setAlias] = useState<string | null>(null);
  const pro = !!credits && isPro(credits);
  const { pick, setPick, busy, error, claim } = useAliasClaim(pro && !alias, setAlias);

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
            Put it on your website and I'll sum up each enquiry and draft a reply.
          </Text>
          <AliasPicker value={pick} onChange={setPick} onSubmit={claim} />
          <Button title="Get my address" onPress={claim} busy={busy} />
          <ErrorText>{error}</ErrorText>
        </>
      )}
    </Card>
  );
}

// One quiet line under the business name in Settings (4 Nov 2026): the address does not follow a
// rename. Shows only for Pro users who already have an alias.
export function TaliAddressNote() {
  const [show, setShow] = useState(false);
  useFocusEffect(
    useCallback(() => {
      myCredits()
        .then(async (c) => setShow(isPro(c) && !!(await myInbox().catch(() => null))))
        .catch(() => setShow(false));
    }, []),
  );
  if (!show) return null;
  return <Text style={{ color: colours.muted, fontSize: 13, marginTop: -8, marginBottom: space.md }}>Tali's email address stays the same if you change this.</Text>;
}
