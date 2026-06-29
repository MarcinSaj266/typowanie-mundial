import { PucharMatchCard } from '../../components/PucharMatchCard';
import { ScreenFrame } from '../../components/ScreenFrame';
import { loadResults } from '../lib/results';

export default function PucharPage() {
  const { puchar } = loadResults();
  return (
    <ScreenFrame title="FAZA PUCHAROWA">
      {puchar.rounds.length === 0 ? (
        <p className="screen-body">Typy pucharowe pojawią się po starcie 1/16 finału.</p>
      ) : (
        puchar.rounds.map((round, idx) => (
          <details key={round.round} className="turn-section" open={idx === puchar.rounds.length - 1}>
            <summary className="turn-heading">★ {round.round} ★</summary>
            {round.matches.map((m) => <PucharMatchCard key={m.no} match={m} />)}
          </details>
        ))
      )}
    </ScreenFrame>
  );
}
