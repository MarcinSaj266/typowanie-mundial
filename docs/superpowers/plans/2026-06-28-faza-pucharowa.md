# Faza pucharowa K1 — Implementation Plan (Etap A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wczytać typy uczestników na 1/16 finału z `Baza puch v1.xlsx`, policzyć punkty pucharowe (`puch`), wpiąć je w tabelę ogólną (suma, „%", `skutBonus`) i pokazać w nowym widoku `/puchar`.

**Architecture:** Granice jak w reszcie projektu — `engine/` (czyste liczenie, nie zna Excela/UI), `ingest/` (Excel → JSON), `compute/` (sklejka → `public/data/results.json`), `app/` (render, czyta tylko `results.json`). Silnik meczu (`scoreMatchPuchar`) JUŻ istnieje i jest zweryfikowany — dodajemy agregację i parser, nie zmieniamy reguły meczu.

**Tech Stack:** TypeScript, Vitest (TDD), Next.js App Router (static export), własny czytnik xlsx (`ingest/xlsx`).

## Global Constraints

- Język UI i komentarzy: **polski**. Teksty UI w formie włączającej kobiety (konkurs ma uczestniczki).
- Środowisko: Windows, PowerShell, Node.js (brak Pythona). Skrypty przez `tsx`.
- Reguła karnych: `scoreMatchPuchar` liczy bazę grupową (3/4/5) z modyfikatorem ±1 **przed** ×2; to równe organizatorskiemu „×2, potem ±2". **Nie zmieniamy `engine/scoreMatchPuchar.ts`.**
- Parser pucharowy jest **tolerancyjny**: NIE wymaga kompletu 56 (inaczej niż `parseBazaTura`). Nieobecni i częściowe typy → brak typu (0 pkt), bez wyjątku. Twardy błąd tylko dla nicka spoza rosteru.
- Karne w bazie: znacznik `x` **oraz** `X` (case-insensitive). `H`=krzyżyk na kraj1 (home), `I`=krzyżyk na kraj2 (away).
- Aliasy nicków (base → roster): `WojtekN→Wojtek`, `Turbo-Ryzu→Turbo-Ryżu`, `RafałCz→Rafał`, `Sławek G.→Sławek`, `PawełS→PawełSt`.
- „%" tabeli **ogólnej** wlicza puchar (kategorie 6/8/10/12); tabela **grupowa** zostaje nietknięta (jej „%" i pozycje to nadal sama faza grupowa).
- Terminy meczów 1/16 w Etapie A puste (`kickoff: ""`); daty w czasie PL doda Etap B (robot). Nie fabrykujemy dat teraz.
- Bramka jakości na końcu: `npm test && npm run typecheck && npm run build && npm run smoke`.

---

### Task 1: Typy pucharowe + parser `parseBazaPuchar`

**Files:**
- Modify: `engine/types.ts` (dodać `Side`, `PucharPick`, `PucharResult`)
- Create: `ingest/k1/parseBazaPuchar.ts`
- Test: `ingest/k1/parseBazaPuchar.test.ts`

**Interfaces:**
- Consumes: `Sheet` z `ingest/xlsx/workbook`; `Fixture`, `Participant` z `ingest/k1/parseGrup1`.
- Produces:
  - `engine/types.ts`: `type Side = 'home' | 'away'`; `interface PucharPick { home: number; away: number; pk?: Side }`; `interface PucharResult { home: number; away: number; pk?: Side }`.
  - `parseBazaPuchar(sheet: Sheet, opts: ParseBazaPucharOptions): PucharRound`
  - `interface ParseBazaPucharOptions { round: string; roster: Participant[]; nickAlias?: Record<string,string>; teamAlias?: Record<string,string>; kickoffs?: Record<number,string> }`
  - `interface PucharRound { round: string; fixtures: Fixture[]; predictions: Record<string, Record<number, PucharPick>> }`

- [ ] **Step 1: Dodać typy do `engine/types.ts`**

Na końcu pliku (po typach K2):

```ts
/** Strona meczu — zwycięzca karnych / krzyżyk uczestnika. */
export type Side = 'home' | 'away';

/** Typ pucharowy uczestnika: wynik do 120 min + opcjonalny krzyżyk (zwycięzca karnych).
 *  `pk` ustawiane tylko gdy home===away (remis). */
export interface PucharPick {
  home: number;
  away: number;
  pk?: Side;
}

/** Faktyczny wynik meczu pucharowego: wynik po 120 min + zwycięzca karnych (tylko remisy). */
export interface PucharResult {
  home: number;
  away: number;
  pk?: Side;
}
```

- [ ] **Step 2: Napisać failing test** `ingest/k1/parseBazaPuchar.test.ts`

Wzorzec testu `parseBazaTura.test.ts` — fałszywy `Sheet` z mapy komórek.

