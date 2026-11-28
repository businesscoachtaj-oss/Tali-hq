// Songs for Keys (25 Nov 2026). All out of copyright (traditional, or composers who died long ago).
// Notes like E5, a "-" makes a note twice as long and a "." half as long. The four lanes go low to high,
// worked out from each song's own notes, so tiles move with the tune and you hear it as you play.
import type { Level } from './store';
export type Song = { name: string; by: string; notes: string };
export const SONGS: Record<Level, Song[]> = {
  easy: [
    { name: 'Twinkle, Twinkle, Little Star', by: 'Traditional', notes: 'C4 C4 G4 G4 A4 A4 G4- F4 F4 E4 E4 D4 D4 C4- G4 G4 F4 F4 E4 E4 D4- G4 G4 F4 F4 E4 E4 D4- C4 C4 G4 G4 A4 A4 G4- F4 F4 E4 E4 D4 D4 C4-' },
    { name: 'Mary Had a Little Lamb', by: 'Traditional', notes: 'E4 D4 C4 D4 E4 E4 E4- D4 D4 D4- E4 G4 G4- E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4-' },
    { name: 'Frère Jacques', by: 'Traditional', notes: 'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4- E4 F4 G4- G4. A4. G4. F4. E4 C4 G4. A4. G4. F4. E4 C4 C4 G3 C4- C4 G3 C4-' },
  ],
  medium: [
    { name: 'Ode to Joy', by: 'Beethoven', notes: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4. D4- E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4. C4-' },
    { name: 'Jingle Bells', by: 'James Lord Pierpont', notes: 'E4 E4 E4- E4 E4 E4- E4 G4 C4 D4 E4- F4 F4 F4 F4 F4 E4 E4 E4. E4. E4 D4 D4 E4 D4- G4- E4 E4 E4- E4 E4 E4- E4 G4 C4 D4 E4- F4 F4 F4 F4 F4 E4 E4 E4. E4. G4 G4 F4 D4 C4-' },
    { name: 'Row, Row, Row Your Boat', by: 'Traditional', notes: 'C4- C4- C4 D4 E4- E4 D4 E4 F4 G4-- C5. C5. C5. G4. G4. G4. E4. E4. E4. C4. C4. C4. G4 F4 E4 D4 C4--' },
  ],
  hard: [
    { name: 'Für Elise', by: 'Beethoven', notes: 'E5. D#5. E5. D#5. E5. B4. D5. C5. A4- C4. E4. A4. B4- E4. G#4. B4. C5- E4. E5. D#5. E5. D#5. E5. B4. D5. C5. A4- C4. E4. A4. B4- E4. C5. B4. A4-' },
    { name: 'In the Hall of the Mountain King', by: 'Grieg', notes: 'B3. C#4. D4. E4. F#4. D4. F#4- F4. C#4. F4- E4. C4. E4- B3. C#4. D4. E4. F#4. D4. F#4. B4. A4. F#4. D4. F#4. A4--' },
    { name: 'Ode to Joy, quick', by: 'Beethoven', notes: 'E4. E4. F4. G4. G4. F4. E4. D4. C4. C4. D4. E4. E4 D4. D4 E4. E4. F4. G4. G4. F4. E4. D4. C4. C4. D4. E4. D4 C4. C4' },
  ],
};
/** A song as tiles: lane 0 to 3 from low to high, and length in beats. */
export function tilesOf(song: Song) {
  const notes = song.notes.split(' ').map(t => { const m = t.match(/^([A-G]#?\d)([-.]*)$/)!; const beats = m[2] === '-' ? 2 : m[2] === '--' ? 4 : m[2] === '.' ? 0.5 : 1; return { note: m[1], beats }; });
  const order = (n: string) => { const i = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(n.replace(/\d/, '')); return Number(n.slice(-1)) * 12 + i; };
  const pitches = [...new Set(notes.map(n => order(n.note)))].sort((a, b) => a - b);
  return notes.map(n => ({ ...n, lane: Math.min(3, Math.floor((pitches.indexOf(order(n.note)) / pitches.length) * 4)) }));
}
