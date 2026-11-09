import { useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colours, elevation, NO_BOTTOM, radius, space, heading, headingSemi } from '@/constants/theme';
import { TaliAvatar } from '@/components/TaliAvatar';
import { SKINS, SkinProvider, type SkinId } from '@/components/PageSkin';
import { NightBackground } from '@/components/NightSky';
import { Aurora } from '@/components/Aurora';

export const tali = {
  idle: require('@/assets/tali/tali_idle.png'),
  wave: require('@/assets/tali/tali_wave.png'),
  think: require('@/assets/tali/tali_think.png'),
  head: require('@/assets/tali/tali_head_idle.png'),
  celebrate: require('@/assets/tali/tali_celebrate.png'),
};

// 4 Nov 2026: optional pull to refresh (pass the screen's load) so every list screen can refresh, not just Today.
export function Screen({ children, scroll = true, onRefresh, bg, skin }: PropsWithChildren<{ scroll?: boolean; onRefresh?: () => Promise<unknown> | void; bg?: string; skin?: SkinId }>) {
  // 9 Nov 2026 look refresh: one page colour everywhere (was a tint per page).
  const [refreshing, setRefreshing] = useState(false);
  const body = <SkinProvider id={skin}><View style={styles.inner}>{children}</View></SkinProvider>;
  const refresh = onRefresh
    ? (
        <RefreshControl
          refreshing={refreshing}
          tintColor={colours.purple}
          onRefresh={async () => {
            setRefreshing(true);
            try { await onRefresh(); } finally { setRefreshing(false); }
          }}
        />
      )
    : undefined;
  return (
    <SafeAreaView style={[styles.safe, bg ? { backgroundColor: bg } : null]} edges={NO_BOTTOM}>
      <NightBackground style={StyleSheet.absoluteFill} />
      <Aurora />
      {scroll ? <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshControl={refresh}>{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

// 4 Nov 2026: back links used to be hard-coded, so Settings opened from Email went "back" to Me.
// Go back if there's history, otherwise to the fallback.
export function goBack(fallback: string) {
  if (router.canGoBack()) router.back();
  else router.navigate(fallback as any);
}

// Two-tap confirm for destructive actions: first tap arms ("Sure?"), second runs. Resets after 3 s.
export function useConfirm(ms = 3000) {
  const [armed, setArmed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirm = (key: string, run: () => void) => {
    if (armed === key) {
      setArmed(null);
      if (timer.current) clearTimeout(timer.current);
      run();
      return;
    }
    setArmed(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(null), ms);
  };
  return { armed, confirm };
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={styles.title}>{children}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Body({ children, muted }: PropsWithChildren<{ muted?: boolean }>) {
  return <Text style={[styles.body, muted && { color: colours.muted }]}>{children}</Text>;
}

export function Label({ children }: PropsWithChildren) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: space.md }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput placeholderTextColor={colours.faint} style={[styles.input, style]} {...rest} />
    </View>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  busy,
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  busy?: boolean;
  disabled?: boolean;
}) {
  const off = disabled || busy;
  const brand = colours.purple;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        kind === 'primary' && { backgroundColor: brand, borderColor: brand, ...elevation.button(brand) },
        kind === 'danger' && { borderColor: colours.danger, ...elevation.button(colours.danger) },
        off && { opacity: 0.55 },
        pressed && !off && { opacity: 0.85 },
      ]}>
      {busy ? (
        <ActivityIndicator color={kind === 'primary' ? colours.onPurple : colours.purple} />
      ) : (
        <Text
          style={[
            styles.btnText,
            kind === 'primary' && { color: colours.onPurple },
            kind === 'danger' && { color: colours.danger },
          ]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function BackLink({ onPress, label = 'Back' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={12} style={{ alignSelf: 'flex-start', paddingVertical: 6, marginBottom: space.sm }}>
      <Text style={{ color: colours.purple, fontWeight: '700', fontSize: 15 }}>{'\u2039'} {label}</Text>
    </Pressable>
  );
}

export function TaliSays({ children, pose = 'idle' }: PropsWithChildren<{ pose?: keyof typeof tali }>) {
  return (
    <View style={styles.says}>
      {/* 10 Nov 2026: her head in a glowing ring, the same as Today, instead of her full body. */}
      <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(185,166,255,0.18)', borderWidth: 1, borderColor: 'rgba(214,200,255,0.6)', shadowColor: '#B9A6FF', shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }}>
        <TaliAvatar pose="head" size={38} />
      </View>
      <View style={styles.bubble}>
        <Text style={styles.body}>{children}</Text>
      </View>
    </View>
  );
}

export function ErrorText({ children }: PropsWithChildren) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.bg }}>
      <ActivityIndicator color={colours.purple} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colours.bg },
  scroll: { flexGrow: 1 },
  inner: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center', padding: space.lg },
  title: { fontSize: 40, lineHeight: 44, color: colours.text, ...heading },
  sub: { fontSize: 15, color: colours.muted, marginTop: space.xs, lineHeight: 21 },
  card: {
    backgroundColor: colours.surface,
    borderColor: 'rgba(196,178,255,0.30)',
    borderTopColor: 'rgba(230,220,255,0.55)',
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.md,
    ...elevation.card,
  },
  body: { fontSize: 15, lineHeight: 22, color: colours.text },
  label: { fontSize: 24, color: colours.text, marginBottom: 10, marginTop: 10, ...headingSemi },
  input: {
    backgroundColor: colours.surface,
    borderColor: colours.borderStrong,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colours.text,
    ...elevation.lift,
  },
  btn: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colours.borderStrong,
    backgroundColor: colours.surface,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
    ...elevation.lift,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: colours.text },
  says: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.lg },
  saysImg: { width: 64, height: 120 },
  bubble: {
    flex: 1,
    backgroundColor: colours.purpleSoft,
    borderRadius: radius.card,
    borderBottomLeftRadius: 6,
    padding: space.md,
    borderWidth: 1,
    borderColor: 'rgba(108,52,131,0.08)',
    ...elevation.lift,
  },
  error: { color: colours.danger, fontSize: 14, marginTop: space.sm },
});

// A quiet empty-state line for a section, so Tali only speaks once per screen (3 Nov 2026).
export function Hint({ children }: PropsWithChildren) {
  return (
    <Card style={{ paddingVertical: space.md }}>
      <Text style={{ color: colours.muted, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </Card>
  );
}
