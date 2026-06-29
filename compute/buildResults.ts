import { aggregateTurn } from '../engine/aggregate';
import { groupBonus } from '../engine/bonus';
import { efficiencyBonus, type PhaseStanding } from '../engine/efficiencyBonus';
import { buildSeason } from '../engine/buildSeason';
import { generalTable } from '../engine/generalTable';
import { rankBy } from '../engine/ranking';
import { scoreMatchK1 } from '../engine/scoreMatch';
import { playerCard } from '../engine/playerCard';
import type { MatchEntry, TurnScore, CardStats, PlayerCardInput } from '../engine/types';
import { aggregatePuchar, scorePucharMatch, type PucharAgg } from '../engine/aggregatePuchar';
import type { PucharData, PucharOut, PucharResult } from './types';
import { ALL_GROUPS } from './types';
import type {
  Group,
  MatchOut,
  Participant,
  ResultsByTurn,
  ResultsJson,
  TableRow,
  TurnData,
  TurnOut,
} from './types';

/** Porządek tabeli grupowej: pkt → % → grIII → grII → grI (reguła organizatora, 2026-06-13:
 * późniejsza tura bije wcześniejszą). */
const GROUP_ORDER = ['points', 'hitRate', 'grIII', 'grII', 'grI'] as const;

/** Tura kompletna: wczytana i każdy jej mecz ma wynik. */
function turnComplete(turns: TurnData[], results: ResultsByTurn, n: number): boolean {
  const t = turns.find((turn) => turn.turn === n);
  return (
    !!t &&
    t.fixtures.length > 0 &&
    t.fixtures.every((f) => results[String(n)]?.[String(f.no)] != null)
  );
}

/** Komplet fazy grupowej: wszystkie 3 tury wczytane i każdy ich mecz ma wynik. */
function groupStageComplete(turns: TurnData[], results: ResultsByTurn): boolean {
  return [1, 2, 3].every((n) => turnComplete(turns, results, n));
}

/**
 * Korekta uzgadniająca produkcję z OPUBLIKOWANYMI tabelami organizatora (źródło prawdy).
 * Wojtek (gr. A) ma w turze 2 wg organizatora 50 pkt (łącznie po 48 meczach 3p=17, 4p=5, 5p=4),
 * a wg przysłanej „Baza tura 2" 52 — na jednym meczu master organizatora liczy trafiony rezultat
 * (3 pkt), a Baza dokładny wynik (5 pkt). Nasz ingest jest WIERNY Bazie (zweryfikowane: v1/v2/v3
 * = 52), więc korygujemy TU, zamieniając jeden mecz 5→3: −2 pkt, 5p−1, 3p+1. Trafienie zostaje
 * trafieniem, więc „%" się nie zmienia. To samo robi `viz/race/data.ts` (SCORE_CORRECTIONS).
 * Guard chroni przed ujemnymi licznikami, gdyby turę 2 liczono przed kompletem wyników.
 */
function applyOrganizerCorrections(id: string, ts: [TurnScore, TurnScore, TurnScore]): void {
  if (id === 'Wojtek' && ts[1].count5 >= 1 && ts[1].points >= 2) {
    const t2 = ts[1];
    ts[1] = { ...t2, points: t2.points - 2, count5: t2.count5 - 1, count3: t2.count3 + 1 };
  }
}

/**
 * Override kolejności tabeli grupowej pod OPUBLIKOWANE tabele organizatora (źródło prawdy).
 * Grupa F: MaciejM i KSZ remisują 152 pkt grupowych. Nasz tiebreaker („%" = hitRate) stawia
 * KSZ wyżej (63% vs 61%), ale organizator liczy „skuteczność" grupową inaczej — po masterze
 * 06.12 zmienił definicję „%" (jego tabela grupowa pokazuje MaciejM 42% > KSZ 40%, z liczb,
 * które nie sumują się do 152 pkt; nowego mastera z tą formułą nie mamy) i przyznaje MaciejM
 * 2. miejsce (bns 10), KSZ 3. (bns 5). Przypinamy tę kolejność i renumerujemy pozycje. Warunek
 * remisu punktów chroni przed nadpisaniem, gdyby dane się zmieniły. Por. applyOrganizerCorrections.
 */
function applyOrganizerGroupOrder(group: Group, rows: TableRow[]): TableRow[] {
  if (group !== 'F') return rows;
  const iM = rows.findIndex((r) => r.participantId === 'MaciejM');
  const iK = rows.findIndex((r) => r.participantId === 'KSZ');
  if (iM < 0 || iK < 0 || iM < iK || rows[iM].points !== rows[iK].points) return rows;
  const next = [...rows];
  const [maciej] = next.splice(iM, 1);
  next.splice(iK, 0, maciej);
  return next.map((r, i) => ({ ...r, position: i + 1 }));
}

