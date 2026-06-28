import type { PucharPick, Side } from '../../engine/types';
import type { Sheet } from '../xlsx/workbook';
import type { Fixture, Participant } from './parseGrup1';

export interface ParseBazaPucharOptions {
  /** Etykieta rundy, np. "1/16". */
  round: string;
  /** Roster — źródło prawdy o nickach (obecni muszą być w rosterze; brak obecności dozwolony). */
  roster: Participant[];
  /** Pisownia nicka w bazie → kanoniczny nick z rosteru. */
  nickAlias?: Record<string, string>;
  /** Pisownia drużyny w bazie → kanoniczna nazwa. */
  teamAlias?: Record<string, string>;
  /** Numer meczu → tekst terminu (kickoff). Brak = "". */
  kickoffs?: Record<number, string>;
}

export interface PucharRound {
  round: string;
  fixtures: Fixture[];
  /** id uczestnika → (numer meczu → typ). Brak typu = brak klucza. */
  predictions: Record<string, Record<number, PucharPick>>;
}

function asStr(v: string | number | undefined): string {
  return v === undefined ? '' : String(v).trim();
}
function asNum(v: string | number | undefined): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}
/** Krzyżyk: 'x' lub 'X' po przycięciu. */
function isX(v: string | number | undefined): boolean {
  return typeof v === 'string' && v.trim().toLowerCase() === 'x';
}

/**
 * Parsuje płaską bazę typów pucharowych organizatora ("Baza puch vN.xlsx", arkusz `t2`):
 * B uczestnik, C mecz, D/E drużyny, F/G wynik, H/I krzyżyk karnych (H=kraj1/home, I=kraj2/away).
 * Tolerancyjny: NIE wymaga kompletu rosteru (typy spływają etapami) — obecni muszą być w rosterze,
 * nieobecni i częściowe typy po prostu nie punktują. Krzyżyk tylko przy remisie; przy nie-remisie
 * lub niekompletnym wyniku ignorowany (ostrzeżenie). Czysty — I/O robi CLI.
 */
export function parseBazaPuchar(sheet: Sheet, opts: ParseBazaPucharOptions): PucharRound {
  const nickAlias = opts.nickAlias ?? {};
  const teamAlias = opts.teamAlias ?? {};
  const kickoffs = opts.kickoffs ?? {};
  const normTeam = (t: string) => teamAlias[t] ?? t;
  const rosterIds = new Set(opts.roster.map((p) => p.id));

  const fixtures = new Map<number, Fixture>();
  const predictions: Record<string, Record<number, PucharPick>> = {};

  for (let r = 2; r <= sheet.maxRow; r++) {
    const rawPlayer = asStr(sheet.cell(`B${r}`));
    if (rawPlayer === '') continue;
    const player = nickAlias[rawPlayer] ?? rawPlayer;
    if (!rosterIds.has(player)) {
      throw new Error(`Uczestnik spoza rosteru: "${player}" (sprawdź nickAlias)`);
    }

    const match = asNum(sheet.cell(`C${r}`));
    if (match === undefined) continue;
    const home = normTeam(asStr(sheet.cell(`D${r}`)));
    const away = normTeam(asStr(sheet.cell(`E${r}`)));

    // Fixtures: rejestrujemy tylko wiersze z obiema drużynami; pierwszy ustala parę, kolejne muszą się zgadzać.
    if (home !== '' && away !== '') {
      const existing = fixtures.get(match);
      if (!existing) {
        fixtures.set(match, { no: match, home, away, kickoff: kickoffs[match] ?? '' });
      } else if (existing.home !== home || existing.away !== away) {
        throw new Error(
          `Niespójne drużyny dla mecz ${match}: "${existing.home}-${existing.away}" vs "${home}-${away}"`,
        );
      }
    }

    // Typ pełny tylko gdy oba pola wyniku obecne.
    const w1 = asNum(sheet.cell(`F${r}`));
    const w2 = asNum(sheet.cell(`G${r}`));
    if (w1 === undefined || w2 === undefined) continue;

    const pick: PucharPick = { home: w1, away: w2 };
    const hX = isX(sheet.cell(`H${r}`));
    const iX = isX(sheet.cell(`I${r}`));
    if (w1 === w2) {
      if (hX && !iX) pick.pk = 'home';
      else if (iX && !hX) pick.pk = 'away';
      else if (hX && iX) console.warn(`Wiersz ${r} (${player}, mecz ${match}): dwa krzyżyki — pomijam.`);
      // brak krzyżyka przy remisie: dozwolone (pk zostaje pusty)
    } else if (hX || iX) {
      console.warn(`Wiersz ${r} (${player}, mecz ${match}): krzyżyk przy nie-remisie — ignoruję.`);
    }
    (predictions[player] ??= {})[match] = pick;
  }

  const sortedFixtures = [...fixtures.values()].sort((a, b) => a.no - b.no);
  return { round: opts.round, fixtures: sortedFixtures, predictions };
}
