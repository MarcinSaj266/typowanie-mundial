import { MatchCard } from '../../components/MatchCard';
import { ScreenFrame } from '../../components/ScreenFrame';
import { loadResults } from '../lib/results';

export default function MeczePage() {
  const { turns } = loadResults();
  return (
    <ScreenFrame title="MECZE">
      {turns.map((t) => (
        <section key={t.turn}>
          <h2 className="turn-heading">★ TURA {t.turn} ★</h2>
          {t.matches.map((m) => <MatchCard key={m.no} match={m} />)}
        </section>
      ))}
    </ScreenFrame>
  );
}
