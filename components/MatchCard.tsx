// Import wyłącznie typów (granica modułów).
import type { MatchOut, Score } from '../compute/types';
import { PlayerLink } from './RetroTable';

/** „2:1" albo „–:–" dla braku (spec, sekcja 4). */
export function fmtScore(s: Score | null): string {
  return s ? `${s.home}:${s.away}` : '–:–';
}

/** Mecz: wynik + rozwijana lista typów wszystkich uczestników z punktami.
 *  Natywny <details> zamiast 'use client' — to samo UX bez klientowego JS. */
export function MatchCard({ match }: { match: MatchOut }) {
  const preds = Object.entries(match.predictions).sort(
    ([aId, a], [bId, b]) => (b.points ?? -1) - (a.points ?? -1) || aId.localeCompare(bId, 'pl'),
  );
  return (
    <details className="match-card">
      <summary>
        <span className="match-no">{match.no}.</span>
        <span className="match-teams">{match.home} – {match.away}</span>
        <span className="match-score">{fmtScore(match.result)}</span>
      </summary>
      <p className="kickoff">{match.kickoff}</p>
      <div className="screen-body">
        <table className="retro-table">
          <thead>
            <tr><th>GRACZ</th><th className="num">TYP</th><th className="num">PKT</th></tr>
          </thead>
          <tbody>
            {preds.map(([id, p]) => (
              <tr key={id}>
                <td><PlayerLink id={id} /></td>
                <td className="num">{p.pick ? fmtScore(p.pick) : '—'}</td>
                <td className="pkt">{p.points ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
