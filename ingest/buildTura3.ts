// CLI ingestu tury 3 (Konkurs 1). Źródło: płaski plik organizatora "Baza tura 3.xlsx"
// (arkusz 't2' — organizator zostawił starą nazwę; uczestnik × mecz × typ + nazwy drużyn).
// Pipeline:
//   Baza tura 3.xlsx + roster.json → parseBazaTura → data/k1/tura-3.json
// Terminy meczów nie ma w pliku — bierzemy z oficjalnego terminarza MŚ 2026 (Wikipedia per
// grupa). UWAGA: 3. kolejka gra się w RÓŻNYCH strefach USA/Meksyku (UTC−4…−7), więc nie da
// się jak w turze 2 użyć stałego ET+6 — każdy mecz przeliczamy z jego momentu UTC na POLSKI
// czas (CEST = UTC+2).
import { readFileSync, writeFileSync } from 'node:fs';
import { openXlsx } from './xlsx/workbook';
import { parseBazaTura } from './k1/parseBazaTura';
import type { Participant } from './k1/parseGrup1';

const BAZA = 'Baza tura 3 v2.xlsx'; // v2: spóźnialscy (Seweryn, KamilF) dosłali komplet typów
const SHEET = 't2'; // organizator nazwał arkusz tak samo jak w turze 2
const ROSTER = 'data/k1/roster.json';
const OUT = 'data/k1/tura-3.json';

// Pisownia nicka w bazie → kanoniczny nick z rosteru (te same 5 aliasów co tury 1–2).
const NICK_ALIAS: Record<string, string> = {
  WojtekN: 'Wojtek',
  'Turbo-Ryzu': 'Turbo-Ryżu',
  RafałCz: 'Rafał',
  'Sławek G.': 'Sławek',
  PawełS: 'PawełSt',
};

// Pisownia drużyny w bazie → kanoniczna nazwa (jak tura-1/2 / ingest/scores/teamMap.ts).
const TEAM_ALIAS: Record<string, string> = {
  'Wybrzeże Kości Słon.': 'Wybrzeże Koś. Słon.',
};

// Terminarz MŚ 2026, matchday 3 (źródło: Wikipedia per grupa). Numer naszego meczu → moment
// UTC rozpoczęcia (d = dzień czerwca UTC, h:min = godzina UTC). Oba mecze grupy grają równo.
const UTC_SCHEDULE: Record<number, { d: number; h: number; min: number }> = {
  1: { d: 24, h: 19, min: 0 }, // gr B: Kanada-Szwajcaria (12:00 PDT, Vancouver)
  2: { d: 24, h: 19, min: 0 }, // gr B: Bośnia-Katar (12:00 PDT, Seattle)
  3: { d: 24, h: 22, min: 0 }, // gr C: Maroko-Haiti (18:00 EDT, Atlanta)
  4: { d: 24, h: 22, min: 0 }, // gr C: Szkocja-Brazylia (18:00 EDT, Miami)
  5: { d: 25, h: 1, min: 0 }, // gr A: RPA-Korea Płd. (19:00 UTC−6, Guadalupe)
  6: { d: 25, h: 1, min: 0 }, // gr A: Meksyk-Czechy (19:00 UTC−6, Mexico City)
  7: { d: 25, h: 20, min: 0 }, // gr E: Curacao-Wybrzeże Koś. Słon. (16:00 EDT, Filadelfia)
  8: { d: 25, h: 20, min: 0 }, // gr E: Ekwador-Niemcy (16:00 EDT, East Rutherford)
  9: { d: 25, h: 23, min: 0 }, // gr F: Japonia-Szwecja (18:00 CDT, Arlington)
  10: { d: 25, h: 23, min: 0 }, // gr F: Tunezja-Holandia (18:00 CDT, Kansas City)
  11: { d: 26, h: 2, min: 0 }, // gr D: Paragwaj-Australia (19:00 PDT, Santa Clara)
  12: { d: 26, h: 2, min: 0 }, // gr D: USA-Turcja (19:00 PDT, Inglewood)
  13: { d: 26, h: 19, min: 0 }, // gr I: Norwegia-Francja (15:00 EDT, Foxborough)
  14: { d: 26, h: 19, min: 0 }, // gr I: Senegal-Irak (15:00 EDT, Toronto)
  15: { d: 27, h: 0, min: 0 }, // gr H: Rep. Ziel. Przylądka-Arabia Saudyjska (19:00 CDT, Houston)
  16: { d: 27, h: 0, min: 0 }, // gr H: Urugwaj-Hiszpania (18:00 UTC−6, Zapopan)
  17: { d: 27, h: 3, min: 0 }, // gr G: Egipt-Iran (20:00 PDT, Seattle)
  18: { d: 27, h: 3, min: 0 }, // gr G: Nowa Zelandia-Belgia (20:00 PDT, Vancouver)
  19: { d: 27, h: 21, min: 0 }, // gr L: Chorwacja-Ghana (17:00 EDT, Filadelfia)
  20: { d: 27, h: 21, min: 0 }, // gr L: Panama-Anglia (17:00 EDT, East Rutherford)
  21: { d: 27, h: 23, min: 30 }, // gr K: DR Konga-Uzbekistan (19:30 EDT)
  22: { d: 27, h: 23, min: 30 }, // gr K: Kolumbia-Portugalia (19:30 EDT)
  23: { d: 28, h: 2, min: 0 }, // gr J: Algieria-Austria (21:00 CDT, Kansas City)
  24: { d: 28, h: 2, min: 0 }, // gr J: Jordania-Argentyna (21:00 CDT, Arlington)
};

