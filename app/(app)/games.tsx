// Every brain game in Learnéd (28 Nov 2026). Today's four are free every day, Breathe is free any time,
// and a plan opens the rest, every level and the archive.
import { Text } from 'react-native';
import { Screen, goBack } from '@/components/ui';
import { MoreGames, PHeader, SectionHead, TodaysGames } from '@/components/Learned';
import { colours } from '@/constants/theme';

export default function Games() {
  return (
    <Screen>
      <PHeader kick="TRAIN YOUR BRAIN" title="Brain games" sub="A new puzzle every day, the same one for everyone. Each game works a different part of your brain." onBack={() => goBack('/learn')} backLabel="Learn" />
      <SectionHead>TODAY'S GAMES</SectionHead>
      <TodaysGames />
      <SectionHead>MORE GAMES</SectionHead>
      <MoreGames />
      <Text style={{ color: colours.faint, fontSize: 12.5, lineHeight: 18, marginTop: 16, marginBottom: 32 }}>
        Games are for fun and a sharper day. They are not a medical test or treatment.
      </Text>
    </Screen>
  );
}
