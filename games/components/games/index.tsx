// Which component plays which game, with today's puzzle for each level (25 Nov 2026).
// 28 Nov 2026: inside Learnéd, grown-up games only (no kids' games, Pairs, Habits or Wind Down).
import WordGame from './WordGame';
import Four from './Four';
import Trail from './Trail';
import Keys from './Keys';
import Recall from './Recall';
import Sums from './Sums';
import StopGo from './StopGo';
import Spot from './Spot';
import Focus from './Focus';
import Choice from './Choice';
import Mirror from './Mirror';
import Breathe from './Breathe';
import type { Finish } from '../game';
import { pickDaily, dayNumber, isDemo, localDate, q } from '../../lib/daily';
import { ANSWERS, ANSWERS6, isWord } from '../../lib/words';
import { makeFour, makeTrail } from '../../lib/banks';
import { P } from '../../lib/levels';
import type { Kind, Level } from '../../lib/store';

/** ?date=2026-11-20 plays that day's puzzle (the archive). */
export const playDate = () => { const d = q('date'); return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= localDate() ? d : localDate(); };
export const todaysWord = (level: Level, date = playDate()) => (P.six[level].len === 6 ? pickDaily(ANSWERS6, 5, date) : pickDaily(ANSWERS, 1, date));

export function PlayGame({ id, kind, finish, level }: { id: string; kind: Kind; finish: Finish; level: Level }) {
  const demo = isDemo(); const gentle = kind === 'gentle'; const kids = kind === 'kids'; const date = playDate();
  switch (id) {
    case 'six': { const c = P.six[level]; return <WordGame answer={todaysWord(level, date)} valid={isWord} finish={finish} tries={c.tries} hint={c.hint} strict={c.strict} start={demo ? (c.len === 6 ? ['GARDEN', 'STORMY'] : ['CRANE', 'STORM']) : []} typed={demo ? 'SP' : ''} />; }
    case 'four': { const set = makeFour(level, date); return <Four set={set} finish={finish} gentle={gentle} slipsMax={P.four[level].slips} start={demo ? { found: [0], sel: [set[1].words[0], set[set.length - 1].words[2]], slips: 1 } : undefined} />; }
    case 'trail': { const t = makeTrail(level, date); return <Trail theme={t.theme} words={t.words} cols={t.cols} rows={t.rows} firstLetters={P.trail[level].firstLetters} seed={dayNumber(date) * 13 + 7 + t.cols} finish={finish} startFound={demo ? t.words.slice(0, 3) : []} />; }
    case 'keys': return <Keys finish={finish} demo={demo} level={level} />;
    case 'recall': { const c = P.recall[level]; return <Recall finish={finish} demo={demo} size={c.size} startLen={c.start} ms={c.ms} />; }
    case 'sums': return <Sums finish={finish} demo={demo} cfg={P.sums[level]} />;
    case 'stop': return <StopGo finish={finish} demo={demo} cfg={P.stop[level]} />;
    case 'spot': return <Spot finish={finish} demo={demo} cfg={P.spot[level]} />;
    case 'focus': return <Focus finish={finish} demo={demo} cfg={P.focus[level]} />;
    case 'room': return <Choice finish={finish} demo={demo} options={P.room[level].options} />;
    case 'mirror': return <Mirror finish={finish} demo={demo} cfg={P.mirror[level]} />;
    case 'breathe': return <Breathe finish={finish} kids={kids} demo={demo} cfg={P.breathe[level]} />;
    default: return null;
  }
}