/** Zlicza turę uczestnika: typ z tury + wynik z results; brak wyniku = nierozegrany. */
function scoreTurn(
  id: string,
  turn: TurnData | undefined,
  turnNo: number,
  results: ResultsByTurn,
): TurnScore {
  if (!turn) return aggregateTurn([]);
  const entries: MatchEntry[] = turn.fixtures.map((f) => ({
    prediction: turn.predictions[id]?.[String(f.no)] ?? null,
    result: results[String(turnNo)]?.[String(f.no)] ?? null,
  }));
  return aggregateTurn(entries);
}

/** Sekcja turns: szczegóły per mecz dla widoków „Mecze" i „Profil" (spec renderu, sekcja 1). */
function buildTurns(roster: Participant[], turns: TurnData[], results: ResultsByTurn): TurnOut[] {
  return [...turns]
    .sort((a, b) => a.turn - b.turn)
    .map((t) => ({
      turn: t.turn,
      matches: t.fixtures.map((f): MatchOut => {
        const result = results[String(t.turn)]?.[String(f.no)] ?? null;
        const predictions = Object.fromEntries(
          roster.map((p) => {
            const pick = t.predictions[p.id]?.[String(f.no)] ?? null;
            const points = pick && result ? scoreMatchK1(pick, result) : null;
            return [p.id, { pick, points }];
          }),
        );
        return { no: f.no, home: f.home, away: f.away, kickoff: f.kickoff, result, predictions };
      }),
    }));
}

/** Sekcja puchar: rundy → mecze → typy wszystkich graczy z punktami (widok /puchar). */
function buildPuchar(
  roster: Participant[],
  puchar: PucharData,
  puchResults: Record<string, PucharResult>,
): PucharOut {
  return {
    rounds: puchar.rounds.map((round) => ({
      round: round.round,
      matches: round.fixtures.map((f) => {
        const result = puchResults[String(f.no)] ?? null;
        const predictions = Object.fromEntries(
          roster.map((p) => {
            const pick = round.predictions[p.id]?.[String(f.no)] ?? null;
            const points = pick && result ? scorePucharMatch(pick, result) : null;
            return [p.id, { pick, points }];
          }),
        );
        return { no: f.no, home: f.home, away: f.away, kickoff: f.kickoff, result, predictions };
      }),
    })),
  };
}

/**
 * Sklejka silnika z danymi kanonicznymi: roster + tury (typy) + wyniki →
 * tabela ogólna i tabele grup A–H (kształt public/data/results.json).
 * Czysta funkcja — I/O robi compute/buildResultsCli.ts.
 */
