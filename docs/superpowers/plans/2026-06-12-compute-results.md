# Compute — sklejka silnika + wyniki-atrapy → `results.json` (Plan implementacji)

> **Dla wykonawcy (agent/człowiek):** WYMAGANY SUB-SKILL: użyj `superpowers:subagent-driven-development` (zalecane) lub `superpowers:executing-plans`, aby wykonać ten plan zadanie po zadaniu. Kroki używają składni checkbox (`- [ ]`).

**Cel:** Zbudować moduł `compute/`: czysta funkcja `buildResults` (roster + typy + wyniki → tabele), deterministyczny generator wyników-atrap oraz CLI produkujące `public/data/results.json`.

**Architektura:** `compute/` stosuje silnik (`engine/`) do danych kanonicznych z ingestu. Czysta funkcja liczy (testowalna bez plików), dwa cienkie CLI robią I/O: `seedResults` (atrapy → `data/k1/results.json`) i `buildResultsCli` (→ `public/data/results.json`). Tabela ogólna przez `generalTable`, tabele grup A–H przez `rankBy` z kluczami `pkt → % → grIII → grI → grII`.

**Tech Stack:** TypeScript 5, Vitest 2, tsx, Node.js. Ground truth testów integracyjnych = realne `data/k1/{roster,tura-1}.json` + wygenerowane atrapy.

**Źródło prawdy (spec):** `docs/superpowers/specs/2026-06-12-compute-results-design.md`.

---

## Struktura plików (po wykonaniu)

```
compute/
  types.ts                                  — typy wejścia/wyjścia + ALL_GROUPS
  seed.ts             seed.test.ts          — czysty generator atrap (mulberry32)
  seedResults.ts                            — CLI: atrapy → data/k1/results.json
  buildResults.ts     buildResults.test.ts  — czysta sklejka z silnikiem
  buildResultsCli.ts                        — CLI: → public/data/results.json
data/k1/results.json                        — atrapy (później realne wyniki)
public/data/results.json                    — wyjście dla UI
```

---

## Zadanie 0: Konfiguracja

**Pliki:**
- Modify: `package.json` (scripts)
- Modify: `tsconfig.json` (include)

- [ ] **Krok 1: Dodaj skrypty npm** — w `package.json` zamień blok `scripts` na:

```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "build:k1": "tsx ingest/buildK1.ts",
    "seed:results": "tsx compute/seedResults.ts",
    "build:results": "tsx compute/buildResultsCli.ts"
  },
```

- [ ] **Krok 2: Rozszerz include** — w `tsconfig.json` zamień:

```json
  "include": ["engine", "ingest", "compute"]
```

- [ ] **Krok 3: Commit**

```bash
git add package.json tsconfig.json
git commit -m "chore(compute): skrypty npm + tsconfig include compute"
```

---

## Zadanie 1: Typy (`compute/types.ts`)

**Pliki:**
- Utwórz: `compute/types.ts`

- [ ] **Krok 1: Utwórz `compute/types.ts`**

```typescript
import type { Score } from '../engine/types';
import type { Group, Participant } from '../ingest/k1/parseGrup1';

/** Wyniki meczów: numer tury → numer meczu → wynik. Brak klucza = mecz nierozegrany. */
export type ResultsByTurn = Record<string, Record<string, Score>>;

/** Dane tury z ingestu (kształt data/k1/tura-N.json; z fixtures potrzebny tylko numer). */
export interface TurnData {
  turn: number;
  fixtures: { no: number }[];
  predictions: Record<string, Record<string, Score>>;
}

/** Wiersz tabeli (ogólnej lub grupowej) w wyjściowym results.json. */
export interface TableRow {
  participantId: string;
  group: Group;
  /** Pozycja w TEJ tabeli (ogólnej lub grupowej). */
  position: number;
  /** Suma sezonu = grI + grII + grIII + bns + puch. */
  points: number;
  grI: number;
  grII: number;
  grIII: number;
  bns: number;
  puch: number;
  /** Sezonowe „%" (sumarycznie: łączne trafienia / łączne rozegrane). */
  hitRate: number;
  count3: number;
  count4: number;
  count5: number;
  played: number;
}

/** Wyjście dla UI: public/data/results.json. */
export interface ResultsJson {
  generatedAt: string;
  general: TableRow[];
  groups: Record<Group, TableRow[]>;
}

export const ALL_GROUPS: Group[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export type { Group, Participant, Score };
```

