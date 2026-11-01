import { Text, View } from 'react-native';
import type { Health } from '@/lib/data';
import { Card } from '@/components/ui';
import { colours, space } from '@/constants/theme';

const DOT: Record<string, string> = { green: colours.good, amber: colours.orange, red: colours.danger };
const HEADLINE: Record<string, string> = {
  green: 'All good. Nothing needs you right now.',
  amber: 'A few things worth a look.',
  red: 'Something needs you today.',
};

// Business health: overdue invoices, follow-ups, quiet clients, waiting drafts and reminders.
// Worked out fresh from the database each time Today opens. Tali also checks twice a day and nudges.
export function HealthCard({ health }: { health: Health }) {
  return (
    <Card style={{ borderLeftWidth: 5, borderLeftColor: DOT[health.status] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: DOT[health.status] }} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: colours.text, flex: 1 }}>{HEADLINE[health.status]}</Text>
      </View>
      {health.items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.sm, marginTop: 8, alignItems: 'flex-start' }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: DOT[it.level], marginTop: 8 }} />
          <Text style={{ fontSize: 15, lineHeight: 22, color: colours.text, flex: 1 }}>{it.text}</Text>
        </View>
      ))}
    </Card>
  );
}