const DOW = ['niedziela', 'poniedz.', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

/** Tekst terminu w polskim czasie (CEST = UTC+2), w formacie jak tura-1/2. */
function plKickoff(d: number, h: number, min: number): string {
  const utc = new Date(Date.UTC(2026, 5, d, h, min));
  const cest = new Date(utc.getTime() + 2 * 3600 * 1000); // UTC → CEST(UTC+2)
  const dow = DOW[cest.getUTCDay()];
  const hh = String(cest.getUTCHours()).padStart(2, '0');
  const mm = String(cest.getUTCMinutes()).padStart(2, '0');
  return `${dow}, ${cest.getUTCDate()} cze godz. ${hh}.${mm}`;
}

const kickoffs: Record<number, string> = {};
for (const [no, { d, h, min }] of Object.entries(UTC_SCHEDULE)) {
  kickoffs[Number(no)] = plKickoff(d, h, min);
}

const roster: Participant[] = JSON.parse(readFileSync(ROSTER, 'utf8'));
const sheet = openXlsx(readFileSync(BAZA)).sheet(SHEET);
const parsed = parseBazaTura(sheet, { turn: 3, roster, nickAlias: NICK_ALIAS, teamAlias: TEAM_ALIAS, kickoffs });

if (parsed.fixtures.length !== 24) {
  throw new Error(`Oczekiwano 24 meczów tury 3, jest ${parsed.fixtures.length}`);
}
const missingKickoff = parsed.fixtures.filter((f) => f.kickoff === '');
if (missingKickoff.length > 0) {
  throw new Error(`Brak terminu dla meczów: ${missingKickoff.map((f) => f.no).join(', ')}`);
}

writeFileSync(OUT, JSON.stringify(parsed, null, 2) + '\n');

const withTyp = Object.keys(parsed.predictions).length;
const noTyp = roster.filter((p) => !parsed.predictions[p.id]).map((p) => p.id);
console.log(`OK: ${parsed.fixtures.length} meczów, ${withTyp}/${roster.length} graczy z typami → ${OUT}`);
console.log(`Bez ŻADNEGO typu (0 pkt na razie): ${noTyp.length ? noTyp.join(', ') : '—'}`);
console.log('Terminarz tury 3 (polski czas):');
for (const f of parsed.fixtures) console.log(`  ${String(f.no).padStart(2)}: ${f.home} - ${f.away}  ||  ${f.kickoff}`);
