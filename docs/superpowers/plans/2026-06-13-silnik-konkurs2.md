# Silnik Konkursu 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Czysty silnik punktacji Konkursu 2 (TDD): funkcja `scoreK2` (grupy + fazy pucharowe) i tabela końcowa `k2Table` z tiebreakiem po późniejszej fazie.

**Architecture:** Wariant A ze specu — silnik punktuje gotowe, rozwiązane zbiory (kolejność grup + zbiory drużyn per faza). Hydraulika drabinki i ingest są poza zakresem. Punktacja = dopasowanie pozycji w grupach (1 pkt) + przecięcie zbiorów drużyn per faza × waga (2/4/6/8/10/12), kumulowane. Tabela końcowa przez istniejące `rankBy`.

**Tech Stack:** TypeScript, Vitest. Moduł `engine/` (czysty, bez zależności od Excela/UI), eksport przez `engine/index.ts`.

**Spec:** `docs/superpowers/specs/2026-06-13-silnik-konkurs2-design.md`

---

## File Structure

- `engine/types.ts` — **modyfikacja**: dodać typy K2 (`TeamId`, `GroupStandings`, `PhaseRosters`, `K2Entry`, `K2Score`).
- `engine/scoreK2.ts` — **nowy**: funkcja `scoreK2` + prywatne helpery (`groupHits`, `intersectionSize`).
- `engine/scoreK2.test.ts` — **nowy**: testy `scoreK2`.
- `engine/k2Table.ts` — **nowy**: funkcja `k2Table` (ranking + tiebreak przez `rankBy`).
- `engine/k2Table.test.ts` — **nowy**: testy `k2Table`.
- `engine/index.ts` — **modyfikacja**: eksport typów i funkcji K2.

Uruchamianie pojedynczego pliku testowego: `npx vitest run <ścieżka>`. Pełna bramka: `npm test && npm run typecheck`.

---

## Task 1: Typy K2 + punktacja grup (`scoreK2` — tylko grupy)

**Files:**
- Modify: `engine/types.ts` (dopisać na końcu pliku)
- Create: `engine/scoreK2.ts`
- Test: `engine/scoreK2.test.ts`

- [ ] **Step 1: Dodaj typy K2 do `engine/types.ts`**

Dopisz na końcu `engine/types.ts`:

```ts
/** Identyfikator drużyny. KONWENCJA: pełna nazwa PL jak w arkuszu
 * (np. "Bośnia i Hercegowina", "Korea Płd."). Dla silnika nieprzezroczysty string;
 * spójność pisowni pilnuje przyszły ingest. "" = brak/nieznana drużyna. */
export type TeamId = string;

/** Końcowe miejsca w grupie: 4 drużyny w kolejności miejsc 1→4. Klucz grupy: "A".."L". */
export type GroupStandings = Record<string, [TeamId, TeamId, TeamId, TeamId]>;

/** Obsada faz pucharowych — zbiory drużyn obecnych w danej fazie. */
export interface PhaseRosters {
  /** 1/16 finału — 32 drużyny. */
  r32: TeamId[];
  /** 1/8 finału — 16 drużyn. */
  r16: TeamId[];
  /** Ćwierćfinał — 8 drużyn. */
  qf: TeamId[];
  /** Półfinał — 4 drużyny. */
  sf: TeamId[];
  /** Finał — 2 drużyny (obaj finaliści). */
  final: TeamId[];
  /** Mistrz — 1 drużyna; "" gdy brak typu. */
  champion: TeamId;
}

/** Komplet rozstrzygnięć K2 — ten sam kształt dla typu uczestnika i dla faktów. */
export interface K2Entry {
  groups: GroupStandings;
  phases: PhaseRosters;
}

/**
 * Punkty K2 jednego uczestnika, rozbite per faza (odwzorowanie H19/H37/H49/H59/H65/H69
 * z arkusza; finał i mistrz rozbite na osobne pola).
 */
export interface K2Score {
  participantId: string;
  /** Grupy: Σ trafionych pozycji × 1 (max 48). */
  group: number;
  /** 1/16: |typ ∩ fakt| × 2. */
  r32: number;
  /** 1/8: × 4. */
  r16: number;
  /** Ćwierćfinał: × 6. */
  qf: number;
  /** Półfinał: × 8. */
  sf: number;
  /** Finał: |typ ∩ fakt| × 10. */
  final: number;
  /** Mistrz: 12 gdy trafiony, inaczej 0. */
  champion: number;
  /** Suma wszystkich składników. */
  total: number;
}
```

