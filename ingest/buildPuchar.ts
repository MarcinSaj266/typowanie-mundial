// CLI ingestu typów pucharowych (Konkurs 1). Źródło: płaska baza organizatora
// "Baza puch vN.xlsx" (arkusz 'typy'; do v6 włącznie nazywał się 't2'). Pipeline:
//   Baza puch v7 2026.07.14.xlsx + roster.json → parseBazaPuchar × runda → data/k1/puchar.json
// Baza jest WIELORUNDOWA: mecze 1–16 = 1/16, 17–24 = 1/8, 25–28 = 1/4, 29–30 = 1/2 (puste pary
// → parser je pomija). Tolerancyjny: typy spływają etapami. Reingest nowszej bazy nadpisuje plik.
import { readFileSync, writeFileSync } from 'node:fs';
import { openXlsx } from './xlsx/workbook';
import { parseBazaPuchar, type PucharRound } from './k1/parseBazaPuchar';
import type { Participant } from './k1/parseGrup1';
import type { PucharPick } from '../engine/types';

const BAZA = 'Baza puch v7 2026.07.14.xlsx';
const SHEET = 'typy';
const ROSTER = 'data/k1/roster.json';
const OUT = 'data/k1/puchar.json';

// Rundy w bazie: etykieta + zakres numerów meczów + oczekiwana liczba par.
const ROUNDS = [
  { round: '1/16', matches: { from: 1, to: 16 }, expected: 16 },
  { round: '1/8', matches: { from: 17, to: 24 }, expected: 8 },
  { round: '1/4', matches: { from: 25, to: 28 }, expected: 4 },
  { round: '1/2', matches: { from: 29, to: 30 }, expected: 2 },
] as const;

// Pisownia nicka w bazie → kanoniczny nick z rosteru (te same aliasy co tury 1–3).
const NICK_ALIAS: Record<string, string> = {
  WojtekN: 'Wojtek',
  'Turbo-Ryzu': 'Turbo-Ryżu',
  RafałCz: 'Rafał',
  'Sławek G.': 'Sławek',
  PawełS: 'PawełSt',
};

// Typy dosłane POZA bazą (np. WhatsApp do organizatora) — nakładane po parsowaniu.
// Gdy nowsza baza już zawiera typ gracza: zgodny = no-op, różny = twardy błąd (do wyjaśnienia).
const MANUAL_PICKS: { player: string; match: number; pick: PucharPick; note: string }[] = [
  { player: 'Sokółka', match: 17, pick: { home: 1, away: 2 }, note: 'dosłane 2026-07-04 (Kanada-Maroko)' },
];

// KOREKTY — organizator BŁĘDNIE wpisał typ w bazie (ludzki błąd). W odróżnieniu od MANUAL_PICKS
// (uzupełnia luki, konflikt = błąd) korekta ŚWIADOMIE NADPISUJE wartość z bazy poprawną.
// Samonaprawcze: gdy nowsza baza już ma poprawny typ → no-op (log), inaczej → nadpisanie (log).
const CORRECTIONS: { player: string; match: number; pick: PucharPick; note: string }[] = [
  { player: 'Magiera', match: 25, pick: { home: 1, away: 0 }, note: 'korekta 2026-07-09: organizator wpisał odwrotnie; realny typ Francja-Maroko 1:0' },
];

