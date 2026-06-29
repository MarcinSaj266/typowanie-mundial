// Import wyłącznie typów (granica modułów).
import type { PucharMatchOut, PucharPick } from '../compute/types';
import { PlayerLink } from './RetroTable';

/** "2:1 (k. gosp.)" — wynik pucharowy z dopiskiem o karnych przy remisie. */
function fmtPuchScore(s: { home: number; away: number; pk?: 'home' | 'away' } | null): string {
  if (!s) return '–:–';
  const base = `${s.home}:${s.away}`;
  if (s.home === s.away && s.pk) return `${base} (k. ${s.pk === 'home' ? 'gosp.' : 'gości'})`;
  return base;
}

/** Typ pucharowy gracza w komórce: "1:1 ✚gosp." gdy krzyżyk. */
function fmtPick(p: PucharPick | null): string {
  if (!p) return '—';
  const base = `${p.home}:${p.away}`;
  if (p.home === p.away && p.pk) return `${base} ✚${p.pk === 'home' ? 'gosp.' : 'gości'}`;
  return base;
}

/** Mecz pucharowy: wynik + rozwijana lista typów wszystkich uczestników z punktami.
 *  Natywny <details> — zero klientowego JS, jak MatchCard. */
export function PucharMatchCard({ match }: { match: PucharMatchOut }) {
  const preds = Object.entries(match.predictions).sort(
    ([aId, a], [bId, b]) => (b.points ?? -1) - (a.points ?? -1) || aId.localeCompare(bId, 'pl'),
  );
  return (
    <details className="match-card puch-match-card">
      <summary>
        <span className="match-teams">{match.home} – {match.away}</span>
        <span className="match-score">{fmtPuchScore(match.result)}</span>
      </summary>
      {match.kickoff ? <p className="kickoff">{match.kickoff}</p> : null}
      <div className="screen-body">
        <table className="retro-table">
          <thead>
            <tr><th>GRACZ</th><th className="num">TYP</th><th className="num">PKT</th></tr>
          </thead>
          <tbody>
            {preds.map(([id, p]) => (
              <tr key={id}>
                <td><PlayerLink id={id} /></td>
                <td className="num">{fmtPick(p.pick)}</td>
                <td className="pkt">{p.points ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
