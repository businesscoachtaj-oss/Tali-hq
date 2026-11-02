import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colours, elevation, NO_BOTTOM, radius, space } from '@/constants/theme';
import { TaliAvatar } from '@/components/TaliAvatar';

export const tali = {
  idle: require('@/assets/tali/tali_idle.png'),
  wave: require('@/assets/tali/tali_wave.png'),
  think: require('@/assets/tali/tali_think.png'),
  head: require('@/assets/tali/tali_head_idle.png'),
  celebrate: require('@/assets/tali/tali_celebrate.png'),
};

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const body = <View style={styles.inner}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={NO_BOTTOM}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  );
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
  return (
    <Pressable
      accessibilityRole="button"
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        kind === 'primary' && { backgroundColor: colours.purple, borderColor: colours.purple, ...elevation.button(colours.purple) },
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
      <TaliAvatar pose={pose} size={64} />
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
  title: { fontSize: 28, fontWeight: '800', color: colours.text },
  sub: { fontSize: 15, color: colours.muted, marginTop: space.xs, lineHeight: 21 },
  card: {
    backgroundColor: colours.surface,
    borderColor: 'rgba(39,38,38,0.04)',
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.md,
    ...elevation.card,
  },
  body: { fontSize: 15, lineHeight: 22, color: colours.text },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colours.muted, marginBottom: 6 },
  input: {
    backgroundColor: colours.surface,
    borderColor: colours.borderStrong,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colours.text,
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
  },
  btnText: { fontSize: 16, fontWeight: '700', color: colours.text },
  says: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginBottom: space.lg },
  saysImg: { width: 64, height: 120 },
  bubble: {
    flex: 1,
    backgroundColor: colours.purpleSoft,
    borderRadius: radius.card,
    borderBottomLeftRadius: 6,
    padding: space.md,
  },
  error: { color: colours.danger, fontSize: 14, marginTop: space.sm },
});