```ts
import { describe, it, expect, vi } from 'vitest';
import { parseBazaPuchar } from './parseBazaPuchar';
import type { Sheet } from '../xlsx/workbook';
import type { Participant } from './parseGrup1';

/** Buduje atrapę Sheet z mapy "A1" → wartość. */
function fakeSheet(cells: Record<string, string | number>): Sheet {
  const maxRow = Math.max(
    ...Object.keys(cells).map((k) => Number(k.replace(/^[A-Z]+/, ''))),
    1,
  );
  return { maxRow, cell: (ref: string) => cells[ref] } as unknown as Sheet;
}

const roster: Participant[] = [
  { id: 'AndrzejO', group: 'A' },
  { id: 'Borys', group: 'C' },
];

/** Jeden wiersz danych bazy: nick, mecz, drużyny, wynik, krzyżyki. */
function row(
  r: number,
  nick: string,
  m: number,
  home: string,
  away: string,
  w1?: number,
  w2?: number,
  h?: string,
  i?: string,
): Record<string, string | number> {
  const out: Record<string, string | number> = { [`B${r}`]: nick, [`C${r}`]: m, [`D${r}`]: home, [`E${r}`]: away };
  if (w1 !== undefined) out[`F${r}`] = w1;
  if (w2 !== undefined) out[`G${r}`] = w2;
  if (h !== undefined) out[`H${r}`] = h;
  if (i !== undefined) out[`I${r}`] = i;
  return out;
}

describe('parseBazaPuchar', () => {
  it('czyta wynik i fixtures; pomija typy częściowe (brak G)', () => {
    const sheet = fakeSheet({
      ...row(2, 'AndrzejO', 1, 'Kanada', 'RPA', 2, 1),
      ...row(3, 'AndrzejO', 2, 'Brazylia', 'Japonia', 3), // brak G → brak typu
      ...row(4, 'Borys', 1, 'Kanada', 'RPA', 0, 0, 'x'), // remis, krzyżyk home
    });
    const out = parseBazaPuchar(sheet, { round: '1/16', roster });
    expect(out.round).toBe('1/16');
    expect(out.fixtures).toEqual([
      { no: 1, home: 'Kanada', away: 'RPA', kickoff: '' },
      { no: 2, home: 'Brazylia', away: 'Japonia', kickoff: '' },
    ]);
    expect(out.predictions.AndrzejO[1]).toEqual({ home: 2, away: 1 });
    expect(out.predictions.AndrzejO[2]).toBeUndefined();
    expect(out.predictions.Borys[1]).toEqual({ home: 0, away: 0, pk: 'home' });
  });

  it('krzyżyk case-insensitive (X) na kraj2 → pk:away', () => {
    const sheet = fakeSheet(row(2, 'AndrzejO', 1, 'Kanada', 'RPA', 1, 1, undefined, 'X'));
    const out = parseBazaPuchar(sheet, { round: '1/16', roster });
    expect(out.predictions.AndrzejO[1]).toEqual({ home: 1, away: 1, pk: 'away' });
  });

  it('krzyżyk przy nie-remisie jest ignorowany (z ostrzeżeniem)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sheet = fakeSheet(row(2, 'AndrzejO', 1, 'Kanada', 'RPA', 2, 1, 'x'));
    const out = parseBazaPuchar(sheet, { round: '1/16', roster });
    expect(out.predictions.AndrzejO[1]).toEqual({ home: 2, away: 1 });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('toleruje brak typów u uczestnika (nieobecny w predictions, bez błędu)', () => {
    const sheet = fakeSheet(row(2, 'AndrzejO', 1, 'Kanada', 'RPA', 2, 1));
    const out = parseBazaPuchar(sheet, { round: '1/16', roster });
    expect(out.predictions.Borys).toBeUndefined();
  });

  it('aliasuje nick z bazy do rosteru', () => {
    const sheet = fakeSheet(row(2, 'WojtekN', 1, 'Kanada', 'RPA', 2, 1));
    const out = parseBazaPuchar(sheet, {
      round: '1/16',
      roster: [{ id: 'Wojtek', group: 'A' }],
      nickAlias: { WojtekN: 'Wojtek' },
    });
    expect(out.predictions.Wojtek[1]).toEqual({ home: 2, away: 1 });
  });

  it('rzuca dla nicka spoza rosteru', () => {
    const sheet = fakeSheet(row(2, 'Obcy', 1, 'Kanada', 'RPA', 2, 1));
    expect(() => parseBazaPuchar(sheet, { round: '1/16', roster })).toThrow(/spoza rosteru/);
  });

  it('rzuca przy niespójnej parze drużyn dla tego samego meczu', () => {
    const sheet = fakeSheet({
      ...row(2, 'AndrzejO', 1, 'Kanada', 'RPA', 2, 1),
      ...row(3, 'Borys', 1, 'Kanada', 'Meksyk', 1, 0),
    });
    expect(() => parseBazaPuchar(sheet, { round: '1/16', roster })).toThrow(/Niespójne/);
  });
});
```

- [ ] **Step 3: Uruchomić test — ma FAILować**