- [ ] **Step 2: Napisz failujący test punktacji grup**

Utwórz `engine/scoreK2.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { K2Entry } from './types';
import { scoreK2 } from './scoreK2';

/** Pusta obsada faz — używana, gdy test sprawdza tylko grupy. */
const emptyPhases = () => ({ r32: [], r16: [], qf: [], sf: [], final: [], champion: '' });

/** Buduje K2Entry z podanymi grupami i (opcjonalnie) fazami. */
const entry = (groups: K2Entry['groups'], phases: Partial<K2Entry['phases']> = {}): K2Entry => ({
  groups,
  phases: { ...emptyPhases(), ...phases },
});

describe('scoreK2 — grupy', () => {
  it('1 pkt za każdą drużynę na trafionym miejscu', () => {
    const typ = entry({ A: ['Meksyk', 'Korea Płd.', 'Czechy', 'RPA'] });
    const fakt = entry({ A: ['Meksyk', 'Czechy', 'Korea Płd.', 'RPA'] });
    // Trafione: Meksyk (1), RPA (4) → 2 pkt. Korea/Czechy zamienione.
    expect(scoreK2('p1', typ, fakt).group).toBe(2);
  });

  it('komplet 12 grup po 4 trafienia → 48 pkt', () => {
    const groups: K2Entry['groups'] = {};
    for (const g of 'ABCDEFGHIJKL') {
      groups[g] = [`${g}1`, `${g}2`, `${g}3`, `${g}4`];
    }
    const e = entry(groups);
    const score = scoreK2('p1', e, e);
    expect(score.group).toBe(48);
    expect(score.total).toBe(48);
  });

  it('grupa nieobecna w typie nie daje punktów', () => {
    const typ = entry({});
    const fakt = entry({ A: ['Meksyk', 'Korea Płd.', 'Czechy', 'RPA'] });
    expect(scoreK2('p1', typ, fakt).group).toBe(0);
  });

  it('puste miejsce w faktach ("") nie liczy się nawet przy "" w typie', () => {
    const typ = entry({ A: ['', 'Korea Płd.', 'Czechy', 'RPA'] });
    const fakt = entry({ A: ['', 'Korea Płd.', 'Czechy', 'RPA'] });
    // Pozycja 1 to "" w obu — NIE punktujemy; pozostałe 3 trafione.
    expect(scoreK2('p1', typ, fakt).group).toBe(3);
  });
});
```

- [ ] **Step 3: Uruchom test — ma failować**

Run: `npx vitest run engine/scoreK2.test.ts`
Expected: FAIL — `Cannot find module './scoreK2'` / `scoreK2 is not a function`.

- [ ] **Step 4: Zaimplementuj `scoreK2` (na razie tylko grupy)**

Utwórz `engine/scoreK2.ts`:

```ts
import type { GroupStandings, K2Entry, K2Score } from './types';

/** Liczba drużyn na trafionym miejscu w grupach (1 pkt każda). */
function groupHits(typ: GroupStandings, fakt: GroupStandings): number {
  let hits = 0;
  for (const [group, teams] of Object.entries(fakt)) {
    const typed = typ[group];
    if (!typed) continue;
    teams.forEach((team, i) => {
      if (team !== '' && typed[i] === team) hits += 1;
    });
  }
  return hits;
}

/**
 * Punktacja Konkursu 2 dla jednego uczestnika (czysta). Wariant A:
 * dostaje gotowe, rozwiązane zbiory; nie zna drabinki ani Excela.
 */
export function scoreK2(participantId: string, typ: K2Entry, fakt: K2Entry): K2Score {
  const group = groupHits(typ.groups, fakt.groups);
  const total = group;
  return { participantId, group, r32: 0, r16: 0, qf: 0, sf: 0, final: 0, champion: 0, total };
}
```