- [ ] **Krok 2: Typecheck**

Uruchom: `npm run typecheck`
Oczekiwane: PASS.

- [ ] **Krok 3: Commit**

```bash
git add compute/types.ts
git commit -m "feat(compute): typy wejscia/wyjscia results.json"
```

---

## Zadanie 2: Generator atrap (`compute/seed.ts`)

**Pliki:**
- Utwórz: `compute/seed.ts`
- Test: `compute/seed.test.ts`

- [ ] **Krok 1: Napisz test, który ma się nie powieść**

`compute/seed.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { seedTurnResults } from './seed';

describe('seedTurnResults', () => {
  it('jest deterministyczny (to samo ziarno = ten sam wynik)', () => {
    expect(seedTurnResults(24, 123)).toEqual(seedTurnResults(24, 123));
  });

  it('generuje komplet meczow 1..N z bramkami calkowitymi 0-4', () => {
    const r = seedTurnResults(24, 123);
    expect(Object.keys(r)).toHaveLength(24);
    for (let no = 1; no <= 24; no++) {
      const s = r[String(no)];
      expect(Number.isInteger(s.home)).toBe(true);
      expect(s.home).toBeGreaterThanOrEqual(0);
      expect(s.home).toBeLessThanOrEqual(4);
      expect(Number.isInteger(s.away)).toBe(true);
      expect(s.away).toBeGreaterThanOrEqual(0);
      expect(s.away).toBeLessThanOrEqual(4);
    }
  });

  it('rozne ziarna daja rozne wyniki', () => {
    expect(seedTurnResults(24, 1)).not.toEqual(seedTurnResults(24, 2));
  });
});
```

- [ ] **Krok 2: Uruchom test — ma FAIL**

Uruchom: `npx vitest run compute/seed.test.ts`
Oczekiwane: FAIL — nie można rozwiązać importu `./seed`.

- [ ] **Krok 3: Napisz implementację**

`compute/seed.ts`:

```typescript
import type { Score } from './types';

/** Deterministyczny PRNG mulberry32 — powtarzalne atrapy przy stałym ziarnie. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generuje wyniki-atrapy meczów 1..matchCount (bramki 0–4), deterministycznie. */
export function seedTurnResults(matchCount: number, seed: number): Record<string, Score> {
  const rnd = mulberry32(seed);
  const out: Record<string, Score> = {};
  for (let no = 1; no <= matchCount; no++) {
    out[String(no)] = {
      home: Math.floor(rnd() * 5),
      away: Math.floor(rnd() * 5),
    };
  }
  return out;
}
```

- [ ] **Krok 4: Uruchom test — ma PASS**

Uruchom: `npx vitest run compute/seed.test.ts`
Oczekiwane: PASS (3 testy).

- [ ] **Krok 5: Commit**

```bash
git add compute/seed.ts compute/seed.test.ts
git commit -m "feat(compute): deterministyczny generator wynikow-atrap"
```

---

## Zadanie 3: CLI atrap (`compute/seedResults.ts`) + dane

**Pliki:**
- Utwórz: `compute/seedResults.ts`
- Utwórz (wygenerowany): `data/k1/results.json`

- [ ] **Krok 1: Napisz CLI**

`compute/seedResults.ts`:

```typescript
import { writeFileSync } from 'node:fs';
import { seedTurnResults } from './seed';

// Stałe ziarno = powtarzalne atrapy. Plik podmienia się później na realne wyniki.
const SEED = 20260611;
const OUT = 'data/k1/results.json';

const results = { '1': seedTurnResults(24, SEED) };
writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');
console.log(`OK: atrapy wynikow tury 1 (24 mecze) → ${OUT}`);
```

- [ ] **Krok 2: Uruchom**

Uruchom: `npm run seed:results`
Oczekiwane: `OK: atrapy wynikow tury 1 (24 mecze) → data/k1/results.json`; powstaje plik z kluczem `"1"` i 24 meczami.

- [ ] **Krok 3: Zweryfikuj determinizm pliku**