Run: `npx vitest run ingest/k1/parseBazaPuchar.test.ts`
Expected: FAIL („Cannot find module './parseBazaPuchar'").

- [ ] **Step 4: Zaimplementować `ingest/k1/parseBazaPuchar.ts`**

```ts
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
```

- [ ] **Step 5: Uruchomić test — ma PRZEJŚĆ**

Run: `npx vitest run ingest/k1/parseBazaPuchar.test.ts`
Expected: PASS (7 testów).

- [ ] **Step 6: Commit**

```bash
git add engine/types.ts ingest/k1/parseBazaPuchar.ts ingest/k1/parseBazaPuchar.test.ts
git commit -m "feat(puch): parser tolerancyjny Baza puch (typy 1/16, krzyżyk x/X)"
```

---

### Task 2: CLI `build:puchar` → `data/k1/puchar.json`

**Files:**
- Create: `ingest/buildPuchar.ts`
- Modify: `package.json` (skrypt `build:puchar`)
- Create (artefakt): `data/k1/puchar.json`

**Interfaces:**
- Consumes: `parseBazaPuchar`, `PucharRound` z Task 1; `openXlsx` z `ingest/xlsx/workbook`; `Participant` z `ingest/k1/parseGrup1`.
- Produces: plik `data/k1/puchar.json` o kształcie `{ rounds: PucharRound[] }` (jedna runda `1/16`).

- [ ] **Step 1: Dodać skrypt do `package.json`**

W sekcji `scripts`, po `"build:tura3"`:

```json
    "build:puchar": "tsx ingest/buildPuchar.ts",
```

- [ ] **Step 2: Zaimplementować `ingest/buildPuchar.ts`**

```ts
// CLI ingestu typów pucharowych (Konkurs 1). Źródło: płaska baza organizatora
// "Baza puch vN.xlsx" (arkusz 't2'). Pipeline:
//   Baza puch v1.xlsx + roster.json → parseBazaPuchar → data/k1/puchar.json (runda 1/16)
// Tolerancyjny: typy spływają etapami (v1 niepełny — 3 osoby + KasiaK bez typów). Reingest
// nowszej bazy nadpisuje plik. Terminy 1/16 na razie puste (doda robot/Etap B w czasie PL).
import { readFileSync, writeFileSync } from 'node:fs';
import { openXlsx } from './xlsx/workbook';
import { parseBazaPuchar, type PucharRound } from './k1/parseBazaPuchar';
import type { Participant } from './k1/parseGrup1';

const BAZA = 'Baza puch v1.xlsx';
const SHEET = 't2';
const ROSTER = 'data/k1/roster.json';
const OUT = 'data/k1/puchar.json';
const EXPECTED_FIXTURES = 16; // 1/16 finału (the last 32)

// Pisownia nicka w bazie → kanoniczny nick z rosteru (te same aliasy co tury 1–3).
const NICK_ALIAS: Record<string, string> = {
  WojtekN: 'Wojtek',
  'Turbo-Ryzu': 'Turbo-Ryżu',
  RafałCz: 'Rafał',
  'Sławek G.': 'Sławek',
  PawełS: 'PawełSt',
};

const roster: Participant[] = JSON.parse(readFileSync(ROSTER, 'utf8'));
const sheet = openXlsx(readFileSync(BAZA)).sheet(SHEET);
const round: PucharRound = parseBazaPuchar(sheet, { round: '1/16', roster, nickAlias: NICK_ALIAS });

if (round.fixtures.length !== EXPECTED_FIXTURES) {
  throw new Error(`Oczekiwano ${EXPECTED_FIXTURES} meczów 1/16, jest ${round.fixtures.length}`);
}

writeFileSync(OUT, JSON.stringify({ rounds: [round] }, null, 2) + '\n');

const withTyp = Object.keys(round.predictions).length;
const noTyp = roster.filter((p) => !round.predictions[p.id]).map((p) => p.id);
let krzyzyki = 0;
for (const byMatch of Object.values(round.predictions))
  for (const pick of Object.values(byMatch)) if (pick.pk) krzyzyki++;
console.log(`OK: ${round.fixtures.length} meczów 1/16, ${withTyp}/${roster.length} graczy z typami, ${krzyzyki} krzyżyków → ${OUT}`);
console.log(`Bez ŻADNEGO typu (0 pkt): ${noTyp.length ? noTyp.join(', ') : '—'}`);
```

- [ ] **Step 3: Uruchomić CLI i zweryfikować wynik**

Run: `npm run build:puchar`
Expected (zgodnie z analizą `Baza puch v1.xlsx`):
- `16 meczów 1/16, 52/56 graczy z typami, ~99 krzyżyków` (krzyżyki tylko z pełnych typów-remisów; ≤117).
- `Bez ŻADNEGO typu: Sokółka, KasiaK, DarekL, KrzysztoWś`
- Brak twardych błędów (KasiaK nieobecna w bazie — dozwolone).
- Powstaje `data/k1/puchar.json`.

- [ ] **Step 4: Rzut oka na `data/k1/puchar.json`**

Run: `npx tsx -e "const d=require('./data/k1/puchar.json'); console.log(d.rounds[0].round, d.rounds[0].fixtures.length, Object.keys(d.rounds[0].predictions).length)"`
Expected: `1/16 16 52`

- [ ] **Step 5: Commit**

```bash
git add package.json ingest/buildPuchar.ts data/k1/puchar.json
git commit -m "feat(puch): CLI build:puchar → data/k1/puchar.json (runda 1/16)"
```

---

### Task 3: Agregacja `aggregatePuchar` + `scorePucharMatch`

**Files:**
- Create: `engine/aggregatePuchar.ts`
- Test: `engine/aggregatePuchar.test.ts`

**Interfaces:**
- Consumes: `scoreMatchPuchar`, `PucharPoints`, `Karne` z `engine/scoreMatchPuchar`; `PucharPick`, `PucharResult`, `Side` z `engine/types`.
- Produces:
  - `scorePucharMatch(pick: PucharPick, result: PucharResult): PucharPoints | null` — punkty jednego meczu; `null` gdy nie da się policzyć (remis faktyczny bez `result.pk`).
  - `interface PucharEntry { prediction: PucharPick | null; result: PucharResult | null }`
  - `interface PucharAgg { puch: number; count6: number; count8: number; count10: number; count12: number; played: number }`
  - `aggregatePuchar(entries: PucharEntry[]): PucharAgg`

- [ ] **Step 1: Napisać failing test** `engine/aggregatePuchar.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { aggregatePuchar, scorePucharMatch } from './aggregatePuchar';

describe('scorePucharMatch', () => {
  it('dokładny wynik (nie-remis) = 5×2 = 10', () => {
    expect(scorePucharMatch({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(10);
  });
  it('różnica bramek = 4×2 = 8', () => {
    expect(scorePucharMatch({ home: 3, away: 1 }, { home: 2, away: 0 })).toBe(8);
  });
  it('samo rozstrzygnięcie = 3×2 = 6', () => {
    expect(scorePucharMatch({ home: 3, away: 0 }, { home: 1, away: 0 })).toBe(6);
  });
  it('pudło = 0', () => {
    expect(scorePucharMatch({ home: 2, away: 0 }, { home: 0, away: 1 })).toBe(0);
  });
  it('remis dokładny + trafione karne = (5+1)×2 = 12', () => {
    expect(scorePucharMatch({ home: 1, away: 1, pk: 'home' }, { home: 1, away: 1, pk: 'home' })).toBe(12);
  });
  it('remis dokładny + błędne karne = (5−1)×2 = 8', () => {
    expect(scorePucharMatch({ home: 1, away: 1, pk: 'away' }, { home: 1, away: 1, pk: 'home' })).toBe(8);
  });
  it('remis (zła dokładność) + trafione karne = (4+1)×2 = 10', () => {
    expect(scorePucharMatch({ home: 0, away: 0, pk: 'home' }, { home: 1, away: 1, pk: 'home' })).toBe(10);
  });
  it('remis bez krzyżyka uczestnika = −1 → (5−1)×2 = 8', () => {
    expect(scorePucharMatch({ home: 1, away: 1 }, { home: 1, away: 1, pk: 'home' })).toBe(8);
  });
  it('remis faktyczny bez result.pk → null (brak danych o karnych)', () => {
    expect(scorePucharMatch({ home: 1, away: 1, pk: 'home' }, { home: 1, away: 1 })).toBeNull();
  });
});

describe('aggregatePuchar', () => {
  it('sumuje punkty i kategorie; pomija mecze bez typu/wyniku', () => {
    const agg = aggregatePuchar([
      { prediction: { home: 2, away: 1 }, result: { home: 2, away: 1 } }, // 10
      { prediction: { home: 1, away: 1, pk: 'home' }, result: { home: 1, away: 1, pk: 'home' } }, // 12
      { prediction: { home: 3, away: 0 }, result: { home: 1, away: 0 } }, // 6
      { prediction: { home: 2, away: 0 }, result: { home: 0, away: 1 } }, // 0
      { prediction: null, result: { home: 1, away: 0 } }, // brak typu — nie liczony
      { prediction: { home: 1, away: 0 }, result: null }, // nierozegrany — nie liczony
    ]);
    expect(agg).toEqual({ puch: 28, count6: 1, count8: 0, count10: 1, count12: 1, played: 4 });
  });

  it('remis faktyczny bez result.pk nie jest liczony (played nie rośnie)', () => {
    const agg = aggregatePuchar([
      { prediction: { home: 1, away: 1, pk: 'home' }, result: { home: 1, away: 1 } },
    ]);
    expect(agg).toEqual({ puch: 0, count6: 0, count8: 0, count10: 0, count12: 0, played: 0 });
  });
});
```

- [ ] **Step 2: Uruchomić test — ma FAILować**

Run: `npx vitest run engine/aggregatePuchar.test.ts`
Expected: FAIL („Cannot find module './aggregatePuchar'").

- [ ] **Step 3: Zaimplementować `engine/aggregatePuchar.ts`**

```ts
import { scoreMatchPuchar, type Karne, type PucharPoints } from './scoreMatchPuchar';
import type { PucharPick, PucharResult } from './types';

/** Jeden mecz pucharowy do agregacji: typ uczestnika i faktyczny wynik (null = brak). */
export interface PucharEntry {
  prediction: PucharPick | null;
  result: PucharResult | null;
}

/** Wynik agregacji fazy pucharowej uczestnika. */
export interface PucharAgg {
  /** Suma punktów pucharowych. */
  puch: number;
  count6: number;
  count8: number;
  count10: number;
  count12: number;
  /** Mecze rozegrane (z typem i policzalnym wynikiem). */
  played: number;
}

/**
 * Punkty jednego meczu pucharowego z typu i wyniku. Buduje `Karne` gdy wynik jest remisem
 * (zwycięzca = `result.pk`, krzyżyk uczestnika = `pick.pk ?? null`). Zwraca `null`, gdy wynik
 * to remis bez `result.pk` (nie wiadomo, kto wygrał karne) — taki mecz nie jest punktowany.
 */
export function scorePucharMatch(pick: PucharPick, result: PucharResult): PucharPoints | null {
  if (result.home === result.away) {
    if (result.pk === undefined) return null;
    const karne: Karne = { zwyciezca: result.pk, typ: pick.pk ?? null };
    return scoreMatchPuchar({ home: pick.home, away: pick.away }, { home: result.home, away: result.away }, karne);
  }
  return scoreMatchPuchar({ home: pick.home, away: pick.away }, { home: result.home, away: result.away });
}

/** Agreguje mecze pucharowe uczestnika: suma `puch`, rozkład kategorii {6,8,10,12} i `played`. */
export function aggregatePuchar(entries: PucharEntry[]): PucharAgg {
  const agg: PucharAgg = { puch: 0, count6: 0, count8: 0, count10: 0, count12: 0, played: 0 };
  for (const { prediction, result } of entries) {
    if (!prediction || !result) continue;
    const pts = scorePucharMatch(prediction, result);
    if (pts === null) continue;
    agg.played += 1;
    agg.puch += pts;
    if (pts === 6) agg.count6 += 1;
    else if (pts === 8) agg.count8 += 1;
    else if (pts === 10) agg.count10 += 1;
    else if (pts === 12) agg.count12 += 1;
  }
  return agg;
}
```

Uwaga: `scoreMatchPuchar` eksportuje już `Karne` i `PucharPoints`. `Side` z `engine/types` jest strukturalnie zgodny z `Side` w `scoreMatchPuchar` (`'home'|'away'`).

- [ ] **Step 4: Uruchomić test — ma PRZEJŚĆ**

Run: `npx vitest run engine/aggregatePuchar.test.ts`
Expected: PASS (11 testów).

- [ ] **Step 5: Commit**

```bash
git add engine/aggregatePuchar.ts engine/aggregatePuchar.test.ts
git commit -m "feat(puch): aggregatePuchar + scorePucharMatch (kategorie 6/8/10/12)"
```

---

### Task 4: `generalTable` — `skutBonus` jako najniższy tiebreaker

**Files:**
- Modify: `engine/generalTable.ts`
- Test: `engine/generalTable.test.ts` (dopisać przypadek; jeśli pliku brak — utworzyć)

**Interfaces:**
- Consumes: `ParticipantSeason`, `GeneralRow` z `engine/types`; `rankBy` z `engine/ranking`.
- Produces: `generalTable(participants: readonly (ParticipantSeason & { skutBonus?: number })[]): GeneralRow[]` — bez zmiany sygnatury wyjścia; nowy, najniższy klucz sortowania `skutBonus`.

- [ ] **Step 1: Napisać failing test** (dopisać do `engine/generalTable.test.ts`, lub utworzyć plik)

```ts
import { describe, it, expect } from 'vitest';
import { generalTable } from './generalTable';
import type { ParticipantSeason } from './types';

function base(id: string, over: Partial<ParticipantSeason> = {}): ParticipantSeason {
  return { participantId: id, grI: 10, grII: 10, grIII: 10, bns: 0, puch: 0, hitRate: 0.5, ...over };
}

describe('generalTable — skutBonus tiebreaker', () => {
  it('przy równych pkt/%/puch/grIII/grII/grI wyżej jest większy skutBonus', () => {
    const rows = generalTable([
      { ...base('A'), skutBonus: 0 },
      { ...base('B'), skutBonus: 3 },
    ]);
    expect(rows.map((r) => r.participantId)).toEqual(['B', 'A']);
  });

  it('skutBonus NIE wchodzi do sumy punktów', () => {
    const [row] = generalTable([{ ...base('A', { grI: 10, grII: 0, grIII: 0 }), skutBonus: 3 }]);
    expect(row.points).toBe(10);
    expect(row.total).toBe(10);
  });
});
```

- [ ] **Step 2: Uruchomić test — ma FAILować**

Run: `npx vitest run engine/generalTable.test.ts`
Expected: FAIL (kolejność `['A','B']` zamiast `['B','A']`, bo bez klucza `skutBonus` sort jest stabilny po wejściu).

- [ ] **Step 3: Zmienić `engine/generalTable.ts`**

```ts
import type { ParticipantSeason, GeneralRow } from './types';
import { rankBy } from './ranking';

/**
 * Buduje tabelę ogólną Konkursu 1: suma = grI + grII + grIII + bns + puch,
 * sortowanie: pkt → % → puch → grIII → grII → grI → skutBonus (reguła organizatora,
 * 2026-06-13: „im późniejsze punkty, tym większe znaczenie"; skutBonus = ukryty
 * tiebreaker „as z rękawa", aktywny od fazy pucharowej — patrz bonus skuteczności).
 */
export function generalTable(
  participants: readonly (ParticipantSeason & { skutBonus?: number })[],
): GeneralRow[] {
  const rows = participants.map((p) => ({
    ...p,
    skutBonus: p.skutBonus ?? 0,
    points: p.grI + p.grII + p.grIII + p.bns + p.puch,
  }));
  return rankBy(rows, ['points', 'hitRate', 'puch', 'grIII', 'grII', 'grI', 'skutBonus']).map((r) => ({
    ...r,
    total: r.points,
  }));
}
```

- [ ] **Step 4: Uruchomić test — ma PRZEJŚĆ**

Run: `npx vitest run engine/generalTable.test.ts`
Expected: PASS (wszystkie, w tym nowe 2).

- [ ] **Step 5: Commit**

```bash
git add engine/generalTable.ts engine/generalTable.test.ts
git commit -m "feat(puch): skutBonus jako najniższy tiebreaker tabeli ogólnej"
```

---

### Task 5: Wpięcie pucharu w `compute` (typy, `buildResults`, CLI)

**Files:**
- Modify: `compute/types.ts` (typy wejścia/wyjścia pucharu + `ResultsJson.puchar`)
- Modify: `compute/buildResults.ts` (agregacja `puch`, „%" ogólna, etap `skutBonus`, sekcja `puchar`)
- Modify: `compute/buildResultsCli.ts` (wczytanie `puchar.json` + rozdzielenie `results.puch`)
- Test: `compute/buildResults.test.ts` (dopisać przypadki pucharowe)

**Interfaces:**
- Consumes: `aggregatePuchar`, `scorePucharMatch`, `PucharAgg` z Task 3; `PucharPick`, `PucharResult` z `engine/types`.
- Produces (w `compute/types.ts`):
  - `interface PucharRound { round: string; fixtures: Fixture[]; predictions: Record<string, Record<string, PucharPick>> }`
  - `interface PucharData { rounds: PucharRound[] }`
  - `interface PucharPredictionOut { pick: PucharPick | null; points: number | null }`
  - `interface PucharMatchOut { no: number; home: string; away: string; kickoff: string; result: PucharResult | null; predictions: Record<string, PucharPredictionOut> }`
  - `interface PucharRoundOut { round: string; matches: PucharMatchOut[] }`
  - `interface PucharOut { rounds: PucharRoundOut[] }`
  - `ResultsJson` zyskuje pole `puchar: PucharOut`.
- Produces (w `compute/buildResults.ts`): nowa sygnatura
  `buildResults(roster, turns, results, puchar?: PucharData, puchResults?: Record<string, PucharResult>, generatedAt?): ResultsJson` (domyślnie pusty puchar → zachowanie bez zmian).

- [ ] **Step 1: Dodać typy w `compute/types.ts`**

Po `import` na górze dopisać `PucharPick, PucharResult` do importu z `engine/types`:

```ts
import type { Score, CardStats, PucharPick, PucharResult } from '../engine/types';
```

Przed `export interface ResultsJson` dodać:

```ts
/** Runda pucharowa z ingestu (kształt data/k1/puchar.json → rounds[]). */
export interface PucharRound {
  round: string;
  fixtures: Fixture[];
  predictions: Record<string, Record<string, PucharPick>>;
}
/** Dane pucharowe (kształt data/k1/puchar.json). */
export interface PucharData {
  rounds: PucharRound[];
}
/** Typ uczestnika na mecz pucharowy w wyjściu. */
export interface PucharPredictionOut {
  pick: PucharPick | null;
  points: number | null;
}
/** Mecz pucharowy w wyjściu (sekcja puchar). */
export interface PucharMatchOut {
  no: number;
  home: string;
  away: string;
  kickoff: string;
  result: PucharResult | null;
  predictions: Record<string, PucharPredictionOut>;
}
/** Runda pucharowa w wyjściu. */
export interface PucharRoundOut {
  round: string;
  matches: PucharMatchOut[];
}
/** Sekcja puchar w wyjściu. */
export interface PucharOut {
  rounds: PucharRoundOut[];
}
```

W `ResultsJson` dodać pole (po `turns`):

```ts
  /** Faza pucharowa: rundy → mecze → typy z punktami (widok /puchar). */
  puchar: PucharOut;
```

W ostatnim `export type { ... }` dopisać `PucharPick`, `PucharResult`:

```ts
export type { Group, Participant, Score, CardStats, PucharPick, PucharResult };
```

- [ ] **Step 2: Napisać failing testy** (dopisać do `compute/buildResults.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { buildResults } from './buildResults';
import type { PucharData, PucharResult } from './types';
import type { Participant } from '../ingest/k1/parseGrup1';

const roster2: Participant[] = [
  { id: 'A', group: 'A' },
  { id: 'B', group: 'A' },
];

const puchar1: PucharData = {
  rounds: [
    {
      round: '1/16',
      fixtures: [
        { no: 1, home: 'Kanada', away: 'RPA', kickoff: '' },
        { no: 2, home: 'Brazylia', away: 'Japonia', kickoff: '' },
      ],
      predictions: {
        A: { '1': { home: 2, away: 1 }, '2': { home: 1, away: 1, pk: 'home' } },
        B: { '1': { home: 0, away: 0 } },
      },
    },
  ],
};

describe('buildResults — faza pucharowa', () => {
  it('dolicza puch do tabeli ogólnej i sekcji puchar', () => {
    const puchRes: Record<string, PucharResult> = {
      '1': { home: 2, away: 1 }, // A: 10, B: 0
      '2': { home: 1, away: 1, pk: 'home' }, // A: 12
    };
    const out = buildResults(roster2, [], {}, puchar1, puchRes);
    const a = out.general.find((r) => r.participantId === 'A')!;
    expect(a.puch).toBe(22);
    expect(a.points).toBe(22); // brak punktów grupowych w tym teście
    expect(out.puchar.rounds[0].matches[0].predictions.A.points).toBe(10);
    expect(out.puchar.rounds[0].matches[1].predictions.A.points).toBe(12);
    expect(out.puchar.rounds[0].matches[0].result).toEqual({ home: 2, away: 1 });
  });

  it('„%" tabeli ogólnej wlicza puchar (kategorie >0)', () => {
    const puchRes: Record<string, PucharResult> = { '1': { home: 2, away: 1 } }; // tylko mecz 1
    const out = buildResults(roster2, [], {}, puchar1, puchRes);
    const a = out.general.find((r) => r.participantId === 'A')!;
    // A: 1 mecz pucharowy rozegrany, trafiony → hitRate = 1/1 = 1
    expect(a.hitRate).toBe(1);
    const b = out.general.find((r) => r.participantId === 'B')!;
    // B: 1 mecz rozegrany, pudło → hitRate = 0/1 = 0
    expect(b.hitRate).toBe(0);
  });

  it('bez danych pucharowych zachowuje się jak dotąd (puch=0)', () => {
    const out = buildResults(roster2, [], {});
    expect(out.general.every((r) => r.puch === 0)).toBe(true);
    expect(out.puchar.rounds).toEqual([]);
  });
});
```

- [ ] **Step 3: Uruchomić test — ma FAILować**

Run: `npx vitest run compute/buildResults.test.ts`
Expected: FAIL (sygnatura `buildResults` bez `puchar`/`puchResults`; brak `out.puchar`).

- [ ] **Step 4: Zmienić `compute/buildResults.ts`**

Dodać importy (po istniejących):

```ts
import { aggregatePuchar, scorePucharMatch, type PucharAgg } from '../engine/aggregatePuchar';
import type { PucharData, PucharOut, PucharResult } from './types';
```

Dodać funkcję sekcji `puchar` (obok `buildTurns`):

```ts
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
```

Zmienić sygnaturę `buildResults`:

```ts
export function buildResults(
  roster: Participant[],
  turns: TurnData[],
  results: ResultsByTurn,
  puchar: PucharData = { rounds: [] },
  puchResults: Record<string, PucharResult> = {},
  generatedAt: string = new Date().toISOString(),
): ResultsJson {
```

Po zbudowaniu `seasons` (zaraz po pętli `counts`/`buildSeason`) — najpierw policz puchar per gracz i sezony z `puch`. ZMIEŃ blok `seasons` tak, by `buildSeason` dostawał `puch`, i zbierz `puchAgg`:

```ts
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
```

Dodać etap pucharowy do `skutBonus`. ZMIEŃ obliczenie `skutBonuses`:

```ts
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
```

ZMIEŃ budowę tabeli ogólnej, by używała `genHitRate`, `skutBonus` (tiebreaker) i `played` z pucharem:

```ts
  const general: TableRow[] = generalTable(
    seasons.map((s) => ({
      ...s,
      bns: bonuses[s.participantId] ?? 0,
      hitRate: genHitRate.get(s.participantId)!,
      skutBonus: skutBonuses[s.participantId] ?? 0,
    })),
  ).map((g) => ({
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
    count3: counts.get(g.participantId)!.count3,
    count4: counts.get(g.participantId)!.count4,
    count5: counts.get(g.participantId)!.count5,
    played: counts.get(g.participantId)!.played + puchAgg.get(g.participantId)!.played,
  }));
```

ZMIEŃ `return`, dodając sekcję `puchar`:

```ts
  return {
    generatedAt,
    general,
    groups,
    turns: buildTurns(roster, turns, results),
    puchar: buildPuchar(roster, puchar, puchResults),
    cards,
  };
```

Uwaga: tabela GRUPOWA (`groupRows`/`groups`) zostaje bez zmian — nadal `hitRate: s.hitRate` (sama faza grupowa) i `puch: s.puch`. Hero karty (`totalPointsOf`) bierze z `general` — bez zmian kodu.

Uwaga (ograniczenie świadome): `puchResults` jest płaski po numerze meczu — wystarcza dla jednej rundy 1/16. Wiele rund (Etap B) wymaga zagnieżdżenia per runda; poza zakresem teraz.

- [ ] **Step 5: Zmienić `compute/buildResultsCli.ts`**

```ts
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { buildResults } from './buildResults';
import type { PucharData, PucharResult } from './types';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const DATA_DIR = 'data/k1';
const OUT_DIR = 'public/data';

const turns = readdirSync(DATA_DIR)
  .filter((f) => /^tura-\d+\.json$/.test(f))
  .map((f) => read(`${DATA_DIR}/${f}`))
  .sort((a, b) => a.turn - b.turn);

// Wyniki: rozdzielamy turę grupową (Record<turn,Record<no,Score>>) od pucharu (klucz "puch").
const resultsJson = read(`${DATA_DIR}/results.json`);
const { puch: puchResults = {}, ...turnResults } = resultsJson as { puch?: Record<string, PucharResult> };

// Puchar (opcjonalny — może jeszcze nie istnieć).
const puchar: PucharData = existsSync(`${DATA_DIR}/puchar.json`)
  ? read(`${DATA_DIR}/puchar.json`)
  : { rounds: [] };

const out = buildResults(read(`${DATA_DIR}/roster.json`), turns, turnResults, puchar, puchResults);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(out, null, 2) + '\n');

const lider = out.general[0];
const puchN = out.puchar.rounds.reduce((a, r) => a + r.matches.length, 0);
console.log(
  `OK: ${out.general.length} osob, lider ${lider.participantId} (${lider.points} pkt), ${puchN} meczów puch → ${OUT_DIR}/results.json`,
);
```

- [ ] **Step 6: Uruchomić testy compute — mają PRZEJŚĆ**

Run: `npx vitest run compute/buildResults.test.ts`
Expected: PASS (istniejące + 3 nowe).

- [ ] **Step 7: Pełny zestaw testów + typecheck**

Run: `npm test && npm run typecheck`
Expected: wszystko zielone (silnik + ingest + compute).

- [ ] **Step 8: Zbudować realny `results.json` i zweryfikować**

Run: `npm run build:results`
Expected: `... , N meczów puch → public/data/results.json` (N = 16). Lider bez zmian (brak wyników pucharowych → `puch=0` wszędzie).

Run: `npx tsx -e "const r=require('./public/data/results.json'); console.log('puch rounds:', r.puchar.rounds.length, 'matches:', r.puchar.rounds[0].matches.length, 'A.predictions sample:', Object.keys(r.puchar.rounds[0].matches[0].predictions).length)"`
Expected: `puch rounds: 1 matches: 16 ... 56`

**Weryfikacja braku regresji tabeli ogólnej:** kolejność `general` powinna być identyczna jak przed zmianą, CHYBA że `skutBonus` rozstrzygnął istniejący remis (pkt+%+puch+grIII+grII+grI). Sprawdź:

Run: `git stash && npm run build:results && cp public/data/results.json /tmp/before.json && git stash pop && npm run build:results && npx tsx -e "const a=require('/tmp/before.json').general.map(r=>r.participantId); const b=require('./public/data/results.json').general.map(r=>r.participantId); const diff=a.map((x,i)=>x!==b[i]?i+1+':'+x+'→'+b[i]:null).filter(Boolean); console.log(diff.length?diff.join(', '):'BEZ ZMIAN kolejności')"`
Expected: `BEZ ZMIAN kolejności` LUB krótka lista pozycji rozstrzygniętych przez `skutBonus`. **Jeśli lista niepusta — zgłoś użytkownikowi** (to świadome przesunięcie remisów „asem z rękawa", ale ma być potwierdzone).

- [ ] **Step 9: Commit**

```bash
git add compute/types.ts compute/buildResults.ts compute/buildResultsCli.ts compute/buildResults.test.ts data/k1/results.json public/data/results.json
git commit -m "feat(puch): wpięcie puch w tabelę ogólną (suma, %, skutBonus) + sekcja puchar"
```

---

### Task 6: Widok `/puchar` + link w menu + smoke

**Files:**
- Create: `components/PucharMatchCard.tsx`
- Create: `app/puchar/page.tsx`
- Modify: `app/page.tsx` (link w menu)
- Modify: `scripts/smoke.ts` (sprawdzenie strony `/puchar`)

**Interfaces:**
- Consumes: `PucharMatchOut`, `PucharPick` z `compute/types`; `loadResults` z `app/lib/results`; `PlayerLink` z `app/RetroTable`; `ScreenFrame` z `components/ScreenFrame`; `fmtScore` z `components/MatchCard`.

- [ ] **Step 1: Utworzyć `components/PucharMatchCard.tsx`**

```tsx
// Import wyłącznie typów (granica modułów).
import type { PucharMatchOut, PucharPick } from '../compute/types';
import { PlayerLink } from './RetroTable';

/** "2:1 (k. gosp.)" — wynik pucharowy z dopiskiem o karnych przy remisie. */
function fmtPuchScore(s: { home: number; away: number; pk?: 'home' | 'away' } | null): string {
  if (!s) return '–:–';
  const base = `${s.home}:${s.away}`;
  if (s.home === s.away && s.pk) return `${base} (k. ${s.pk === 'home' ? 'gosp.' : 'gości'})`;
  return base;
}

/** Typ pucharowy gracza w komórce: "1:1 ✚gosp." gdy krzyżyk. */
function fmtPick(p: PucharPick | null): string {
  if (!p) return '—';
  const base = `${p.home}:${p.away}`;
  if (p.home === p.away && p.pk) return `${base} ✚${p.pk === 'home' ? 'gosp.' : 'gości'}`;
  return base;
}

/** Mecz pucharowy: wynik + rozwijana lista typów wszystkich uczestników z punktami.
 *  Natywny <details> — zero klientowego JS, jak MatchCard. */
export function PucharMatchCard({ match }: { match: PucharMatchOut }) {
  const preds = Object.entries(match.predictions).sort(
    ([aId, a], [bId, b]) => (b.points ?? -1) - (a.points ?? -1) || aId.localeCompare(bId, 'pl'),
  );
  return (
    <details className="match-card puch-match-card">
      <summary>
        <span className="match-teams">{match.home} – {match.away}</span>
        <span className="match-score">{fmtPuchScore(match.result)}</span>
      </summary>
      {match.kickoff ? <p className="kickoff">{match.kickoff}</p> : null}
      <div className="screen-body">
        <table className="retro-table">
          <thead>
            <tr><th>GRACZ</th><th className="num">TYP</th><th className="num">PKT</th></tr>
          </thead>
          <tbody>
            {preds.map(([id, p]) => (
              <tr key={id}>
                <td><PlayerLink id={id} /></td>
                <td className="num">{fmtPick(p.pick)}</td>
                <td className="pkt">{p.points ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
```

Uwaga: `PlayerLink` jest w `components/RetroTable.tsx` (zweryfikowane) — import `./RetroTable` z katalogu `components/`, tak jak w `MatchCard.tsx`.

- [ ] **Step 2: Utworzyć `app/puchar/page.tsx`**

```tsx
import { PucharMatchCard } from '../../components/PucharMatchCard';
import { ScreenFrame } from '../../components/ScreenFrame';
import { loadResults } from '../lib/results';

export default function PucharPage() {
  const { puchar } = loadResults();
  return (
    <ScreenFrame title="FAZA PUCHAROWA">
      {puchar.rounds.length === 0 ? (
        <p className="screen-body">Typy pucharowe pojawią się po starcie 1/16 finału.</p>
      ) : (
        puchar.rounds.map((round, idx) => (
          <details key={round.round} className="turn-section" open={idx === puchar.rounds.length - 1}>
            <summary className="turn-heading">★ {round.round} ★</summary>
            {round.matches.map((m) => <PucharMatchCard key={m.no} match={m} />)}
          </details>
        ))
      )}
    </ScreenFrame>
  );
}
```

- [ ] **Step 3: Dodać link w menu `app/page.tsx`**

W tablicy `MENU`, po `'/mecze/'`:

```tsx
  { href: '/puchar/', label: 'FAZA PUCHAROWA' },
```

- [ ] **Step 4: Rozszerzyć `scripts/smoke.ts`**

Po bloku liczącym mecze tur (po linii z `expectedMatches`), dodać sprawdzenie strony `/puchar`:

```ts
// /puchar: liczba kart meczów pucharowych == suma meczów ze wszystkich rund.
const puchHtml = readFileSync('out/puchar/index.html', 'utf8');
const puchMatches = (puchHtml.match(/class="match-card puch-match-card"/g) ?? []).length;
const expectedPuch = results.puchar.rounds.reduce((acc: number, r: { matches: unknown[] }) => acc + r.matches.length, 0);
if (puchMatches !== expectedPuch) {
  console.error(`SMOKE FAIL: ${puchMatches} meczów puch w HTML, oczekiwano ${expectedPuch}`);
  process.exit(1);
}
```

W tablicy markerów menu (`['pixel-ball', 'music-toggle', 'press-start', 'Designed by MarcinS']`) dopisać `'FAZA PUCHAROWA'`.

- [ ] **Step 5: Build + smoke**

Run: `npm run build && npm run smoke`
Expected: build OK; `SMOKE OK: ...` (bez FAIL). Strona `out/puchar/index.html` zawiera 16 kart `puch-match-card`.

- [ ] **Step 6: Pełna bramka jakości**

Run: `npm test && npm run typecheck && npm run build && npm run smoke`
Expected: wszystko zielone.

- [ ] **Step 7: Commit**

```bash
git add components/PucharMatchCard.tsx app/puchar/page.tsx app/page.tsx scripts/smoke.ts public/data/results.json
git commit -m "feat(puch): widok /puchar (rundy → mecze → typy) + link w menu + smoke"
```

---

## Po Etapie A

- Reingest nowszej bazy (`Baza puch v2.xlsx` jutro): podmienić `BAZA` w `ingest/buildPuchar.ts`, `npm run build:puchar`, `npm run build:results`, commit.
- Wyniki meczów 1/16 (ręcznie do czasu robota): `data/k1/results.json` klucz `"puch"`: `{ "1": {"home":2,"away":1}, "4": {"home":1,"away":1,"pk":"home"} }`, potem `npm run build:results`.
- **Etap B (osobny spec/plan):** robot football-data.org dla pucharu — dopasowanie po **dacie**, odczyt zwycięzcy karnych, terminy meczów jako data+godzina w **czasie polskim (Europe/Warsaw)** wstawiane w `kickoff` fixture'ów.

## Self-Review (autor planu)

- **Pokrycie specu:** parser (Task 1) ✓, CLI/dane (Task 2) ✓, agregacja + reguła karnych (Task 3) ✓, „%" ogólna + `puch` w sumie/tiebreakerze (Task 4–5) ✓, `skutBonus` etap pucharowy (Task 5) ✓, widok `/puchar` (Task 6) ✓, model danych `puchar.json`/`results.puch` (Task 2/5) ✓, tolerancja braków (Task 1, zweryfikowane w Task 2 step 3) ✓. Etap B świadomie poza planem (sekcja „Po Etapie A").
- **Spójność typów:** `PucharPick`/`PucharResult`/`Side` w `engine/types`, reużywane w `ingest`, `engine/aggregatePuchar`, `compute/types`. `scorePucharMatch` zwraca `PucharPoints | null` — `buildPuchar` i `aggregatePuchar` zgodne. `generalTable` przyjmuje `skutBonus?` i sortuje nim ostatnim kluczem; `buildResults` podaje `skutBonus` do `generalTable` i osobno do `TableRow`.
- **Placeholdery:** brak — każdy krok ma realny kod/komendę. Ścieżki importów (`PlayerLink` z `./RetroTable`, pliki testowe `compute/buildResults.test.ts` i `engine/generalTable.test.ts`) zweryfikowane przed zapisem planu.