- [ ] **Step 5: Uruchom test — ma przejść**

Run: `npx vitest run engine/scoreK2.test.ts`
Expected: PASS (4 testy).

- [ ] **Step 6: Commit**

```bash
git add engine/types.ts engine/scoreK2.ts engine/scoreK2.test.ts
git commit -m "feat(k2): typy K2 + punktacja grup (scoreK2)"
```

---

## Task 2: Fazy pucharowe w `scoreK2` (przecięcia zbiorów + mistrz + kumulacja)

**Files:**
- Modify: `engine/scoreK2.ts`
- Test: `engine/scoreK2.test.ts` (dopisać blok)

- [ ] **Step 1: Dopisz failujące testy faz pucharowych**

Dopisz w `engine/scoreK2.test.ts` (po bloku „scoreK2 — grupy"):

```ts
describe('scoreK2 — fazy pucharowe', () => {
  const noGroups = {} as K2Entry['groups'];

  it('każda faza punktuje przecięcie zbiorów swoją wagą', () => {
    const typ = entry(noGroups, {
      r32: ['A', 'B', 'C'],
      r16: ['A', 'B'],
      qf: ['A', 'X'],
      sf: ['A'],
      final: ['A', 'Y'],
    });
    const fakt = entry(noGroups, {
      r32: ['A', 'B', 'Z'],
      r16: ['A', 'Q'],
      qf: ['A'],
      sf: ['A'],
      final: ['A', 'W'],
    });
    const s = scoreK2('p1', typ, fakt);
    expect(s.r32).toBe(2 * 2); // A,B
    expect(s.r16).toBe(1 * 4); // A
    expect(s.qf).toBe(1 * 6); // A
    expect(s.sf).toBe(1 * 8); // A
    expect(s.final).toBe(1 * 10); // A
  });

  it('mistrz: 12 gdy trafiony, 0 gdy nie', () => {
    const fakt = entry(noGroups, { champion: 'A' });
    expect(scoreK2('p1', entry(noGroups, { champion: 'A' }), fakt).champion).toBe(12);
    expect(scoreK2('p1', entry(noGroups, { champion: 'B' }), fakt).champion).toBe(0);
  });

  it('pusty typ mistrza ("") nie trafia w pustego mistrza faktów', () => {
    const fakt = entry(noGroups, { champion: '' });
    expect(scoreK2('p1', entry(noGroups, { champion: '' }), fakt).champion).toBe(0);
  });

  it('kumulacja: drużyna typowana od 1/16 do tytułu → 2+4+6+8+10+12 = 42', () => {
    const e = entry(noGroups, {
      r32: ['A'], r16: ['A'], qf: ['A'], sf: ['A'], final: ['A'], champion: 'A',
    });
    const s = scoreK2('p1', e, e);
    expect(s.total).toBe(2 + 4 + 6 + 8 + 10 + 12);
  });

  it('total = suma wszystkich składników (grupy + fazy)', () => {
    const typ = entry(
      { A: ['Meksyk', 'Korea Płd.', 'Czechy', 'RPA'] },
      { r32: ['A'], final: ['A', 'B'], champion: 'A' },
    );
    const fakt = entry(
      { A: ['Meksyk', 'Korea Płd.', 'Czechy', 'RPA'] },
      { r32: ['A'], final: ['A', 'C'], champion: 'A' },
    );
    const s = scoreK2('p1', typ, fakt);
    expect(s.group).toBe(4);
    expect(s.r32).toBe(2);
    expect(s.final).toBe(10);
    expect(s.champion).toBe(12);
    expect(s.total).toBe(4 + 2 + 10 + 12);
  });
});
```

- [ ] **Step 2: Uruchom test — nowe testy mają failować**

Run: `npx vitest run engine/scoreK2.test.ts`
Expected: FAIL — fazy zwracają 0 (np. `expected 4 to be 0` dla r32), bo logika faz jeszcze nie istnieje.

- [ ] **Step 3: Rozszerz `scoreK2` o fazy pucharowe**

Zastąp całą zawartość `engine/scoreK2.ts`:

```ts
import type { GroupStandings, K2Entry, K2Score, TeamId } from './types';

/** Wagi punktowe faz pucharowych (obecność drużyny w fazie). */
const PHASE_WEIGHT = { r32: 2, r16: 4, qf: 6, sf: 8, final: 10 } as const;

/** Liczba drużyn na trafionym miejscu w grupach (1 pkt każda). */
function groupHits(typ: GroupStandings, fakt: GroupStandings): number {
  let hits = 0;
  for (const [group, teams] of Object.entries(fakt)) {
    const typed = typ[group];
    if (!typed) continue;
    teams.forEach((team, i) => {
      if (team !== '' && typed[i] === team) hits += 1;
    });
  }
  return hits;
}

/** Liczność przecięcia dwóch zbiorów drużyn (po nazwie; defensywnie bez duplikatów). */
function intersectionSize(typ: readonly TeamId[], fakt: readonly TeamId[]): number {
  const typed = new Set(typ);
  const counted = new Set<TeamId>();
  let n = 0;
  for (const team of fakt) {
    if (team !== '' && typed.has(team) && !counted.has(team)) {
      counted.add(team);
      n += 1;
    }
  }
  return n;
}

/**
 * Punktacja Konkursu 2 dla jednego uczestnika (czysta). Wariant A:
 * dostaje gotowe, rozwiązane zbiory; nie zna drabinki ani Excela.
 * Grupy: 1 pkt za trafione miejsce. Fazy: przecięcie zbiorów × waga,
 * kumulowane. Mistrz: 12 za trafienie. Patrz spec 2026-06-13.
 */
export function scoreK2(participantId: string, typ: K2Entry, fakt: K2Entry): K2Score {
  const group = groupHits(typ.groups, fakt.groups);
  const r32 = intersectionSize(typ.phases.r32, fakt.phases.r32) * PHASE_WEIGHT.r32;
  const r16 = intersectionSize(typ.phases.r16, fakt.phases.r16) * PHASE_WEIGHT.r16;
  const qf = intersectionSize(typ.phases.qf, fakt.phases.qf) * PHASE_WEIGHT.qf;
  const sf = intersectionSize(typ.phases.sf, fakt.phases.sf) * PHASE_WEIGHT.sf;
  const final = intersectionSize(typ.phases.final, fakt.phases.final) * PHASE_WEIGHT.final;
  const champion =
    typ.phases.champion !== '' && typ.phases.champion === fakt.phases.champion ? 12 : 0;
  const total = group + r32 + r16 + qf + sf + final + champion;
  return { participantId, group, r32, r16, qf, sf, final, champion, total };
}
```

- [ ] **Step 4: Uruchom test — wszystko ma przejść**

Run: `npx vitest run engine/scoreK2.test.ts`
Expected: PASS (9 testów: 4 z Task 1 + 5 nowych).

- [ ] **Step 5: Commit**

```bash
git add engine/scoreK2.ts engine/scoreK2.test.ts
git commit -m "feat(k2): fazy pucharowe w scoreK2 (przeciecia zbiorow, kumulacja, mistrz)"
```

---

## Task 3: Tabela końcowa K2 (`k2Table`)

**Files:**
- Create: `engine/k2Table.ts`
- Test: `engine/k2Table.test.ts`

- [ ] **Step 1: Napisz failujący test `k2Table`**

Utwórz `engine/k2Table.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { K2Score } from './types';
import { k2Table } from './k2Table';

/** Buduje K2Score z zerami + nadpisaniami. */
const sc = (over: Partial<K2Score> & { participantId: string }): K2Score => ({
  group: 0, r32: 0, r16: 0, qf: 0, sf: 0, final: 0, champion: 0, total: 0,
  ...over,
});

describe('k2Table', () => {
  it('sortuje malejąco po total i nadaje pozycje', () => {
    const out = k2Table([
      sc({ participantId: 'a', total: 30 }),
      sc({ participantId: 'b', total: 50 }),
      sc({ participantId: 'c', total: 40 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['b', 'c', 'a']);
    expect(out.map(r => r.position)).toEqual([1, 2, 3]);
  });

  it('remis total → rozstrzyga punkt z późniejszej fazy', () => {
    // Oba mają total 20: a dzięki półfinałowi, b dzięki 1/16. Późniejsza faza (sf) wygrywa.
    const out = k2Table([
      sc({ participantId: 'b', total: 20, r32: 20 }),
      sc({ participantId: 'a', total: 20, sf: 20 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['a', 'b']);
  });

  it('remis aż do mistrza → mistrz rozstrzyga jako najpóźniejsza faza', () => {
    const out = k2Table([
      sc({ participantId: 'x', total: 12, final: 12 }),
      sc({ participantId: 'y', total: 12, champion: 12 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['y', 'x']);
  });

  it('nie mutuje wejścia', () => {
    const input = [sc({ participantId: 'a', total: 10 }), sc({ participantId: 'b', total: 20 })];
    k2Table(input);
    expect(input.map(r => r.participantId)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Uruchom test — ma failować**

Run: `npx vitest run engine/k2Table.test.ts`
Expected: FAIL — `Cannot find module './k2Table'`.

- [ ] **Step 3: Zaimplementuj `k2Table`**

Utwórz `engine/k2Table.ts`:

```ts
import type { K2Score } from './types';
import { rankBy } from './ranking';

/**
 * Tabela końcowa Konkursu 2. Tiebreak organizatora (zasady B13–B14):
 * przy równym `total` wyżej ten, kto zdobył więcej punktów w PÓŹNIEJSZEJ fazie
 * — stąd klucze od najpóźniejszej do najwcześniejszej.
 */
export function k2Table(scores: readonly K2Score[]): (K2Score & { position: number })[] {
  return rankBy(scores, ['total', 'champion', 'final', 'sf', 'qf', 'r16', 'r32', 'group']);
}
```

- [ ] **Step 4: Uruchom test — ma przejść**

Run: `npx vitest run engine/k2Table.test.ts`
Expected: PASS (4 testy).

- [ ] **Step 5: Commit**

```bash
git add engine/k2Table.ts engine/k2Table.test.ts
git commit -m "feat(k2): tabela koncowa k2Table z tiebreakiem po pozniejszej fazie"
```

---

## Task 4: Eksport w `engine/index.ts` + bramka jakości

**Files:**
- Modify: `engine/index.ts`

- [ ] **Step 1: Dodaj eksporty K2 do `engine/index.ts`**

W bloku `export type { ... } from './types';` dodaj nowe typy K2. Po edycji blok typów ma zawierać również:

```ts
export type {
  Score,
  MatchPoints,
  MatchEntry,
  TurnScore,
  ParticipantSeason,
  GeneralRow,
  TeamId,
  GroupStandings,
  PhaseRosters,
  K2Entry,
  K2Score,
} from './types';
```

A w bloku eksportów funkcji dodaj dwie linie:

```ts
export { scoreK2 } from './scoreK2';
export { k2Table } from './k2Table';
```

- [ ] **Step 2: Bramka — pełne testy + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS — wszystkie testy zielone (poprzednie + 13 nowych K2), typecheck bez błędów.

- [ ] **Step 3: Commit**

```bash
git add engine/index.ts
git commit -m "feat(k2): eksport scoreK2, k2Table i typow K2 z engine/index"
```

---

## Self-Review (autor planu)

- **Pokrycie specu:** §4 model danych → Task 1 (typy). §5 `scoreK2` → Task 1 (grupy) + Task 2 (fazy, kumulacja, mistrz, total). §6 `k2Table` + tiebreak → Task 3. §7 testy → testy w Task 1–3; eksport w `index.ts` → Task 4. Brak luk.
- **Placeholdery:** brak — każdy krok ma pełny kod i komendę.
- **Spójność typów:** `K2Entry`, `PhaseRosters` (pola `r32/r16/qf/sf/final/champion`), `K2Score` (pola `group/r32/r16/qf/sf/final/champion/total`) używane identycznie w Task 1–4; `scoreK2(participantId, typ, fakt)` i `k2Table(scores)` zgodne między definicją a użyciem; `rankBy` użyte zgodnie z istniejącą sygnaturą (`engine/ranking.ts`).
