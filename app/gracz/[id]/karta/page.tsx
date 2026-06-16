import path from 'node:path';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { pngSize } from '../../../lib/pngSize';
import { loadResults } from '../../../lib/results';

export function generateStaticParams() {
  return loadResults().general.map((r) => ({ id: r.participantId }));
}

function cardUrl(id: string): string {
  return `/karty/${encodeURIComponent(id)}.png`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const img = cardUrl(id);
  const { width, height } = pngSize(path.join(process.cwd(), 'public', 'karty', `${id}.png`));
  return {
    title: `${id} — karta zawodnika · Typowanie Mundial 2026`,
    openGraph: { title: `${id} — karta zawodnika`, images: [{ url: img, width, height }] },
    twitter: { card: 'summary_large_image', images: [img] },
  };
}

export default async function KartaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const data = loadResults();
  const row = data.general.find((r) => r.participantId === id);
  if (!row) notFound();
  const c = data.cards[id];
  const img = cardUrl(id);

  const pct = (v: number) => `${Math.round(v)}%`;
  const one = (v: number) => v.toFixed(1);

  return (
    <ScreenFrame title={`${id.toUpperCase()} — KARTA`}>
      <div className="card-wrap">
        {/* PNG = jedyne źródło wyglądu karty (to-co-widzisz = to-co-udostępniasz). */}
        <img className="player-card-img" src={img} width={720} alt={`Karta zawodnika ${id}`} />
        <a className="card-download" href={img} download={`karta-${id}.png`}>
          POBIERZ KARTĘ (PNG)
        </a>
        <a className="card-download" href={`/gracz/${encodeURIComponent(id)}/`}>← POWRÓT DO PROFILU</a>
      </div>

      {/* Te same liczby jako dostępny tekst (a11y/SEO). */}
      <section className="card-stats" aria-label="Statystyki karty">
        <h2 className="turn-heading">★ STATYSTYKI ★</h2>
        <table className="retro-table">
          <tbody>
            <tr><td>MIEJSCE OGÓLNE</td><td className="num">{c.generalPos}. / {data.general.length}</td></tr>
            <tr><td>PUNKTY (RAZEM)</td><td className="num">{c.points}</td></tr>
            <tr><td>MIEJSCE W GRUPIE {row.group}</td><td className="num">{c.groupPos}. / {data.groups[row.group].length}</td></tr>
            <tr><td>CELNOŚĆ</td><td className="num">{pct(c.celnoscPct)}</td></tr>
            <tr><td>DOKŁADNE WYNIKI</td><td className="num">{c.dokladne}</td></tr>
            <tr><td>ŚR. PKT / MECZ</td><td className="num">{one(c.srPktMecz)}</td></tr>
            <tr><td>ODWAGA</td><td className="num">{pct(c.odwagaPct)}</td></tr>
            <tr><td>NOS DO REMISÓW</td><td className="num">{c.nosRemisowNd ? '—' : pct(c.nosRemisowPct)}</td></tr>
            <tr><td>NAJDŁUŻSZA SERIA</td><td className="num">{c.seria}</td></tr>
            <tr><td>OFENSYWA</td><td className="num">{one(c.ofensywa)}</td></tr>
            <tr><td>PEWNIAK</td><td className="num">{c.pewniakNd ? '—' : one(c.pewniak)}</td></tr>
            <tr><td>ULUBIONY WYNIK</td><td className="num">{c.ulubionyWynik}</td></tr>
            <tr><td>ZGODNOŚĆ Z TŁUMEM</td><td className="num">{pct(c.zgodnoscPct)} · {c.osobowosc}</td></tr>
          </tbody>
        </table>
      </section>

      {/* Legenda: jak liczymy każdy atrybut (wszystko z typów i wyników). */}
      <section className="card-legend" aria-label="Legenda atrybutów">
        <h2 className="turn-heading">★ JAK TO LICZYMY ★</h2>
        <dl>
          <dt>DOKŁADNE WYNIKI</dt><dd>Ile razy trafiłeś-aś wynik co do gola.</dd>
          <dt>ŚR. PKT / MECZ</dt><dd>Średni dorobek na rozegrany mecz fazy grupowej.</dd>
          <dt>ODWAGA</dt><dd>% Twoich typów spoza „bezpiecznych" wyników (1:0, 0:1, 1:1, 0:0). Im wyżej, tym śmielej typujesz.</dd>
          <dt>NOS DO REMISÓW</dt><dd>Z wytypowanych remisów ile trafiłeś-aś (%). Brak typowanych remisów → „—".</dd>
          <dt>NAJDŁUŻSZA SERIA</dt><dd>Najdłuższy ciąg trafień pod rząd (w kolejności meczów).</dd>
          <dt>OFENSYWA</dt><dd>Średnia liczba goli w Twoich typach (gospodarze + goście).</dd>
          <dt>PEWNIAK</dt><dd>Średnia punktów liczona tylko z meczów, które trafiłeś-aś. Brak trafień → „—".</dd>
          <dt>ULUBIONY WYNIK</dt><dd>Najczęściej typowany przez Ciebie wynik.</dd>
          <dt>ZGODNOŚĆ Z TŁUMEM</dt><dd>Średni % graczy, którzy obstawili ten sam wynik meczu co Ty (gospodarz wygra / remis / gość wygra). Daje plakietkę: poniżej 65% — INDYWIDUALISTA, powyżej 73% — OWCZY PĘD, pomiędzy — NEUTRALNY.</dd>
          <dt>FORMA</dt><dd>Trend: czy ostatnia tura z wynikami była lepsza, gorsza czy równa poprzedniej. Aktywne po 2 turach.</dd>
          <dt>NAJLEPSZA TURA</dt><dd>Tura z najwyższym dorobkiem. Aktywne po 2 turach.</dd>
        </dl>
      </section>
    </ScreenFrame>
  );
}
