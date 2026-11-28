// A brain game inside Learnéd (28 Nov 2026, Taj: "merge our brain games into it"). One route for every
// game, /game?id=six. The games and their frame come from the brain games app (games/), in paper and ink.
import { Redirect, useLocalSearchParams } from 'expo-router';
import { GameShell } from '@/games/components/game';
import { PlayGame } from '@/games/components/games';
import { gameById } from '@/games/lib/games';

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id || !gameById(id)) return <Redirect href={'/games' as any} />;
  // key: a new game starts fresh when Next swaps the id.
  return (
    <GameShell key={id} id={id}>
      {(finish, level) => <PlayGame id={id} kind="everyone" finish={finish} level={level} />}
    </GameShell>
  );
}
