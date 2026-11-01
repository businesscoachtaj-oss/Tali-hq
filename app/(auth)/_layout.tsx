import { Stack } from 'expo-router';
import { colours } from '@/constants/theme';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colours.bg } }} />;
}
