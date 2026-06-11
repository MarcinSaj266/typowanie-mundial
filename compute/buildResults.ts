import { aggregateTurn } from '../engine/aggregate';
import { buildSeason } from '../engine/buildSeason';
import { generalTable } from '../engine/generalTable';
import { rankBy } from '../engine/ranking';
import type { MatchEntry, TurnScore } from '../engine/types';
import { ALL_GROUPS } from './types';
import type { Group, Participant, ResultsByTurn, ResultsJson, TableRow, TurnData } from './types';

/** Porządek tabeli grupowej (SORTBY arkusza „tab grup"): pkt → % → grIII → grI → grII. */
const GROUP_ORDER = ['points', 'hitRate', 'grIII', 'grI', 'grII'] as const;

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

/**
 * Sklejka silnika z danymi kanonicznymi: roster + tury (typy) + wyniki →
 * tabela ogólna i tabele grup A–H (kształt public/data/results.json).
 * Czysta funkcja — I/O robi compute/buildResultsCli.ts.
 */
export function buildResults(
  roster: Participant[],
  turns: TurnData[],
  results: ResultsByTurn,
  generatedAt: string = new Date().toISOString(),
): ResultsJson {
  const groupOf = new Map(roster.map((p) => [p.id, p.group]));
  const counts = new Map<string, Pick<TableRow, 'count3' | 'count4' | 'count5' | 'played'>>();

  const seasons = roster.map((p) => {
    const ts = [1, 2, 3].map((n) =>
      scoreTurn(p.id, turns.find((t) => t.turn === n), n, results),
    ) as [TurnScore, TurnScore, TurnScore];
    counts.set(p.id, {
      count3: ts[0].count3 + ts[1].count3 + ts[2].count3,
      count4: ts[0].count4 + ts[1].count4 + ts[2].count4,
      count5: ts[0].count5 + ts[1].count5 + ts[2].count5,
      played: ts[0].played + ts[1].played + ts[2].played,
    });
    return buildSeason(p.id, ts);
  });

  const general: TableRow[] = generalTable(seasons).map((g) => ({
    participantId: g.participantId,
    group: groupOf.get(g.participantId)!,
    position: g.position,
    points: g.points,
    grI: g.grI,
    grII: g.grII,
    grIII: g.grIII,
    bns: g.bns,
    puch: g.puch,
    hitRate: g.hitRate,
    ...counts.get(g.participantId)!,
  }));

  const groups = Object.fromEntries(
    ALL_GROUPS.map((g) => [
      g,
      rankBy(general.filter((r) => r.group === g), GROUP_ORDER),
    ]),
  ) as Record<Group, TableRow[]>;

  return { generatedAt, general, groups };
}