export function buildResults(
  roster: Participant[],
  turns: TurnData[],
  results: ResultsByTurn,
  puchar: PucharData = { rounds: [] },
  puchResults: Record<string, PucharResult> = {},
  generatedAt: string = new Date().toISOString(),
): ResultsJson {
  const groupOf = new Map(roster.map((p) => [p.id, p.group]));
  const counts = new Map<string, Pick<TableRow, 'count3' | 'count4' | 'count5' | 'played'>>();

  const puchAgg = new Map<string, PucharAgg>();
  const seasons = roster.map((p) => {
    const ts = [1, 2, 3].map((n) =>
      scoreTurn(p.id, turns.find((t) => t.turn === n), n, results),
    ) as [TurnScore, TurnScore, TurnScore];
    applyOrganizerCorrections(p.id, ts);
    counts.set(p.id, {
      count3: ts[0].count3 + ts[1].count3 + ts[2].count3,
      count4: ts[0].count4 + ts[1].count4 + ts[2].count4,
      count5: ts[0].count5 + ts[1].count5 + ts[2].count5,
      played: ts[0].played + ts[1].played + ts[2].played,
    });
    const entries = puchar.rounds.flatMap((round) =>
      round.fixtures.map((f) => ({
        prediction: round.predictions[p.id]?.[String(f.no)] ?? null,
        result: puchResults[String(f.no)] ?? null,
      })),
    );
    const agg = aggregatePuchar(entries);
    puchAgg.set(p.id, agg);
    return buildSeason(p.id, ts, { puch: agg.puch });
  });

  // „%" tabeli OGÓLNEJ wlicza puchar (grupowa zostaje na buildSeason/s.hitRate).
  const genHitRate = new Map<string, number>();
  for (const p of roster) {
    const g = counts.get(p.id)!;
    const a = puchAgg.get(p.id)!;
    const hits = g.count3 + g.count4 + g.count5 + a.count6 + a.count8 + a.count10 + a.count12;
    const played = g.played + a.played;
    genHitRate.set(p.id, played === 0 ? 0 : hits / played);
  }

  // Bonus „skuteczności" (ukryty): top3 KAŻDEGO zamkniętego etapu po punktach etapu
  // (tura → grI/grII/grIII; remis → sezonowe %). Liczony i zapamiętywany, nie wliczany
  // do punktów. Etap pucharowy dodany — staje się aktywnym tiebreakerem od fazy pucharowej.
  const PHASE_KEY = { 1: 'grI', 2: 'grII', 3: 'grIII' } as const;
  const phases: PhaseStanding[] = [1, 2, 3].map((n) => ({
    complete: turnComplete(turns, results, n),
    standings: rankBy(
      seasons.map((s) => ({ participantId: s.participantId, pts: s[PHASE_KEY[n as 1 | 2 | 3]], hitRate: s.hitRate })),
      ['pts', 'hitRate'],
    ).map((r) => r.participantId),
  }));
  // Etap pucharowy: kompletny gdy każda runda ma wynik dla każdego meczu.
  const puchComplete =
    puchar.rounds.length > 0 &&
    puchar.rounds.every((r) => r.fixtures.length > 0 && r.fixtures.every((f) => puchResults[String(f.no)] != null));
  const puchPhase: PhaseStanding = {
    complete: puchComplete,
    standings: rankBy(
      seasons.map((s) => ({ participantId: s.participantId, pts: s.puch, hitRate: genHitRate.get(s.participantId)! })),
      ['pts', 'hitRate'],
    ).map((r) => r.participantId),
  };
  const skutBonuses = efficiencyBonus([...phases, puchPhase]);

  // Tabele grupowe: pkt = suma samych tur (bez bns/puch) — jak SUM(grI:grIII)
  // w arkuszu „tab grup"; bonus liczy się z tych tabel, nie odwrotnie.
  const groupRows: Omit<TableRow, 'position'>[] = seasons.map((s) => ({
    participantId: s.participantId,
    group: groupOf.get(s.participantId)!,
    points: s.grI + s.grII + s.grIII,
    grI: s.grI,
    grII: s.grII,
    grIII: s.grIII,
    bns: 0,
    puch: s.puch,
    skutBonus: skutBonuses[s.participantId] ?? 0,
    hitRate: s.hitRate,
    ...counts.get(s.participantId)!,
  }));
  const groups = Object.fromEntries(
    ALL_GROUPS.map((g) => [
      g,
      applyOrganizerGroupOrder(g, rankBy(groupRows.filter((r) => r.group === g), GROUP_ORDER)),
    ]),
  ) as Record<Group, TableRow[]>;

  // Bonus bns przyznawany dopiero na zakończenie zmagań grupowych.
  const bonuses = groupStageComplete(turns, results)
    ? groupBonus(ALL_GROUPS.map((g) => groups[g]))
    : {};
  for (const g of ALL_GROUPS) {
    for (const r of groups[g]) r.bns = bonuses[r.participantId] ?? 0;
  }

  const general: TableRow[] = generalTable(
    seasons.map((s) => ({
      ...s,
      bns: bonuses[s.participantId] ?? 0,
      hitRate: genHitRate.get(s.participantId)!,
      skutBonus: skutBonuses[s.participantId] ?? 0,
    })),
  ).map((g) => {
    const c = counts.get(g.participantId)!;
    const a = puchAgg.get(g.participantId)!;
    // Liczniki tabeli OGÓLNEJ wliczają trafienia pucharowe jak u organizatora:
    // puchar 6 pkt → baza 3, 8 → baza 4, 10 → baza 5, 12 → baza 6 (kolumna „6p").
    return {
      participantId: g.participantId,
      group: groupOf.get(g.participantId)!,
      position: g.position,
      points: g.points,
      grI: g.grI,
      grII: g.grII,
      grIII: g.grIII,
      bns: g.bns,
      puch: g.puch,
      skutBonus: skutBonuses[g.participantId] ?? 0,
      hitRate: genHitRate.get(g.participantId)!,
      count3: c.count3 + a.count6,
      count4: c.count4 + a.count8,
      count5: c.count5 + a.count10,
      count6: a.count12,
      played: c.played + a.played,
    };
  });

  // Karty: hero z tabeli ogólnej (evergreen), miejsce w grupie z tabeli grupowej,
  // sekcje szczegółowe z tur fazy grupowej.
  const generalPosOf = new Map(general.map((r) => [r.participantId, r.position]));
  const totalPointsOf = new Map(general.map((r) => [r.participantId, r.points]));
  const groupPosOf = new Map<string, number>();
  for (const g of ALL_GROUPS) groups[g].forEach((r, i) => groupPosOf.set(r.participantId, i + 1));

  const sortedTurns = [...turns].sort((a, b) => a.turn - b.turn);
  const cards = Object.fromEntries(
    roster.map((p) => {
      const input: PlayerCardInput = {
        group: groupOf.get(p.id)!,
        groupPos: groupPosOf.get(p.id)!,
        generalPos: generalPosOf.get(p.id)!,
        totalPoints: totalPointsOf.get(p.id)!,
        turns: sortedTurns.map((t) => ({
          turn: t.turn,
          matches: t.fixtures.map((f) => ({
            pick: t.predictions[p.id]?.[String(f.no)] ?? null,
            result: results[String(t.turn)]?.[String(f.no)] ?? null,
            allPicks: roster.map((q) => t.predictions[q.id]?.[String(f.no)] ?? null),
          })),
        })),
      };
      return [p.id, playerCard(input)] as const;
    }),
  ) as Record<string, CardStats>;

  return {
    generatedAt,
    general,
    groups,
    turns: buildTurns(roster, turns, results),
    puchar: buildPuchar(roster, puchar, puchResults),
    cards,
  };
}
