import type { Score } from '../../engine/types';
import type { Sheet } from '../xlsx/workbook';
import type { Fixture, Participant } from './parseGrup1';

export interface ParseBazaOptions {
  /** Numer tury (np. 2). */
  turn: number;
  /** Roster (źródło prawdy o składzie) — baza musi pokrywać dokładnie ten zestaw nicków. */
  roster: Participant[];
  /** Pisownia nicka w bazie → kanoniczny nick z rosteru. */
  nickAlias?: Record<string, string>;
  /** Pisownia drużyny w bazie → kanoniczna nazwa (jak tura-1 / teamMap). */
  teamAlias?: Record<string, string>;
  /** Numer meczu → tekst terminu (kickoff). Brak = pusty string. */
  kickoffs?: Record<number, string>;
}

export interface BazaTurn {
  turn: number;
  fixtures: Fixture[];
  /** id uczestnika → (numer meczu → typ). Brak typu = brak klucza. */
  predictions: Record<string, Record<number, Score>>;
}

function asStr(v: string | number | undefined): string {
  return v === undefined ? '' : String(v).trim();
}

function asNum(v: string | number | undefined): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

/**
 * Parsuje płaski plik organizatora "Baza tura N.xlsx" (jeden wiersz = uczestnik × mecz):
 * kol. C uczestnik, D mecz, E/F drużyny, G/H typ. Buduje fixtures (z drużyn, spójność
 * sprawdzana) + typy K1 (puste typy pomijane → gracz nie punktuje). Nicki i nazwy drużyn
 * normalizowane aliasami do nomenklatury rosteru/tura-1. Rzuca, gdy skład bazy ≠ roster
 * albo mecz ma niespójne drużyny. Czysty — I/O robi CLI.
 */
export function parseBazaTura(sheet: Sheet, opts: ParseBazaOptions): BazaTurn {
  const nickAlias = opts.nickAlias ?? {};
  const teamAlias = opts.teamAlias ?? {};
  const kickoffs = opts.kickoffs ?? {};
  const normTeam = (t: string) => teamAlias[t] ?? t;

  const fixtures = new Map<number, Fixture>();
  const predictions: Record<string, Record<number, Score>> = {};
  const seenPlayers = new Set<string>();

  for (let r = 2; r <= sheet.maxRow; r++) {
    const rawPlayer = asStr(sheet.cell(`C${r}`));
    if (rawPlayer === '') continue;
    const player = nickAlias[rawPlayer] ?? rawPlayer;
    seenPlayers.add(player);

    const match = asNum(sheet.cell(`D${r}`));
    if (match === undefined) throw new Error(`Wiersz ${r}: brak numeru meczu`);
    const home = normTeam(asStr(sheet.cell(`E${r}`)));
    const away = normTeam(asStr(sheet.cell(`F${r}`)));

    // Fixtures: pierwszy wiersz ustala parę, kolejne muszą się zgadzać.
    const existing = fixtures.get(match);
    if (!existing) {
      fixtures.set(match, { no: match, home, away, kickoff: kickoffs[match] ?? '' });
    } else if (existing.home !== home || existing.away !== away) {
      throw new Error(
        `Niespójne drużyny dla mecz ${match}: "${existing.home}-${existing.away}" vs "${home}-${away}"`,
      );
    }

    // Typ: pełny tylko gdy oba pola obecne; inaczej pomijamy (brak typu = brak punktów).
    const w1 = asNum(sheet.cell(`G${r}`));
    const w2 = asNum(sheet.cell(`H${r}`));
    if (w1 !== undefined && w2 !== undefined) {
      (predictions[player] ??= {})[match] = { home: w1, away: w2 };
    }
  }

  // Skład bazy musi się dokładnie pokrywać z rosterem (łapie literówki/braki nicków).
  const rosterIds = new Set(opts.roster.map((p) => p.id));
  for (const p of seenPlayers) {
    if (!rosterIds.has(p)) throw new Error(`Uczestnik spoza rosteru: "${p}" (sprawdź nickAlias)`);
  }
  for (const id of rosterIds) {
    if (!seenPlayers.has(id)) throw new Error(`Brak uczestnika w bazie: "${id}"`);
  }

  const sortedFixtures = [...fixtures.values()].sort((a, b) => a.no - b.no);
  return { turn: opts.turn, fixtures: sortedFixtures, predictions };
}
