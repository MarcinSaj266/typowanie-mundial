import { MatchCard } from '../../components/MatchCard';
import { ScreenFrame } from '../../components/ScreenFrame';
import { loadResults } from '../lib/results';

export default function MeczePage() {
  const { turns } = loadResults();
  // Najnowsza tura na wierzchu (malejąco) — bieżąca tura od razu widoczna.
  const ordered = [...turns].sort((a, b) => b.turn - a.turn);
  return (
    <ScreenFrame title="MECZE">
      {ordered.map((t, idx) => (
        // Każda tura zwijana; najnowsza (idx 0) otwarta, starsze dostępne po kliknięciu.
        <details key={t.turn} className="turn-section" open={idx === 0}>
          <summary className="turn-heading">★ TURA {t.turn} ★</summary>
          {t.matches.map((m) => <MatchCard key={m.no} match={m} />)}
        </details>
      ))}
    </ScreenFrame>
  );
}