Uruchom: `node -e "const r=require('./data/k1/results.json'); console.log(Object.keys(r['1']).length, JSON.stringify(r['1']['1']))"`
Oczekiwane: `24 {"home":H,"away":A}` z H,A ∈ 0..4. Uruchom `npm run seed:results` drugi raz i sprawdź `git diff --stat data/k1/results.json` → brak zmian.

- [ ] **Krok 4: Commit (CLI + dane)**

```bash
git add compute/seedResults.ts data/k1/results.json
git commit -m "feat(compute): CLI seedResults + atrapy wynikow tury 1"
```

---

## Zadanie 4: Sklejka (`compute/buildResults.ts`)

**Pliki:**
- Utwórz: `compute/buildResults.ts`
- Test: `compute/buildResults.test.ts`

- [ ] **Krok 1: Napisz test, który ma się nie powieść**

`compute/buildResults.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildResults } from './buildResults';
import { ALL_GROUPS } from './types';
import type { Participant, ResultsByTurn, TurnData } from './types';

const roster: Participant[] = [
  { id: 'a1', group: 'A' },
  { id: 'a2', group: 'A' },
  { id: 'b1', group: 'B' },
  { id: 'b2', group: 'B' },
];

const turn1: TurnData = {
  turn: 1,
  fixtures: [{ no: 1 }, { no: 2 }, { no: 3 }],
  predictions: {
    a1: { '1': { home: 2, away: 1 }, '2': { home: 1, away: 1 }, '3': { home: 1, away: 0 } },
    a2: { '1': { home: 1, away: 0 }, '2': { home: 1, away: 0 } },
    b1: { '1': { home: 5, away: 0 } },
    b2: {},
  },
};

// Mecz 3 bez wyniku = nierozegrany (typ a1 na mecz 3 nie może nic dać).
const results: ResultsByTurn = {
  '1': { '1': { home: 2, away: 1 }, '2': { home: 0, away: 0 } },
};

const out = buildResults(roster, [turn1], results, '2026-06-12T00:00:00Z');

describe('buildResults (syntetycznie)', () => {
  it('liczy punkty wg scoreMatchK1 i rankuje tabele ogolna', () => {
    // a1: 5 (dokladny 2:1) + 4 (remis z trafiona roznica) = 9
    // a2: 4 (wygrana z trafiona roznica) + 0 (typ wygranej, byl remis) = 4
    // b1: 3 (wygrana, zla roznica) + 0 (brak typu na rozegranym meczu) = 3
    // b2: 0 (brak typow) = 0
    expect(out.general.map((r) => [r.participantId, r.points, r.position])).toEqual([
      ['a1', 9, 1],
      ['a2', 4, 2],
      ['b1', 3, 3],
      ['b2', 0, 4],
    ]);
  });

  it('kategorie, played i hitRate; mecz bez wyniku pominiety', () => {
    expect(out.general[0]).toMatchObject({ count5: 1, count4: 1, count3: 0, played: 2, hitRate: 1 });
    expect(out.general[2]).toMatchObject({ count3: 1, played: 2, hitRate: 0.5 });
  });

  it('brak tur II/III daje grII=grIII=0 (bns/puch tez 0)', () => {
    expect(out.general[0]).toMatchObject({ grI: 9, grII: 0, grIII: 0, bns: 0, puch: 0 });
  });

  it('tabele grupowe: tylko swoi, wlasne pozycje, te same punkty co w ogolnej', () => {
    expect(out.groups.A.map((r) => [r.participantId, r.position])).toEqual([['a1', 1], ['a2', 2]]);
    expect(out.groups.B.map((r) => [r.participantId, r.position])).toEqual([['b1', 1], ['b2', 2]]);
    expect(out.groups.C).toEqual([]);
    const a2General = out.general.find((r) => r.participantId === 'a2')!;
    const a2Group = out.groups.A.find((r) => r.participantId === 'a2')!;
    expect(a2Group.points).toBe(a2General.points);
  });

  it('generatedAt przechodzi z parametru', () => {
    expect(out.generatedAt).toBe('2026-06-12T00:00:00Z');
  });
});

import { readFileSync } from 'node:fs';

describe('buildResults (realne dane + atrapy)', () => {
  const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
  const real = buildResults(
    read('data/k1/roster.json'),
    [read('data/k1/tura-1.json')],
    read('data/k1/results.json'),
    'test',
  );

  it('56 osob w ogolnej, kazda grupa A-H po 7', () => {
    expect(real.general).toHaveLength(56);
    for (const g of ALL_GROUPS) expect(real.groups[g]).toHaveLength(7);
  });

  it('pozycje 1..56 bez dziur; lider ma maksymalne punkty', () => {
    expect(real.general.map((r) => r.position)).toEqual(
      Array.from({ length: 56 }, (_, i) => i + 1),
    );
    const max = Math.max(...real.general.map((r) => r.points));
    expect(real.general[0].points).toBe(max);
  });

  it('kazdy rozegral co najwyzej 24 mecze', () => {
    for (const r of real.general) expect(r.played).toBeLessThanOrEqual(24);
  });
});
```

