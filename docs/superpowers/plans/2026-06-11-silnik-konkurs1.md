# Plan implementacji — Rdzeń silnika Konkursu 1

> **Dla wykonawcy (agent/człowiek):** WYMAGANY SUB-SKILL: użyj `superpowers:subagent-driven-development` (zalecane) lub `superpowers:executing-plans`, aby wykonać ten plan zadanie po zadaniu. Kroki używają składni checkbox (`- [ ]`) do śledzenia postępu.

**Cel:** Zbudować czysty, w pełni przetestowany silnik punktacji Konkursu 1 (faza grupowa): punktacja pojedynczego meczu, agregacja tury, tabele 8 grup konkursowych z tiebreakerami oraz tabela ogólna.

**Architektura:** Czyste, deterministyczne funkcje TypeScript bez zależności od UI ani Excela. Wspólne typy kanoniczne w jednym module; każda funkcja w osobnym, skupionym pliku z testami obok. Tabele (grupowa i ogólna) korzystają z jednej, wspólnej funkcji rankującej (DRY).

**Stack:** TypeScript 5, Vitest 2, Node.js (npm). Środowisko: Windows / PowerShell.

**Poza zakresem (świadomie):** parser Excela (ingest), Konkurs 2, faza pucharowa ×2, moduł bonusu `bns` (na razie wartość wejściowa, domyślnie 0), UI, statystyki, komentarze. Te elementy trafią do osobnych planów.

**Źródło prawdy:** `docs/superpowers/specs/2026-06-11-typowanie-mundial-design.md`, sekcje 2.1–2.2. Reguła meczu: trafiony rezultat = 3, + trafiona różnica bramek = +1 (też remisy), + dokładny wynik = +1; wartość ∈ {0,3,4,5}. Tiebreakery tabeli: punkty → „%" (= trafienia/rozegrane) → liczba dokładnych (5) → liczba „4".

---

## Struktura plików (po wykonaniu planu)

- `package.json` — skrypty (`test`, `typecheck`) i devDependencies.
- `tsconfig.json` — konfiguracja TypeScript (strict).
- `.gitignore` — `node_modules/` itd.
- `engine/types.ts` — typy kanoniczne silnika (jedyne źródło typów).
- `engine/scoreMatch.ts` + `engine/scoreMatch.test.ts` — punktacja pojedynczego meczu.
- `engine/aggregate.ts` + `engine/aggregate.test.ts` — agregacja jednej tury uczestnika.
- `engine/ranking.ts` + `engine/ranking.test.ts` — wspólna funkcja rankująca z tiebreakerami.
- `engine/generalTable.ts` + `engine/generalTable.test.ts` — tabela ogólna (suma + ranking).
- `engine/index.ts` — publiczny barrel export silnika.

---

## Zadanie 1: Inicjalizacja projektu i narzędzi

**Pliki:**
- Utwórz: `package.json`, `tsconfig.json`, `.gitignore`

- [ ] **Krok 1: Utwórz `.gitignore`**