// Terminarz pucharowy MŚ 2026 (1/16: ESPN/worldcupwiki; 1/8: beIN/Al Jazeera, 2026-07-04),
// godziny ET. W bazie terminów nie ma — jak w turach grupowych bierzemy z oficjalnego terminarza
// i przeliczamy ET (EDT = UTC−4) → POLSKI (CEST = UTC+2), czyli ET + 6h. Numer naszego meczu →
// {miesiąc, dzień, godzina ET, minuta ET}. Część meczów ma połówki godziny (16:30, 21:30).
const ET_SCHEDULE: Record<number, { m: number; day: number; h: number; min: number }> = {
  1: { m: 6, day: 28, h: 15, min: 0 }, // Kanada-RPA (nd 28 cze 15:00 ET)
  2: { m: 6, day: 29, h: 13, min: 0 }, // Brazylia-Japonia
  3: { m: 6, day: 29, h: 16, min: 30 }, // Niemcy-Paragwaj
  4: { m: 6, day: 29, h: 21, min: 0 }, // Holandia-Maroko
  5: { m: 6, day: 30, h: 13, min: 0 }, // Wybrzeże Kość. Słon.-Norwegia
  6: { m: 6, day: 30, h: 17, min: 0 }, // Francja-Szwecja
  7: { m: 6, day: 30, h: 21, min: 0 }, // Meksyk-Ekwador
  8: { m: 7, day: 1, h: 12, min: 0 }, // Anglia-DR Konga
  9: { m: 7, day: 1, h: 16, min: 0 }, // Belgia-Senegal
  10: { m: 7, day: 1, h: 20, min: 0 }, // USA-Bośnia i Hercegowina
  11: { m: 7, day: 2, h: 15, min: 0 }, // Hiszpania-Austria
  12: { m: 7, day: 2, h: 19, min: 0 }, // Portugalia-Chorwacja
  13: { m: 7, day: 2, h: 23, min: 0 }, // Szwajcaria-Algieria
  14: { m: 7, day: 3, h: 14, min: 0 }, // Australia-Egipt
  15: { m: 7, day: 3, h: 18, min: 0 }, // Argentyna-Republika Ziel. Przylądka
  16: { m: 7, day: 3, h: 21, min: 30 }, // Kolumbia-Ghana
  17: { m: 7, day: 4, h: 13, min: 0 }, // Kanada-Maroko (sob 4 lip 13:00 ET → 19:00 PL)
  18: { m: 7, day: 4, h: 17, min: 0 }, // Paragwaj-Francja
  19: { m: 7, day: 5, h: 16, min: 0 }, // Brazylia-Norwegia
  20: { m: 7, day: 5, h: 20, min: 0 }, // Meksyk-Anglia
  21: { m: 7, day: 6, h: 15, min: 0 }, // Portugalia-Hiszpania
  22: { m: 7, day: 6, h: 20, min: 0 }, // USA-Belgia
  23: { m: 7, day: 7, h: 12, min: 0 }, // Argentyna-Egipt
  24: { m: 7, day: 7, h: 16, min: 0 }, // Szwajcaria-Kolumbia
  // 1/4 (ćwierćfinały, terminarz FIFA/Yahoo 2026-07-09; godziny ET):
  25: { m: 7, day: 9, h: 16, min: 0 }, // Francja-Maroko (czw 9 lip 16:00 ET → 22:00 PL)
  26: { m: 7, day: 10, h: 15, min: 0 }, // Hiszpania-Belgia (pt 10 lip 15:00 ET → 21:00 PL)
  27: { m: 7, day: 11, h: 17, min: 0 }, // Norwegia-Anglia (sob 11 lip 17:00 ET → 23:00 PL)
  28: { m: 7, day: 11, h: 21, min: 0 }, // Argentyna-Szwajcaria (sob 11 lip 21:00 ET → niedz 12 lip 03:00 PL)
  // 1/2 (półfinały, terminy z football-data.org 2026-07-14: utcDate 19:00Z = 15:00 ET):
  29: { m: 7, day: 14, h: 15, min: 0 }, // Francja-Hiszpania (wt 14 lip 15:00 ET → 21:00 PL)
  30: { m: 7, day: 15, h: 15, min: 0 }, // Anglia-Argentyna (śr 15 lip 15:00 ET → 21:00 PL)
};

