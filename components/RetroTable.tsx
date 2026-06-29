import Link from 'next/link';
// Import wyłącznie typu (granica modułów: app zna tylko kształt JSON-a).
import type { TableRow } from '../compute/types';

/** Link do profilu gracza — używany we wszystkich widokach. */
export function PlayerLink({ id }: { id: string }) {
  return <Link href={`/gracz/${encodeURIComponent(id)}/`}>{id}</Link>;
}

/**
 * Tabela retro: wspólna dla tabeli ogólnej i tabel grup (spec, sekcja 2).
 * `showPuch` (tylko tabela OGÓLNA) dokłada kolumny „×6" (remis dokładny + karne)
 * i „PUCH" (punkty pucharowe) — zgodnie z tabelą organizatora po starcie 1/16.
 */
export function RetroTable({
  rows,
  showGroup = false,
  showPuch = false,
}: {
  rows: TableRow[];
  showGroup?: boolean;
  showPuch?: boolean;
}) {
  return (
    <table className="retro-table">
      <thead>
        <tr>
          <th className="num">#</th>
          <th>GRACZ</th>
          {showGroup && <th className="hide-mobile">GR</th>}
          <th className="num hide-mobile">I</th>
          <th className="num hide-mobile">II</th>
          <th className="num hide-mobile">III</th>
          <th className="num hide-mobile">×3</th>
          <th className="num hide-mobile">×4</th>
          <th className="num hide-mobile">×5</th>
          {showPuch && <th className="num hide-mobile">×6</th>}
          {showPuch && <th className="num hide-mobile">PUCH</th>}
          <th className="num">PKT</th>
          <th className="num">%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.participantId}>
            <td className="num">{r.position}</td>
            <td><PlayerLink id={r.participantId} /></td>
            {showGroup && <td className="hide-mobile">{r.group}</td>}
            <td className="num hide-mobile">{r.grI}</td>
            <td className="num hide-mobile">{r.grII}</td>
            <td className="num hide-mobile">{r.grIII}</td>
            <td className="num hide-mobile">{r.count3}</td>
            <td className="num hide-mobile">{r.count4}</td>
            <td className="num hide-mobile">{r.count5}</td>
            {showPuch && <td className="num hide-mobile">{r.count6 ?? 0}</td>}
            {showPuch && <td className="num hide-mobile">{r.puch}</td>}
            <td className="pkt">{r.points}</td>
            <td className="num">{Math.round(r.hitRate * 100)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