```gitignore
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Krok 2: Utwórz `package.json`**

```json
{
  "name": "typowanie-mundial",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Krok 3: Utwórz `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["engine"]
}
```

- [ ] **Krok 4: Zainstaluj zależności**

Uruchom: `npm install`
Oczekiwane: utworzony `node_modules/` i `package-lock.json`, brak błędów.

- [ ] **Krok 5: Zweryfikuj, że Vitest działa (brak testów to OK)**

Uruchom: `npm test`
Oczekiwane: Vitest startuje i kończy z komunikatem typu „No test files found" (kod wyjścia może być != 0 — to oczekiwane na tym etapie, bo nie ma jeszcze testów).

- [ ] **Krok 6: Zainicjuj repozytorium git i pierwszy commit**

```bash
git init
git add .gitignore package.json package-lock.json tsconfig.json
git commit -m "chore: inicjalizacja projektu (TypeScript + Vitest)"
```

---

## Zadanie 2: Typy kanoniczne silnika

**Pliki:**
- Utwórz: `engine/types.ts`

- [ ] **Krok 1: Utwórz `engine/types.ts` z pełnym kompletem typów**

```typescript
// Typy kanoniczne silnika punktacji. Jedyne źródło prawdy o kształcie danych.

/** Wynik meczu / typ uczestnika: bramki gospodarzy i gości. */
export interface Score {
  home: number;
  away: number;
}

/** Punkty za pojedynczy mecz Konkursu 1 (faza grupowa). */
export type MatchPoints = 0 | 3 | 4 | 5;

/** Pojedynczy mecz w turze: typ uczestnika i faktyczny wynik (null = brak). */
export interface MatchEntry {
  /** Typ uczestnika; null = uczestnik nie wytypował meczu. */
  prediction: Score | null;
  /** Faktyczny wynik; null = mecz jeszcze nierozegrany. */
  result: Score | null;
}

/** Wynik agregacji jednej tury uczestnika. */
export interface TurnScore {
  /** Suma punktów = #3×3 + #4×4 + #5×5. */
  points: number;
  count0: number;
  count3: number;
  count4: number;
  count5: number;
  /** Liczba rozegranych meczów (z wynikiem). */
  played: number;
  /** „%" = (count3+count4+count5) / played; 0 gdy played=0. */
  hitRate: number;
}

/** Wiersz wejściowy do rankingu (tabela grupowa lub ogólna). */
export interface RankableRow {
  participantId: string;
  /** Punkty będące podstawą sortowania. */
  points: number;
  /** „%" — pierwszy tiebreaker. */
  hitRate: number;
  /** Liczba dokładnych wyników (5) — drugi tiebreaker. */
  exactCount: number;
  /** Liczba „4" — trzeci tiebreaker. */
  fourCount: number;
}

/** Wiersz po rankingu z przypisaną pozycją (1 = najlepszy). */
export interface RankedRow extends RankableRow {
  position: number;
}

/** Dorobek uczestnika w całej fazie grupowej + komponenty tabeli ogólnej. */
export interface ParticipantSeason {
  participantId: string;
  grI: number;
  grII: number;
  grIII: number;
  /** Bonus grupowy — domyślnie 0 (moduł konfigurowalny w przyszłości). */
  bns: number;
  /** Faza pucharowa — domyślnie 0 (poza zakresem tego planu). */
  puch: number;
  /** Tiebreakery sezonowe (zagregowane ze wszystkich tur). */
  hitRate: number;
  exactCount: number;
  fourCount: number;
}

/** Wiersz tabeli ogólnej: ranking + jawna suma. */
export interface GeneralRow extends RankedRow {
  /** Suma = grI + grII + grIII + bns + puch (= points). */
  total: number;
}
```

- [ ] **Krok 2: Zweryfikuj kompilację typów**

Uruchom: `npm run typecheck`
Oczekiwane: PASS (brak błędów).

- [ ] **Krok 3: Commit**

```bash
git add engine/types.ts
git commit -m "feat(engine): typy kanoniczne silnika punktacji"
```

---

## Zadanie 3: Punktacja pojedynczego meczu (`scoreMatchK1`)

**Pliki:**
- Utwórz: `engine/scoreMatch.ts`
- Test: `engine/scoreMatch.test.ts`

- [ ] **Krok 1: Napisz test, który ma się nie powieść**

`engine/scoreMatch.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { scoreMatchK1 } from './scoreMatch';

describe('scoreMatchK1', () => {
  it('dokładny wynik (wygrana) = 5', () => {
    expect(scoreMatchK1({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(5);
  });

  it('dokładny wynik (remis) = 5', () => {
    expect(scoreMatchK1({ home: 1, away: 1 }, { home: 1, away: 1 })).toBe(5);
  });

  it('trafiona różnica bramek bez dokładnego wyniku (wygrana) = 4', () => {
    expect(scoreMatchK1({ home: 2, away: 1 }, { home: 3, away: 2 })).toBe(4);
  });

  it('trafiona różnica bramek na remisie = 4', () => {
    expect(scoreMatchK1({ home: 1, away: 1 }, { home: 2, away: 2 })).toBe(4);
  });

  it('trafiony rezultat bez trafionej różnicy = 3', () => {
    expect(scoreMatchK1({ home: 2, away: 0 }, { home: 1, away: 0 })).toBe(3);
  });

  it('nietrafiony rezultat = 0', () => {
    expect(scoreMatchK1({ home: 2, away: 1 }, { home: 0, away: 1 })).toBe(0);
  });

  it('typowany remis, faktyczna wygrana = 0', () => {
    expect(scoreMatchK1({ home: 1, away: 1 }, { home: 2, away: 1 })).toBe(0);
  });

  it('bezbramkowy remis trafiony co do wyniku = 5', () => {
    expect(scoreMatchK1({ home: 0, away: 0 }, { home: 0, away: 0 })).toBe(5);
  });
});
```

- [ ] **Krok 2: Uruchom test — ma FAIL**

Uruchom: `npx vitest run engine/scoreMatch.test.ts`
Oczekiwane: FAIL — nie można rozwiązać importu `./scoreMatch` / `scoreMatchK1 is not a function`.

- [ ] **Krok 3: Napisz minimalną implementację**

`engine/scoreMatch.ts`:

```typescript
import type { Score, MatchPoints } from './types';

/** Znak rezultatu: 1 = gospodarz wygrywa, 0 = remis, -1 = goście wygrywają. */
function outcome(s: Score): number {
  return Math.sign(s.home - s.away);
}

/** Różnica bramek (gospodarz − goście). */
function diff(s: Score): number {
  return s.home - s.away;
}

/**
 * Punktacja meczu Konkursu 1 (faza grupowa).
 * 3 za trafiony rezultat, +1 za trafioną różnicę bramek, +1 za dokładny wynik.
 * Zwraca 0 | 3 | 4 | 5 (sekcja 2.1 specyfikacji).
 */
export function scoreMatchK1(typ: Score, wynik: Score): MatchPoints {
  if (outcome(typ) !== outcome(wynik)) {
    return 0;
  }
  if (diff(typ) !== diff(wynik)) {
    return 3;
  }
  if (typ.home === wynik.home && typ.away === wynik.away) {
    return 5;
  }
  return 4;
}
```

- [ ] **Krok 4: Uruchom test — ma PASS**

Uruchom: `npx vitest run engine/scoreMatch.test.ts`
Oczekiwane: PASS (8 testów).

- [ ] **Krok 5: Commit**

```bash
git add engine/scoreMatch.ts engine/scoreMatch.test.ts
git commit -m "feat(engine): punktacja pojedynczego meczu K1"
```

---

## Zadanie 4: Agregacja tury (`aggregateTurn`)

**Pliki:**
- Utwórz: `engine/aggregate.ts`
- Test: `engine/aggregate.test.ts`

- [ ] **Krok 1: Napisz test, który ma się nie powieść**

`engine/aggregate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { aggregateTurn } from './aggregate';

describe('aggregateTurn', () => {
  it('liczy sumę, kategorie i %', () => {
    const turn = aggregateTurn([
      { prediction: { home: 2, away: 1 }, result: { home: 2, away: 1 } }, // 5
      { prediction: { home: 2, away: 1 }, result: { home: 3, away: 2 } }, // 4
      { prediction: { home: 2, away: 0 }, result: { home: 1, away: 0 } }, // 3
      { prediction: { home: 2, away: 1 }, result: { home: 0, away: 1 } }, // 0
    ]);
    expect(turn.points).toBe(12); // 5+4+3+0
    expect(turn.count5).toBe(1);
    expect(turn.count4).toBe(1);
    expect(turn.count3).toBe(1);
    expect(turn.count0).toBe(1);
    expect(turn.played).toBe(4);
    expect(turn.hitRate).toBeCloseTo(3 / 4);
  });

  it('pomija mecze nierozegrane (result === null)', () => {
    const turn = aggregateTurn([
      { prediction: { home: 1, away: 0 }, result: { home: 1, away: 0 } }, // 5
      { prediction: { home: 1, away: 0 }, result: null },                 // pominięty
    ]);
    expect(turn.played).toBe(1);
    expect(turn.points).toBe(5);
    expect(turn.hitRate).toBe(1);
  });

  it('brak typu na rozegranym meczu liczy 0 pkt', () => {
    const turn = aggregateTurn([
      { prediction: null, result: { home: 1, away: 0 } },
    ]);
    expect(turn.played).toBe(1);
    expect(turn.points).toBe(0);
    expect(turn.count0).toBe(1);
    expect(turn.hitRate).toBe(0);
  });

  it('pusta tura daje zerowy wynik i hitRate=0', () => {
    const turn = aggregateTurn([]);
    expect(turn.played).toBe(0);
    expect(turn.points).toBe(0);
    expect(turn.hitRate).toBe(0);
  });
});
```

- [ ] **Krok 2: Uruchom test — ma FAIL**

Uruchom: `npx vitest run engine/aggregate.test.ts`
Oczekiwane: FAIL — `aggregateTurn` nie istnieje.

- [ ] **Krok 3: Napisz minimalną implementację**

`engine/aggregate.ts`:

```typescript
import type { MatchEntry, TurnScore } from './types';
import { scoreMatchK1 } from './scoreMatch';

/**
 * Agreguje jedną turę uczestnika: sumuje punkty i zlicza kategorie 0/3/4/5.
 * Mecze nierozegrane (result === null) są pomijane.
 * Brak typu (prediction === null) na rozegranym meczu = 0 pkt.
 */
export function aggregateTurn(entries: MatchEntry[]): TurnScore {
  let points = 0;
  let count0 = 0;
  let count3 = 0;
  let count4 = 0;
  let count5 = 0;
  let played = 0;

  for (const entry of entries) {
    if (entry.result === null) {
      continue;
    }
    played += 1;
    const p = entry.prediction === null
      ? 0
      : scoreMatchK1(entry.prediction, entry.result);
    points += p;
    if (p === 0) count0 += 1;
    else if (p === 3) count3 += 1;
    else if (p === 4) count4 += 1;
    else count5 += 1;
  }

  const hits = count3 + count4 + count5;
  return {
    points,
    count0,
    count3,
    count4,
    count5,
    played,
    hitRate: played === 0 ? 0 : hits / played,
  };
}
```

- [ ] **Krok 4: Uruchom test — ma PASS**

Uruchom: `npx vitest run engine/aggregate.test.ts`
Oczekiwane: PASS (4 testy).

- [ ] **Krok 5: Commit**

```bash
git add engine/aggregate.ts engine/aggregate.test.ts
git commit -m "feat(engine): agregacja tury uczestnika"
```

---

## Zadanie 5: Wspólny ranking z tiebreakerami (`rankRows`)

**Pliki:**
- Utwórz: `engine/ranking.ts`
- Test: `engine/ranking.test.ts`

- [ ] **Krok 1: Napisz test, który ma się nie powieść**

`engine/ranking.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { rankRows } from './ranking';
import type { RankableRow } from './types';

const row = (over: Partial<RankableRow> & { participantId: string }): RankableRow => ({
  points: 0,
  hitRate: 0,
  exactCount: 0,
  fourCount: 0,
  ...over,
});

describe('rankRows', () => {
  it('sortuje malejąco po punktach i przypisuje pozycje', () => {
    const out = rankRows([
      row({ participantId: 'a', points: 10 }),
      row({ participantId: 'b', points: 20 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['b', 'a']);
    expect(out[0].position).toBe(1);
    expect(out[1].position).toBe(2);
  });

  it('przy remisie punktowym decyduje wyższy %', () => {
    const out = rankRows([
      row({ participantId: 'a', points: 10, hitRate: 0.4, exactCount: 5, fourCount: 5 }),
      row({ participantId: 'b', points: 10, hitRate: 0.6, exactCount: 1, fourCount: 1 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['b', 'a']);
  });

  it('przy remisie pkt i % decyduje liczba dokładnych (5), potem liczba 4', () => {
    const out = rankRows([
      row({ participantId: 'a', points: 10, hitRate: 0.5, exactCount: 2, fourCount: 9 }),
      row({ participantId: 'b', points: 10, hitRate: 0.5, exactCount: 3, fourCount: 0 }),
      row({ participantId: 'c', points: 10, hitRate: 0.5, exactCount: 2, fourCount: 1 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['b', 'a', 'c']);
  });

  it('nie mutuje tablicy wejściowej', () => {
    const input = [
      row({ participantId: 'a', points: 10 }),
      row({ participantId: 'b', points: 20 }),
    ];
    rankRows(input);
    expect(input.map(r => r.participantId)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Krok 2: Uruchom test — ma FAIL**

Uruchom: `npx vitest run engine/ranking.test.ts`
Oczekiwane: FAIL — `rankRows` nie istnieje.

- [ ] **Krok 3: Napisz minimalną implementację**

`engine/ranking.ts`:

```typescript
import type { RankableRow, RankedRow } from './types';

/**
 * Rankuje wiersze malejąco wg: punkty → „%" → liczba dokładnych (5) → liczba „4".
 * Wspólne dla tabel grup konkursowych i tabeli ogólnej (sekcja 2.2 specyfikacji).
 * Nie mutuje wejścia; przypisuje pozycje 1..n w kolejności sortowania.
 */
export function rankRows(rows: RankableRow[]): RankedRow[] {
  const sorted = [...rows].sort((a, b) =>
    b.points - a.points ||
    b.hitRate - a.hitRate ||
    b.exactCount - a.exactCount ||
    b.fourCount - a.fourCount
  );
  return sorted.map((r, i) => ({ ...r, position: i + 1 }));
}
```

- [ ] **Krok 4: Uruchom test — ma PASS**

Uruchom: `npx vitest run engine/ranking.test.ts`
Oczekiwane: PASS (4 testy).

- [ ] **Krok 5: Commit**

```bash
git add engine/ranking.ts engine/ranking.test.ts
git commit -m "feat(engine): wspolny ranking z tiebreakerami"
```

---

## Zadanie 6: Tabela ogólna (`generalTable`)

**Pliki:**
- Utwórz: `engine/generalTable.ts`
- Test: `engine/generalTable.test.ts`

- [ ] **Krok 1: Napisz test, który ma się nie powieść**

`engine/generalTable.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generalTable } from './generalTable';
import type { ParticipantSeason } from './types';

