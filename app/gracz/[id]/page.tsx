import { notFound } from 'next/navigation';
import { fmtScore } from '../../../components/MatchCard';
import { fmtPuchScore, fmtPick } from '../../../components/PucharMatchCard';
import { ScreenFrame } from '../../../components/ScreenFrame';
import { loadResults } from '../../lib/results';

export function generateStaticParams() {
  return loadResults().general.map((r) => ({ id: r.participantId }));
}

export default async function GraczPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const data = loadResults();
  const row = data.general.find((r) => r.participantId === id);
  if (!row) notFound();
  const groupRow = data.groups[row.group].find((r) => r.participantId === id)!;

  return (
    <ScreenFrame title={id.toUpperCase()}>
      <a className="card-cta" href={`/gracz/${encodeURIComponent(id)}/karta/`}>★ KARTA ZAWODNIKA →</a>
      <div className="player-summary">
        <div><span className="label">PUNKTY</span><span className="stat">{row.points}</span></div>
        <div><span className="label">TABELA OGÓLNA</span><span className="stat">{row.position}. / {data.general.length}</span></div>
        <div>
          <span className="label">GRUPA {row.group}</span>
          <span className="stat">{groupRow.position}. / {data.groups[row.group].length}</span>
        </div>
        <div><span className="label">SKUTECZNOŚĆ</span><span className="stat">{Math.round(row.hitRate * 100)}%</span></div>
      </div>
      {data.turns.map((t) => (
        <section key={t.turn}>
          <h2 className="turn-heading">★ TURA {t.turn} ★</h2>
          <table className="retro-table">
            <thead>
              <tr>
                <th className="num">#</th><th>MECZ</th>
                <th className="num">WYNIK</th><th className="num">TYP</th><th className="num">PKT</th>
              </tr>
            </thead>
            <tbody>
              {t.matches.map((m) => {
                const p = m.predictions[id];
                return (
                  <tr key={m.no}>
                    <td className="num">{m.no}</td>
                    <td>{m.home} – {m.away}</td>
                    <td className="num">{fmtScore(m.result)}</td>
                    <td className="num">{p.pick ? fmtScore(p.pick) : '—'}</td>
                    <td className="pkt">{p.points ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
      {data.puchar.rounds.map((round) => (
        <section key={round.round}>
          <h2 className="turn-heading">★ PUCHAR {round.round} ★</h2>
          <table className="retro-table">
            <thead>
              <tr>
                <th className="num">#</th><th>MECZ</th>
                <th className="num">WYNIK</th><th className="num">TYP</th><th className="num">PKT</th>
              </tr>
            </thead>
            <tbody>
              {round.matches.map((m) => {
                const p = m.predictions[id];
                return (
                  <tr key={m.no}>
                    <td className="num">{m.no}</td>
                    <td>{m.home} – {m.away}</td>
                    <td className="num">{fmtPuchScore(m.result)}</td>
                    <td className="num">{p.pick ? fmtPick(p.pick) : '—'}</td>
                    <td className="pkt">{p.points ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </ScreenFrame>
  );
}