const DOW = ['niedziela', 'poniedz.', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const MIES = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

/** Tekst terminu w polskim czasie (CEST = ET + 6h), w formacie jak tury grupowe. */
function plKickoff(month1: number, day: number, etHour: number, etMin: number): string {
  const utc = new Date(Date.UTC(2026, month1 - 1, day, etHour + 4, etMin)); // ET(UTC−4) → UTC
  const cest = new Date(utc.getTime() + 2 * 3600 * 1000); // UTC → CEST(UTC+2)
  const dow = DOW[cest.getUTCDay()];
  const hh = String(cest.getUTCHours()).padStart(2, '0');
  const mm = String(cest.getUTCMinutes()).padStart(2, '0');
  return `${dow}, ${cest.getUTCDate()} ${MIES[cest.getUTCMonth()]} godz. ${hh}.${mm}`;
}

const kickoffs: Record<number, string> = {};
for (const [no, s] of Object.entries(ET_SCHEDULE)) {
  kickoffs[Number(no)] = plKickoff(s.m, s.day, s.h, s.min);
}

const roster: Participant[] = JSON.parse(readFileSync(ROSTER, 'utf8'));
const sheet = openXlsx(readFileSync(BAZA)).sheet(SHEET);

const rounds: PucharRound[] = ROUNDS.map(({ round, matches, expected }) => {
  const parsed = parseBazaPuchar(sheet, { round, roster, nickAlias: NICK_ALIAS, kickoffs, matches });
  if (parsed.fixtures.length !== expected) {
    throw new Error(`Oczekiwano ${expected} meczów ${round}, jest ${parsed.fixtures.length}`);
  }
  const missingKickoff = parsed.fixtures.filter((f) => f.kickoff === '');
  if (missingKickoff.length > 0) {
    throw new Error(`Brak terminu dla meczów: ${missingKickoff.map((f) => f.no).join(', ')}`);
  }
  return parsed;
});

// Nakładka typów dosłanych poza bazą.
for (const { player, match, pick, note } of MANUAL_PICKS) {
  const round = rounds.find((r) => r.fixtures.some((f) => f.no === match));
  if (!round) throw new Error(`MANUAL_PICKS: mecz ${match} nie istnieje w żadnej rundzie`);
  if (!roster.some((p) => p.id === player)) throw new Error(`MANUAL_PICKS: "${player}" spoza rosteru`);
  const existing = round.predictions[player]?.[match];
  if (existing) {
    const same =
      existing.home === pick.home && existing.away === pick.away && existing.pk === pick.pk;
    if (!same) {
      throw new Error(
        `MANUAL_PICKS: konflikt dla ${player} mecz ${match}: baza ${existing.home}:${existing.away} vs ręczny ${pick.home}:${pick.away} (${note})`,
      );
    }
    console.log(`MANUAL_PICKS: ${player} mecz ${match} już w bazie, zgodny — pomijam (${note})`);
    continue;
  }
  (round.predictions[player] ??= {})[match] = pick;
  console.log(`MANUAL_PICKS: dołożono ${player} mecz ${match} → ${pick.home}:${pick.away} (${note})`);
}

// Nakładka korekt — nadpisuje błędny typ z bazy poprawną wartością.
for (const { player, match, pick, note } of CORRECTIONS) {
  const round = rounds.find((r) => r.fixtures.some((f) => f.no === match));
  if (!round) throw new Error(`CORRECTIONS: mecz ${match} nie istnieje w żadnej rundzie`);
  if (!roster.some((p) => p.id === player)) throw new Error(`CORRECTIONS: "${player}" spoza rosteru`);
  const existing = round.predictions[player]?.[match];
  const same =
    existing && existing.home === pick.home && existing.away === pick.away && existing.pk === pick.pk;
  if (same) {
    console.log(`CORRECTIONS: ${player} mecz ${match} już poprawny w bazie — pomijam (${note})`);
    continue;
  }
  const before = existing ? `${existing.home}:${existing.away}` : 'brak';
  (round.predictions[player] ??= {})[match] = pick;
  console.log(`CORRECTIONS: ${player} mecz ${match}: ${before} → ${pick.home}:${pick.away} (${note})`);
}

writeFileSync(OUT, JSON.stringify({ rounds }, null, 2) + '\n');

for (const round of rounds) {
  const withTyp = Object.keys(round.predictions).length;
  const noTyp = roster.filter((p) => !round.predictions[p.id]).map((p) => p.id);
  let krzyzyki = 0;
  for (const byMatch of Object.values(round.predictions))
    for (const pick of Object.values(byMatch)) if (pick.pk) krzyzyki++;
  console.log(`OK: ${round.fixtures.length} meczów ${round.round}, ${withTyp}/${roster.length} graczy z typami, ${krzyzyki} krzyżyków`);
  console.log(`  Bez ŻADNEGO typu w ${round.round} (0 pkt): ${noTyp.length ? noTyp.join(', ') : '—'}`);
  console.log(`  Terminarz ${round.round} (polski czas):`);
  for (const f of round.fixtures) console.log(`   ${String(f.no).padStart(2)}: ${f.home} - ${f.away}  ||  ${f.kickoff}`);
}
console.log(`→ ${OUT}`);
