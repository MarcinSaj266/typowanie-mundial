import type { CardStats, PlayerCardInput, PlayerCardMatch, Score } from './types';
import { scoreMatchK1 } from './scoreMatch';
import { aggregatePuchar } from './aggregatePuchar';

const round1 = (v: number): number => Math.round(v * 10) / 10;
const pct = (v: number): number => Math.round(v * 100);

const SAFE = new Set(['1:0', '0:1', '1:1', '0:0']);
const keyOf = (s: Score): string => `${s.home}:${s.away}`;
/** Rezultat meczu z perspektywy gospodarza: 1 = wygrana, 0 = remis (X), -1 = porażka. */
const outcomeOf = (s: Score): number => (s.home > s.away ? 1 : s.home < s.away ? -1 : 0);

/** Punkty meczu dla gracza: 0 bez typu, inaczej scoreMatchK1. Zakłada result≠null. */
function matchPoints(mt: PlayerCardMatch): number {
  if (!mt.result) return 0;
  return mt.pick ? scoreMatchK1(mt.pick, mt.result) : 0;
}

/**
 * Czysta funkcja karty zawodnika: z typów gracza + wyników + miejsc w tabelach
 * liczy komplet statystyk karty (sekcja `cards` w results.json).
 * Hero (points/generalPos) podawane gotowe z tabeli ogólnej — evergreen; sekcje
 * WYNIKI/STYL GRY/PO TURZE 2 liczone z meczów fazy grupowej.
 */
export function playerCard(input: PlayerCardInput): CardStats {
  const played: PlayerCardMatch[] = [];
  for (const t of input.turns) for (const mt of t.matches) if (mt.result) played.push(mt);

  const n = played.length;
  let groupPoints = 0; // dorobek fazy grupowej (do ŚR. PKT/MECZ) — różny od hero totalPoints
  let count5 = 0;
  let hits = 0;
  let brave = 0;
  let withPick = 0;
  let goalsSum = 0;
  let best = 0;
  let cur = 0;
  let drawsTyped = 0;
  let drawsHit = 0;
  const hitPts: number[] = [];
  let crowdSum = 0;
  let crowdMatches = 0;
  const freq = new Map<string, number>();

  for (const mt of played) {
    const p = matchPoints(mt);
    groupPoints += p;
    if (p > 0) {
      hits += 1;
      cur += 1;
      best = Math.max(best, cur);
      hitPts.push(p);
    } else {
      cur = 0;
    }
    if (p === 5) count5 += 1;

    if (mt.pick) {
      withPick += 1;
      const k = keyOf(mt.pick);
      if (!SAFE.has(k)) brave += 1;
      goalsSum += mt.pick.home + mt.pick.away;
      freq.set(k, (freq.get(k) ?? 0) + 1);
      if (mt.pick.home === mt.pick.away) {
        drawsTyped += 1;
        if (mt.result!.home === mt.result!.away) drawsHit += 1;
      }
      const others = mt.allPicks.filter((q): q is Score => q != null);
      if (others.length > 0) {
        // Zgodność po REZULTACIE (1/X/2), nie po dokładnym wyniku — dokładne wyniki się
        // rozdrabniają (każdy „indywidualistą"), rezultat różnicuje stawkę sensownie.
        const myOut = outcomeOf(mt.pick);
        const same = others.filter((q) => outcomeOf(q) === myOut).length;
        crowdSum += same / others.length;
        crowdMatches += 1;
      }
    }
  }

  // Ulubiony wynik: max częstość → niższa suma bramek → alfabetycznie (deterministycznie).
  let ulubionyWynik = '—';
  if (freq.size > 0) {
    ulubionyWynik = [...freq.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const sa = a[0].split(':').reduce((acc, x) => acc + Number(x), 0);
      const sb = b[0].split(':').reduce((acc, x) => acc + Number(x), 0);
      if (sa !== sb) return sa - sb;
      return a[0].localeCompare(b[0]);
    })[0][0];
  }

  const zgodnoscPct = crowdMatches > 0 ? pct(crowdSum / crowdMatches) : 0;
  // Progi dobrane do realnego pasma zgody na rezultat (~55–78%) — patrz spec §9.
  const osobowosc: CardStats['osobowosc'] =
    zgodnoscPct < 65 ? 'INDYWIDUALISTA' : zgodnoscPct > 73 ? 'OWCZY PĘD' : 'NEUTRALNY';

  // PO TURZE 2: dorobek per tura, licząc tylko tury KOMPLETNE (wszystkie mecze
  // rozegrane). Sekcja ma sens dopiero po zamknięciu tury — w trakcie tury (część
  // meczów bez wyniku) forma porównywałaby pełną turę z jej ułamkiem (fałszywy trend).
  const turnPoints = input.turns
    .filter((t) => t.matches.length > 0 && t.matches.every((mt) => mt.result))
    .map((t) => ({
      turn: t.turn,
      points: t.matches.reduce((acc, mt) => acc + matchPoints(mt), 0),
    }));

  // FAZA PUCHAROWA: osobny blok (×2: 6/8/10/12), nie miesza się ze statystykami grupowymi.
  const pAgg = aggregatePuchar(input.puchar ?? []);
  const puchHits = pAgg.count6 + pAgg.count8 + pAgg.count10 + pAgg.count12;
  const puchAktywne = pAgg.played > 0;
  const puchCelnoscPct = puchAktywne ? pct(puchHits / pAgg.played) : 0;
  const puchDokladne = pAgg.count10 + pAgg.count12; // dokładny wynik (nie-remis i remis+karne)

  const poTurze2Aktywne = turnPoints.length >= 2;
  let forma: CardStats['forma'] = null;
  let najlepszaTura: CardStats['najlepszaTura'] = null;
  if (poTurze2Aktywne) {
    const last = turnPoints[turnPoints.length - 1].points;
    const prev = turnPoints[turnPoints.length - 2].points;
    forma = last > prev ? 'UP' : last < prev ? 'DOWN' : 'FLAT';
    // Najlepsza tura: największy dorobek; przy remisie wcześniejsza (porządek wejścia).
    najlepszaTura = turnPoints.reduce((bestT, t) => (t.points > bestT.points ? t : bestT));
  }

  return {
    group: input.group,
    generalPos: input.generalPos,
    points: input.totalPoints,
    groupPos: input.groupPos,
    celnoscPct: n > 0 ? pct(hits / n) : 0,
    dokladne: count5,
    srPktMecz: n > 0 ? round1(groupPoints / n) : 0,
    odwagaPct: withPick > 0 ? pct(brave / withPick) : 0,
    nosRemisowPct: drawsTyped > 0 ? pct(drawsHit / drawsTyped) : 0,
    nosRemisowNd: drawsTyped === 0,
    seria: best,
    ofensywa: withPick > 0 ? round1(goalsSum / withPick) : 0,
    pewniak: hitPts.length > 0 ? round1(hitPts.reduce((a, b) => a + b, 0) / hitPts.length) : 0,
    pewniakNd: hitPts.length === 0,
    ulubionyWynik,
    zgodnoscPct,
    osobowosc,
    forma,
    najlepszaTura,
    poTurze2Aktywne,
    puchPunkty: pAgg.puch,
    puchCelnoscPct,
    puchDokladne,
    puchAktywne,
  };
}