const season = (
  over: Partial<ParticipantSeason> & { participantId: string },
): ParticipantSeason => ({
  grI: 0,
  grII: 0,
  grIII: 0,
  bns: 0,
  puch: 0,
  hitRate: 0,
  exactCount: 0,
  fourCount: 0,
  ...over,
});

describe('generalTable', () => {
  it('sumuje grI+grII+grIII i rankuje malejąco po sumie', () => {
    const out = generalTable([
      season({ participantId: 'a', grI: 10, grII: 12, grIII: 8 }),  // 30
      season({ participantId: 'b', grI: 20, grII: 5, grIII: 9 }),   // 34
    ]);
    expect(out[0].participantId).toBe('b');
    expect(out[0].total).toBe(34);
    expect(out[0].position).toBe(1);
    expect(out[1].total).toBe(30);
  });

  it('uwzględnia bns i puch w sumie', () => {
    const out = generalTable([
      season({ participantId: 'a', grI: 10, bns: 15, puch: 6 }),
    ]);
    expect(out[0].total).toBe(31); // 10 + 0 + 0 + 15 + 6
  });

  it('przy remisie sumy stosuje tiebreakery (%, dokładne, 4)', () => {
    const out = generalTable([
      season({ participantId: 'a', grI: 10, hitRate: 0.4, exactCount: 1 }),
      season({ participantId: 'b', grI: 10, hitRate: 0.6, exactCount: 1 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Krok 2: Uruchom test — ma FAIL**

Uruchom: `npx vitest run engine/generalTable.test.ts`
Oczekiwane: FAIL — `generalTable` nie istnieje.

- [ ] **Krok 3: Napisz minimalną implementację**

`engine/generalTable.ts`:

```typescript
import type { ParticipantSeason, RankableRow, GeneralRow } from './types';
import { rankRows } from './ranking';

/**
 * Buduje tabelę ogólną: suma = grI + grII + grIII + bns + puch,
 * ranking wg punktów i tiebreakerów (sekcja 2.2 specyfikacji).
 */
export function generalTable(participants: ParticipantSeason[]): GeneralRow[] {
  const rows: RankableRow[] = participants.map(p => ({
    participantId: p.participantId,
    points: p.grI + p.grII + p.grIII + p.bns + p.puch,
    hitRate: p.hitRate,
    exactCount: p.exactCount,
    fourCount: p.fourCount,
  }));
  return rankRows(rows).map(r => ({ ...r, total: r.points }));
}
```

- [ ] **Krok 4: Uruchom test — ma PASS**

Uruchom: `npx vitest run engine/generalTable.test.ts`
Oczekiwane: PASS (3 testy).

- [ ] **Krok 5: Commit**

```bash
git add engine/generalTable.ts engine/generalTable.test.ts
git commit -m "feat(engine): tabela ogolna (suma + ranking)"
```

---

## Zadanie 7: Publiczny barrel export i pełny przebieg

**Pliki:**
- Utwórz: `engine/index.ts`

> **Uwaga o tabeli grupy konkursowej:** tabela jednej grupy A–H (7 osób) to po prostu `rankRows` wywołane na 7 wierszach danej grupy (te same tiebreakery). Nie potrzeba osobnej funkcji — `rankRows` z Zadania 5 ją realizuje. Przydział uczestników do grup A–H pochodzi z danych (ingest) i jest poza zakresem tego planu.

- [ ] **Krok 1: Utwórz `engine/index.ts`**

```typescript
// Publiczne API silnika punktacji.
export type {
  Score,
  MatchPoints,
  MatchEntry,
  TurnScore,
  RankableRow,
  RankedRow,
  ParticipantSeason,
  GeneralRow,
} from './types';

export { scoreMatchK1 } from './scoreMatch';
export { aggregateTurn } from './aggregate';
export { rankRows } from './ranking';
export { generalTable } from './generalTable';
```

- [ ] **Krok 2: Typecheck całości**

Uruchom: `npm run typecheck`
Oczekiwane: PASS (brak błędów).

- [ ] **Krok 3: Uruchom WSZYSTKIE testy**

Uruchom: `npm test`
Oczekiwane: PASS — 4 pliki testowe, łącznie 19 testów (8 + 4 + 4 + 3).

- [ ] **Krok 4: Commit**

```bash
git add engine/index.ts
git commit -m "feat(engine): publiczny barrel export silnika K1"
```

---

## Definicja ukończenia

- `npm test` → wszystkie testy zielone (19).
- `npm run typecheck` → bez błędów.
- Silnik eksportuje: `scoreMatchK1`, `aggregateTurn`, `rankRows`, `generalTable` oraz komplet typów.
- Brak zależności od UI/Excela; funkcje czyste i deterministyczne.

## Następne plany (poza tym zakresem)

1. **Ingest K1** — parser `k1.xlsx` + plik wyników → kanoniczny model → wejście silnika (po domknięciu formatu plików typów).
2. **Tabele grup A–H end-to-end** — złożenie przydziałów uczestników z `rankRows` na realnych danych.
3. **Konkurs 2** — tabele grup FIFA, drabinka, punktacja 1/2/4/6/8/10/12.
4. **Faza pucharowa ×2** i moduł bonusu `bns` (po decyzji organizatora).
5. **Render Next.js + statystyki + komentarze.**