- [ ] **Krok 2: Uruchom test — ma FAIL**

Uruchom: `npx vitest run compute/buildResults.test.ts`
Oczekiwane: FAIL — nie można rozwiązać importu `./buildResults`.

- [ ] **Krok 3: Napisz implementację**

`compute/buildResults.ts`:

```typescript
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
```

- [ ] **Krok 4: Uruchom test — ma PASS**

Uruchom: `npx vitest run compute/buildResults.test.ts`
Oczekiwane: PASS (8 testów: 5 syntetycznych + 3 integracyjne).

- [ ] **Krok 5: Typecheck**

Uruchom: `npm run typecheck`
Oczekiwane: PASS.

- [ ] **Krok 6: Commit**

```bash
git add compute/buildResults.ts compute/buildResults.test.ts
git commit -m "feat(compute): buildResults - sklejka silnika z danymi"
```

---

## Zadanie 5: CLI wyjścia (`compute/buildResultsCli.ts`) + wygenerowanie

**Pliki:**
- Utwórz: `compute/buildResultsCli.ts`
- Utwórz (wygenerowany): `public/data/results.json`

- [ ] **Krok 1: Napisz CLI**

`compute/buildResultsCli.ts`:

```typescript
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildResults } from './buildResults';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const OUT_DIR = 'public/data';

const out = buildResults(
  read('data/k1/roster.json'),
  [read('data/k1/tura-1.json')],
  read('data/k1/results.json'),
);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(out, null, 2) + '\n');

const lider = out.general[0];
console.log(
  `OK: ${out.general.length} osob, lider ${lider.participantId} (${lider.points} pkt) → ${OUT_DIR}/results.json`,
);
```

- [ ] **Krok 2: Uruchom**

Uruchom: `npm run build:results`
Oczekiwane: `OK: 56 osob, lider <ID> (<N> pkt) → public/data/results.json`.

- [ ] **Krok 3: Zweryfikuj wyjście**

Uruchom: `node -e "const r=require('./public/data/results.json'); console.log(r.general.length, r.general[0].participantId, r.general[0].points, r.groups.A.length)"`
Oczekiwane: `56 <lider> <pkt> 7`.

- [ ] **Krok 4: Pełny przebieg testów + typecheck**

Uruchom: `npm test` i `npm run typecheck`
Oczekiwane: wszystkie testy zielone (50 dotychczasowych + 11 nowych: 3 seed + 8 buildResults = 61), typecheck czysty.

- [ ] **Krok 5: Commit (CLI + dane)**

```bash
git add compute/buildResultsCli.ts public/data/results.json
git commit -m "feat(compute): CLI buildResults + wygenerowany public/data/results.json"
```

---

## Definicja ukończenia

- `npm test` → 61 testów zielonych (silnik 27 + ingest 23 + compute 11).
- `npm run typecheck` → bez błędów.
- `npm run seed:results` → deterministyczne `data/k1/results.json` (drugi run = brak diffu).
- `npm run build:results` → `public/data/results.json`: `general` 56 wierszy z pozycjami, `groups` A–H po 7.
- Granice: `compute/` zna silnik i model kanoniczny, nie zna Excela; silnik i ingest niezmienione.

## Następne plany (poza zakresem)

1. **Render Next.js (Faza 1)** — selektor uczestnika, tabele, statystyki z `public/data/results.json`.
2. **Tury 2/3** — dojdą w masterze; format `results.json` już je przewiduje.
3. **Konkurs 2, faza pucharowa ×2, bns** — po decyzjach organizatora.
