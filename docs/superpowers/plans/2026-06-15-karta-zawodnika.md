# Karta zawodnika — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dla każdego z 56 graczy generujemy pikselową „kartę zawodnika" jako PNG przy buildzie. Karta żyje na osobnej podstronie `/gracz/[id]/karta/` (link z profilu retro-przyciskiem „★ KARTA ZAWODNIKA →"), z przyciskiem pobrania, `og:image` i czytelną legendą. Hero karty (miejsce w tabeli ogólnej + punkty całkowite) jest **evergreen** — żyje przez cały turniej; sekcje WYNIKI/STYL GRY/PO TURZE 2 to stała „historia fazy grupowej".

**Architecture:** Czysta funkcja `engine/playerCard.ts` liczy staty z typów + wyników (faza grupowa), a miejsce/punkty całkowite dostaje gotowe z tabel (TDD, ground truth = Talvik/DarekJell). `compute/buildResults.ts` dolicza sekcję `cards` do `public/data/results.json`. `scripts/buildCards.mjs` (`npm run build:cards`) renderuje PNG (Satori → SVG → `sharp` → PNG) z tej sekcji — jedyne źródło wyglądu karty. Profil dostaje przycisk-link; podstrona `/gracz/[id]/karta/` pokazuje `<img>` + pobieranie + liczby tekstem + legendę. Granice modułów bez zmian: silnik nie wie o Excelu/UI/PNG; `app/` czyta tylko `public/data/results.json` i statyczne pliki.

**Tech Stack:** TypeScript, Vitest (TDD), Next.js 16 App Router (static export), `satori` + `sharp` (build-time PNG), Press Start 2P TTF.

**Decyzja wdrożeniowa (2026-06-15):** PNG generuje Vercel przy buildzie (`buildCommand = npm run build:cards && npm run build`), nie commitujemy ich (gitignore). Robot auto-scores bez zmian — commit `results.json` triggeruje deploy, a Vercel renderuje świeże karty.

**Decyzja zakresu (2026-06-15):** hero evergreen (`general.position` + `general.points`); szczegóły z fazy grupowej. Karta na osobnej podstronie linkowanej z profilu. Atrybuty pucharowe — świadomie poza tym planem. (Patrz spec §2/§3/§4/§5.)

**Korekta kolejności bramki względem spec §9:** `build:cards` MUSI biec PRZED `next build` (static export kopiuje `public/karty/` do `out/`). Bramka: `npm test && npm run typecheck && npm run build:results && npm run build:cards && npm run build && npm run smoke`.

---

### Task 1: Typy karty w silniku

**Files:**
- Modify: `engine/types.ts` (dopisz na końcu)
- Modify: `engine/index.ts:1-18` (dopisz eksporty typów)

- [ ] **Step 1: Dopisz typy do `engine/types.ts`**

Dopisz na końcu pliku:

```typescript
/** Trend formy między dwiema ostatnimi turami z wynikami. */
export type Forma = 'UP' | 'DOWN' | 'FLAT';

/** Plakietka osobowości z ZGODNOŚCI Z TŁUMEM. */
export type Osobowosc = 'INDYWIDUALISTA' | 'OWCZY PĘD' | 'NEUTRALNY';

/** Najlepsza tura: jej numer i dorobek. */
export interface BestTurn {
  turn: number;
  points: number;
}

/** Jeden mecz w wejściu karty: typ gracza, wynik i typy WSZYSTKICH uczestników (do ZGODNOŚCI). */
export interface PlayerCardMatch {
  /** Typ gracza; null = brak typu. */
  pick: Score | null;
  /** Faktyczny wynik; null = mecz nierozegrany (pomijany). */
  result: Score | null;
  /** Typy wszystkich uczestników na ten mecz (w tym gracza); null = brak typu. */
  allPicks: (Score | null)[];
}

/** Tura w wejściu karty. */
export interface PlayerCardTurn {
  turn: number;
  matches: PlayerCardMatch[];
}

/**
 * Wejście czystej funkcji playerCard.
 * Pozycje i punkty całkowite podawane z GOTOWYCH tabel (silnik nie rankuje tu sam):
 * - generalPos/totalPoints z tabeli ogólnej (hero, evergreen),
 * - groupPos z tabeli grupowej (wiersz stat).
 * turns = wyłącznie faza grupowa (źródło sekcji WYNIKI/STYL GRY/PO TURZE 2).
 */
export interface PlayerCardInput {
  /** Grupa gracza (A–H). */
  group: string;
  /** Miejsce w tabeli grupowej (1 = najlepszy). */
  groupPos: number;
  /** Miejsce w tabeli ogólnej (1 = najlepszy) — hero. */
  generalPos: number;
  /** Całkowity dorobek z tabeli ogólnej (grI+grII+grIII+bns+puch) — hero. */
  totalPoints: number;
  /** Tury fazy grupowej w kolejności; mecze nierozegrane mają result=null. */
  turns: PlayerCardTurn[];
}

/**
 * Komplet statystyk karty zawodnika (sekcja `cards` w results.json).
 * `*Pct` to zaokrąglone liczby całkowite (np. 38 = 38%). `*Nd` = „nie dotyczy" (render pokazuje „—").
 */
export interface CardStats {
  group: string;
  /** Hero: miejsce w tabeli ogólnej. */
  generalPos: number;
  /** Hero: całkowity dorobek (grI+grII+grIII+bns+puch). Evergreen. */
  points: number;
  /** Wiersz stat: miejsce w grupie. */
  groupPos: number;
  /** % trafionych meczów (3/4/5) z rozegranych (faza grupowa). */
  celnoscPct: number;
  /** Liczba dokładnych wyników (count5). */
  dokladne: number;
  /** Średni dorobek na rozegrany mecz fazy grupowej (1 miejsce po przecinku). */
  srPktMecz: number;
  /** % typów spoza zbioru „bezpiecznych" {1:0,0:1,1:1,0:0}. */
  odwagaPct: number;
  /** trafione remisy / wytypowane remisy (%). */
  nosRemisowPct: number;
  /** true gdy gracz nie wytypował żadnego remisu. */
  nosRemisowNd: boolean;
  /** Najdłuższy ciąg trafień pod rząd (w kolejności meczów). */
  seria: number;
  /** Śr. liczba goli w typach gracza (home+away). */
  ofensywa: number;
  /** Śr. pkt liczona tylko z trafionych meczów. */
  pewniak: number;
  /** true gdy zero trafień. */
  pewniakNd: boolean;
  /** Najczęściej typowany wynik ("h:a"); "—" gdy brak typów. */
  ulubionyWynik: string;
  /** Śr. (po meczach) % graczy z identycznym typem. */
  zgodnoscPct: number;
  osobowosc: Osobowosc;
  /** Trend ostatniej tury vs poprzedniej; null gdy <2 tury z wynikami. */
  forma: Forma | null;
  /** Najlepsza tura; null gdy <2 tury z wynikami. */
  najlepszaTura: BestTurn | null;
  /** true gdy ≥2 tury mają wyniki (sekcja PO TURZE 2 aktywna). */
  poTurze2Aktywne: boolean;
}
```

- [ ] **Step 2: Wyeksportuj typy z `engine/index.ts`**

Rozszerz blok `export type { ... } from './types';` o nowe nazwy:

```typescript
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
  Forma,
  Osobowosc,
  BestTurn,
  PlayerCardMatch,
  PlayerCardTurn,
  PlayerCardInput,
  CardStats,
} from './types';
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: brak błędów.

- [ ] **Step 4: Commit**

```bash
git add engine/types.ts engine/index.ts
git commit -m "feat(engine): typy karty zawodnika (CardStats, PlayerCardInput; hero evergreen)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `playerCard` — hero (evergreen) + sekcja WYNIKI

**Files:**
- Create: `engine/playerCard.ts`
- Create: `engine/playerCard.test.ts`

- [ ] **Step 1: Napisz failujący test**

Utwórz `engine/playerCard.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { playerCard } from './playerCard';
import type { PlayerCardInput, Score } from './types';

const s = (home: number, away: number): Score => ({ home, away });

/** Mecz: typ gracza + wynik; allPicks domyślnie = sam gracz (nadpisywane w testach ZGODNOŚCI). */
function m(pick: Score | null, result: Score | null, allPicks?: (Score | null)[]) {
  return { pick, result, allPicks: allPicks ?? [pick] };
}

describe('playerCard — hero (evergreen) i WYNIKI', () => {
  it('hero bierze totalPoints/generalPos z wejścia; WYNIKI liczy z meczów grupowych', () => {
    const input: PlayerCardInput = {
      group: 'A',
      groupPos: 3,
      generalPos: 5,
      totalPoints: 20, // np. zawiera już bonus — celowo ≠ suma meczów grupowych (12)
      turns: [
        {
          turn: 1,
          matches: [
            m(s(2, 1), s(2, 1)), // 5
            m(s(1, 0), s(3, 0)), // 3
            m(s(0, 0), s(1, 0)), // 0
            m(s(2, 0), s(3, 1)), // 4
            m(s(1, 1), null),    // nierozegrany — pomijany
          ],
        },
      ],
    };
    const c = playerCard(input);
    expect(c.group).toBe('A');
    expect(c.groupPos).toBe(3);
    expect(c.generalPos).toBe(5);
    expect(c.points).toBe(20); // hero = totalPoints, NIE suma meczów
    expect(c.dokladne).toBe(1);
    expect(c.celnoscPct).toBe(75); // 3 trafienia / 4 rozegrane
    expect(c.srPktMecz).toBeCloseTo(3.0, 5); // dorobek grupowy 12 / 4 rozegrane
  });

  it('pusta historia → zera, hero z wejścia, bez wyjątków', () => {
    const c = playerCard({ group: 'B', groupPos: 7, generalPos: 50, totalPoints: 0, turns: [] });
    expect(c.points).toBe(0);
    expect(c.generalPos).toBe(50);
    expect(c.celnoscPct).toBe(0);
    expect(c.srPktMecz).toBe(0);
    expect(c.dokladne).toBe(0);
  });
});
```

- [ ] **Step 2: Uruchom test — ma failować**

Run: `npx vitest run engine/playerCard.test.ts`
Expected: FAIL — `Cannot find module './playerCard'`.

- [ ] **Step 3: Napisz `engine/playerCard.ts` (hero + WYNIKI)**

```typescript
import type { CardStats, PlayerCardInput, PlayerCardMatch } from './types';
import { scoreMatchK1 } from './scoreMatch';

const round1 = (v: number): number => Math.round(v * 10) / 10;
const pct = (v: number): number => Math.round(v * 100);

/** Punkty meczu dla gracza: 0 bez typu, inaczej scoreMatchK1. Zakłada result≠null. */
function matchPoints(mt: PlayerCardMatch): number {
  if (!mt.result) return 0;
  return mt.pick ? scoreMatchK1(mt.pick, mt.result) : 0;
}

export function playerCard(input: PlayerCardInput): CardStats {
  const played: PlayerCardMatch[] = [];
  for (const t of input.turns) for (const mt of t.matches) if (mt.result) played.push(mt);

  const n = played.length;
  let groupPoints = 0; // dorobek fazy grupowej (do ŚR. PKT/MECZ) — różny od hero totalPoints
  let count5 = 0;
  let hits = 0;
  for (const mt of played) {
    const p = matchPoints(mt);
    groupPoints += p;
    if (p > 0) hits += 1;
    if (p === 5) count5 += 1;
  }

  return {
    group: input.group,
    generalPos: input.generalPos,
    points: input.totalPoints,
    groupPos: input.groupPos,
    celnoscPct: n > 0 ? pct(hits / n) : 0,
    dokladne: count5,
    srPktMecz: n > 0 ? round1(groupPoints / n) : 0,
    // pola STYL GRY / PO TURZE 2 dochodzą w kolejnych zadaniach:
    odwagaPct: 0,
    nosRemisowPct: 0,
    nosRemisowNd: true,
    seria: 0,
    ofensywa: 0,
    pewniak: 0,
    pewniakNd: true,
    ulubionyWynik: '—',
    zgodnoscPct: 0,
    osobowosc: 'NEUTRALNY',
    forma: null,
    najlepszaTura: null,
    poTurze2Aktywne: false,
  };
}
```

- [ ] **Step 4: Uruchom test — ma przejść**

Run: `npx vitest run engine/playerCard.test.ts`
Expected: PASS (2 testy).

- [ ] **Step 5: Wyeksportuj z `engine/index.ts`**

Po linii `export { scoreMatchK1 } from './scoreMatch';` dodaj:

```typescript
export { playerCard } from './playerCard';
```

- [ ] **Step 6: Commit**

```bash
git add engine/playerCard.ts engine/playerCard.test.ts engine/index.ts
git commit -m "feat(engine): playerCard — hero evergreen + sekcja WYNIKI

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `playerCard` — STYL GRY cz. 1 (odwaga, ofensywa, seria, ulubiony wynik)

**Files:**
- Modify: `engine/playerCard.ts`
- Modify: `engine/playerCard.test.ts`

- [ ] **Step 1: Dopisz failujący test**

Dodaj do `engine/playerCard.test.ts`:

```typescript
describe('playerCard — STYL GRY cz. 1', () => {
  const base = { group: 'C', groupPos: 1, generalPos: 1, totalPoints: 0 };

  it('odwaga, ofensywa, seria i ulubiony wynik', () => {
    const c = playerCard({
      ...base,
      turns: [
        {
          turn: 1,
          matches: [
            m(s(2, 1), s(2, 1)), // odważny, trafiony → seria 1
            m(s(0, 1), s(0, 1)), // bezpieczny 0:1, trafiony → seria 2
            m(s(1, 1), s(2, 0)), // bezpieczny 1:1, pudło → seria reset
            m(s(2, 1), s(0, 3)), // odważny 2:1 (powtórka), pudło
          ],
        },
      ],
    });
    expect(c.odwagaPct).toBe(50); // 2 z 4 typów poza {1:0,0:1,1:1,0:0}
    expect(c.ofensywa).toBeCloseTo(2.25, 5); // (3+1+2+3)/4
    expect(c.seria).toBe(2); // mecze 1–2
    expect(c.ulubionyWynik).toBe('2:1'); // 2 razy
  });

  it('ulubiony wynik — remis częstości rozstrzyga niższa suma bramek', () => {
    const c = playerCard({
      ...base,
      turns: [{ turn: 1, matches: [m(s(3, 0), s(0, 0)), m(s(1, 0), s(0, 0))] }],
    });
    expect(c.ulubionyWynik).toBe('1:0'); // obie po 1 → niższa suma bramek
  });
});
```

- [ ] **Step 2: Uruchom — ma failować**

Run: `npx vitest run engine/playerCard.test.ts`
Expected: FAIL — `odwagaPct` itd. = 0/„—".

- [ ] **Step 3: Zaimplementuj STYL GRY cz. 1**

Dodaj stałą i helper na górze `engine/playerCard.ts` (pod importami; dopisz `Score` do importu typów):

```typescript
import type { CardStats, PlayerCardInput, PlayerCardMatch, Score } from './types';
import { scoreMatchK1 } from './scoreMatch';

const SAFE = new Set(['1:0', '0:1', '1:1', '0:0']);
const keyOf = (s: Score): string => `${s.home}:${s.away}`;
```

Podmień deklaracje i pętlę w ciele `playerCard` na:

```typescript
  const n = played.length;
  let groupPoints = 0;
  let count5 = 0;
  let hits = 0;
  let brave = 0;
  let withPick = 0;
  let goalsSum = 0;
  let best = 0;
  let cur = 0;
  const freq = new Map<string, number>();

  for (const mt of played) {
    const p = matchPoints(mt);
    groupPoints += p;
    if (p > 0) {
      hits += 1;
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
    if (p === 5) count5 += 1;

    if (mt.pick) {
      withPick += 1;
      const k = keyOf(mt.pick);
      if (!SAFE.has(k)) brave += 1;
      goalsSum += mt.pick.home + mt.pick.away;
      freq.set(k, (freq.get(k) ?? 0) + 1);
    }
  }

  // Ulubiony wynik: max częstość → niższa suma bramek → alfabetycznie (deterministycznie).
  let ulubionyWynik = '—';
  if (freq.size > 0) {
    ulubionyWynik = [...freq.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const sa = a[0].split(':').reduce((acc, x) => acc + Number(x), 0);
      const sb = b[0].split(':').reduce((acc, x) => acc + Number(x), 0);
      if (sa !== sb) return sa - sb;
      return a[0].localeCompare(b[0]);
    })[0][0];
  }
```

W obiekcie zwracanym podmień pola:

```typescript
    odwagaPct: withPick > 0 ? pct(brave / withPick) : 0,
    seria: best,
    ofensywa: withPick > 0 ? round1(goalsSum / withPick) : 0,
    ulubionyWynik,
```

- [ ] **Step 4: Uruchom — ma przejść**

Run: `npx vitest run engine/playerCard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/playerCard.ts engine/playerCard.test.ts
git commit -m "feat(engine): playerCard — odwaga, ofensywa, seria, ulubiony wynik

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `playerCard` — STYL GRY cz. 2 (nos do remisów, pewniak, zgodność, osobowość)

**Files:**
- Modify: `engine/playerCard.ts`
- Modify: `engine/playerCard.test.ts`

- [ ] **Step 1: Dopisz failujący test**

Dodaj do `engine/playerCard.test.ts`:

```typescript
describe('playerCard — STYL GRY cz. 2', () => {
  const base = { group: 'D', generalPos: 1, totalPoints: 0 };

  it('nos do remisów, pewniak, zgodność i osobowość', () => {
    const c = playerCard({
      ...base,
      groupPos: 2,
      turns: [
        {
          turn: 1,
          matches: [
            m(s(1, 1), s(1, 1), [s(1, 1), s(1, 1), s(1, 1), s(1, 1)]), // remis trafiony (5), tłum 100%
            m(s(0, 0), s(2, 1), [s(0, 0), s(3, 0), s(2, 1), s(1, 0)]),  // remis pudło, tłum 25%
            m(s(2, 0), s(2, 0), [s(2, 0), s(0, 1), s(0, 1), s(0, 1)]),  // trafiony (5), tłum 25%
          ],
        },
      ],
    });
    expect(c.nosRemisowPct).toBe(50); // wytypowane remisy 2, trafione 1
    expect(c.nosRemisowNd).toBe(false);
    expect(c.pewniak).toBeCloseTo(5.0, 5); // trafione: 5 i 5
    expect(c.pewniakNd).toBe(false);
    expect(c.zgodnoscPct).toBe(50); // (100+25+25)/3
    expect(c.osobowosc).toBe('NEUTRALNY'); // 33 ≤ 50 < 60
  });

  it('brak remisów → Nd; brak trafień → Nd; INDYWIDUALISTA przy <33%', () => {
    const c = playerCard({
      ...base,
      groupPos: 7,
      turns: [
        {
          turn: 1,
          matches: [m(s(4, 0), s(0, 0), [s(4, 0), s(1, 0), s(1, 0), s(0, 1)])], // unikat, pudło, brak remisu
        },
      ],
    });
    expect(c.nosRemisowNd).toBe(true);
    expect(c.nosRemisowPct).toBe(0);
    expect(c.pewniakNd).toBe(true);
    expect(c.pewniak).toBe(0);
    expect(c.zgodnoscPct).toBe(25);
    expect(c.osobowosc).toBe('INDYWIDUALISTA');
  });

  it('OWCZY PĘD przy ≥60% zgodności', () => {
    const c = playerCard({
      ...base,
      groupPos: 1,
      turns: [{ turn: 1, matches: [m(s(1, 0), s(1, 0), [s(1, 0), s(1, 0), s(1, 0)])] }],
    });
    expect(c.zgodnoscPct).toBe(100);
    expect(c.osobowosc).toBe('OWCZY PĘD');
  });
});
```

- [ ] **Step 2: Uruchom — ma failować**

Run: `npx vitest run engine/playerCard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Zaimplementuj STYL GRY cz. 2**

Dołóż akumulatory do deklaracji przed pętlą:

```typescript
  let drawsTyped = 0;
  let drawsHit = 0;
  const hitPts: number[] = [];
  let crowdSum = 0;
  let crowdMatches = 0;
```

W gałęzi `if (p > 0)` dołóż zbieranie punktów trafień:

```typescript
    if (p > 0) {
      hits += 1;
      cur += 1;
      best = Math.max(best, cur);
      hitPts.push(p);
    } else {
      cur = 0;
    }
```

W bloku `if (mt.pick)` dołóż remisy i zgodność (po linii `freq.set(...)`):

```typescript
      if (mt.pick.home === mt.pick.away) {
        drawsTyped += 1;
        if (mt.result!.home === mt.result!.away) drawsHit += 1;
      }
      const others = mt.allPicks.filter((q): q is Score => q != null);
      if (others.length > 0) {
        const same = others.filter(
          (q) => q.home === mt.pick!.home && q.away === mt.pick!.away,
        ).length;
        crowdSum += same / others.length;
        crowdMatches += 1;
      }
```

Po obliczeniu `ulubionyWynik` dodaj:

```typescript
  const zgodnoscPct = crowdMatches > 0 ? pct(crowdSum / crowdMatches) : 0;
  const osobowosc: CardStats['osobowosc'] =
    zgodnoscPct < 33 ? 'INDYWIDUALISTA' : zgodnoscPct >= 60 ? 'OWCZY PĘD' : 'NEUTRALNY';
```

W obiekcie zwracanym podmień pola:

```typescript
    nosRemisowPct: drawsTyped > 0 ? pct(drawsHit / drawsTyped) : 0,
    nosRemisowNd: drawsTyped === 0,
    pewniak: hitPts.length > 0 ? round1(hitPts.reduce((a, b) => a + b, 0) / hitPts.length) : 0,
    pewniakNd: hitPts.length === 0,
    zgodnoscPct,
    osobowosc,
```

- [ ] **Step 4: Uruchom — ma przejść**

Run: `npx vitest run engine/playerCard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/playerCard.ts engine/playerCard.test.ts
git commit -m "feat(engine): playerCard — nos do remisów, pewniak, zgodność, osobowość

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `playerCard` — sekcja PO TURZE 2 (forma, najlepsza tura)

**Files:**
- Modify: `engine/playerCard.ts`
- Modify: `engine/playerCard.test.ts`

- [ ] **Step 1: Dopisz failujący test**

Dodaj do `engine/playerCard.test.ts`:

```typescript
describe('playerCard — PO TURZE 2', () => {
  const base = { group: 'E', generalPos: 1, totalPoints: 0 };

  it('1 tura z wynikami → sekcja nieaktywna', () => {
    const c = playerCard({
      ...base,
      groupPos: 4,
      turns: [
        { turn: 1, matches: [m(s(1, 0), s(1, 0))] },
        { turn: 2, matches: [m(s(2, 2), null)] }, // brak wyników
      ],
    });
    expect(c.poTurze2Aktywne).toBe(false);
    expect(c.forma).toBeNull();
    expect(c.najlepszaTura).toBeNull();
  });

  it('≥2 tury z wynikami → forma i najlepsza tura', () => {
    const c = playerCard({
      ...base,
      groupPos: 1,
      turns: [
        { turn: 1, matches: [m(s(1, 0), s(1, 0))] }, // 5 pkt
        { turn: 2, matches: [m(s(0, 0), s(1, 0))] }, // 0 pkt → spadek
        { turn: 3, matches: [m(s(2, 1), s(2, 1)), m(s(1, 1), s(1, 1))] }, // 10 pkt → wzrost
      ],
    });
    expect(c.poTurze2Aktywne).toBe(true);
    expect(c.forma).toBe('UP'); // ostatnia (10) > poprzednia (0)
    expect(c.najlepszaTura).toEqual({ turn: 3, points: 10 });
  });

  it('forma FLAT gdy ostatnie dwie tury równe; remis najlepszej → wcześniejsza', () => {
    const c = playerCard({
      ...base,
      groupPos: 2,
      turns: [
        { turn: 1, matches: [m(s(1, 0), s(1, 0))] }, // 5
        { turn: 2, matches: [m(s(2, 1), s(2, 1))] }, // 5
      ],
    });
    expect(c.forma).toBe('FLAT');
    expect(c.najlepszaTura).toEqual({ turn: 1, points: 5 });
  });
});
```

- [ ] **Step 2: Uruchom — ma failować**

Run: `npx vitest run engine/playerCard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Zaimplementuj PO TURZE 2**

Przed obiektem zwracanym dodaj:

```typescript
  // PO TURZE 2: dorobek per tura, licząc tylko tury, które mają jakikolwiek wynik.
  const turnPoints = input.turns
    .filter((t) => t.matches.some((mt) => mt.result))
    .map((t) => ({
      turn: t.turn,
      points: t.matches.reduce((acc, mt) => acc + matchPoints(mt), 0),
    }));

  const poTurze2Aktywne = turnPoints.length >= 2;
  let forma: CardStats['forma'] = null;
  let najlepszaTura: CardStats['najlepszaTura'] = null;
  if (poTurze2Aktywne) {
    const last = turnPoints[turnPoints.length - 1].points;
    const prev = turnPoints[turnPoints.length - 2].points;
    forma = last > prev ? 'UP' : last < prev ? 'DOWN' : 'FLAT';
    // Najlepsza tura: największy dorobek; przy remisie wcześniejsza (porządek wejścia).
    najlepszaTura = turnPoints.reduce((bestT, t) => (t.points > bestT.points ? t : bestT));
  }
```

W obiekcie zwracanym podmień trzy pola:

```typescript
    forma,
    najlepszaTura,
    poTurze2Aktywne,
```

- [ ] **Step 4: Uruchom plik testów silnika karty**

Run: `npx vitest run engine/playerCard.test.ts`
Expected: PASS (wszystkie bloki).

- [ ] **Step 5: Uruchom cały zestaw**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add engine/playerCard.ts engine/playerCard.test.ts
git commit -m "feat(engine): playerCard — sekcja PO TURZE 2 (forma, najlepsza tura)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Wpięcie `cards` do `compute/buildResults`

**Files:**
- Modify: `compute/buildResults.ts`
- Modify: `compute/types.ts:1` oraz `:69-77`
- Create: `compute/cards.test.ts`

- [ ] **Step 1: Rozszerz `ResultsJson` o `cards`**

W `compute/types.ts`, linia 1 — dołóż import typu:

```typescript
import type { Score, CardStats } from '../engine/types';
```

W interfejsie `ResultsJson` dodaj pole:

```typescript
export interface ResultsJson {
  generatedAt: string;
  general: TableRow[];
  groups: Record<Group, TableRow[]>;
  turns: TurnOut[];
  /** Statystyki karty zawodnika per uczestnik (nick → komplet stat). */
  cards: Record<string, CardStats>;
}
```

W eksporcie typów na końcu pliku dołóż `CardStats`:

```typescript
export type { Group, Participant, Score, CardStats };
```

- [ ] **Step 2: Napisz failujący test na realnych danych**

Utwórz `compute/cards.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildResults } from './buildResults';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

describe('buildResults — sekcja cards (ground truth z tury 1)', () => {
  const out = buildResults(
    read('data/k1/roster.json'),
    [read('data/k1/tura-1.json')],
    read('data/k1/results.json'),
  );

  it('zawiera kartę każdego uczestnika', () => {
    expect(Object.keys(out.cards).length).toBe(out.general.length);
  });

  it('hero wpięty z tabel: generalPos i points = wiersz general', () => {
    const g = out.general.find((r) => r.participantId === 'Talvik')!;
    const c = out.cards.Talvik;
    expect(c.generalPos).toBe(g.position);
    expect(c.points).toBe(g.points); // w niekompletnej fazie grupowej = grI+grII+grIII
  });

  it('Talvik — ręcznie zweryfikowane liczby (spec §9)', () => {
    const c = out.cards.Talvik;
    expect(c.group).toBe('E');
    expect(c.groupPos).toBe(4);
    expect(c.points).toBe(13); // bns=puch=0 → total = dorobek grupowy
    expect(c.celnoscPct).toBe(38);
    expect(c.dokladne).toBe(2);
    expect(c.srPktMecz).toBeCloseTo(1.6, 5);
    expect(c.odwagaPct).toBe(63);
    expect(c.nosRemisowPct).toBe(0);
    expect(c.nosRemisowNd).toBe(false);
    expect(c.seria).toBe(2);
    expect(c.ofensywa).toBeCloseTo(2.0, 5);
    expect(c.pewniak).toBeCloseTo(4.3, 5);
    expect(c.pewniakNd).toBe(false);
    expect(c.ulubionyWynik).toBe('0:2');
    expect(c.zgodnoscPct).toBe(23);
    expect(c.osobowosc).toBe('INDYWIDUALISTA');
    expect(c.poTurze2Aktywne).toBe(false);
    expect(c.forma).toBeNull();
    expect(c.najlepszaTura).toBeNull();
  });

  it('DarekJell — ręcznie zweryfikowane liczby (spec §9)', () => {
    const c = out.cards.DarekJell;
    expect(c.points).toBe(21);
    expect(c.celnoscPct).toBe(63);
    expect(c.dokladne).toBe(3);
    expect(c.srPktMecz).toBeCloseTo(2.6, 5);
    expect(c.nosRemisowPct).toBe(100);
    expect(c.nosRemisowNd).toBe(false);
  });
});
```

- [ ] **Step 3: Uruchom — ma failować**

Run: `npx vitest run compute/cards.test.ts`
Expected: FAIL — `out.cards` jest `undefined`.

- [ ] **Step 4: Dolicz `cards` w `compute/buildResults.ts`**

Zastąp import typów silnika (linia 7):

```typescript
import { playerCard } from '../engine/playerCard';
import type { MatchEntry, TurnScore, CardStats, PlayerCardInput } from '../engine/types';
```

W ciele `buildResults`, PO obliczeniu `const general: TableRow[] = ...` (przed `return`), dodaj:

```typescript
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
```

W instrukcji `return` dołóż `cards`:

```typescript
  return { generatedAt, general, groups, turns: buildTurns(roster, turns, results), cards };
```

- [ ] **Step 5: Uruchom — ma przejść**

Run: `npx vitest run compute/cards.test.ts`
Expected: PASS (5 testów).

Jeśli liczba Talvik/DarekJell się nie zgadza — NIE „naprawiaj" pod test: zweryfikuj definicję w spec §4 i ewentualnie skoryguj silnik (to ground truth). Użyj `superpowers:systematic-debugging`.

- [ ] **Step 6: Zregeneruj results.json i sprawdź sekcję cards**

Run:
```bash
npm run build:results
node -e "const d=require('./public/data/results.json'); console.log(JSON.stringify(d.cards.Talvik,null,2))"
```
Expected: komplet stat Talvik z `generalPos`, `points`, `groupPos` itd.

- [ ] **Step 7: Pełny test + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add compute/buildResults.ts compute/types.ts compute/cards.test.ts public/data/results.json
git commit -m "feat(compute): sekcja cards w results.json (hero z general, staty z tur)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Zależności (satori, sharp) + font TTF

**Files:**
- Modify: `package.json` (devDependencies)
- Create: `assets/fonts/PressStart2P.ttf` (kopia z prototypu)

- [ ] **Step 1: Skopiuj font do repo**

Run (Git Bash):
```bash
mkdir -p assets/fonts
cp .superpowers/cardproto/PressStart2P.ttf assets/fonts/PressStart2P.ttf
ls -l assets/fonts/PressStart2P.ttf
```
Expected: plik ~118 KB istnieje.

- [ ] **Step 2: Zainstaluj satori + sharp jako devDependencies**

Run:
```bash
npm install --save-dev satori sharp
```
Expected: `package.json` ma `satori` i `sharp` w `devDependencies`; instalacja bez błędów.

- [ ] **Step 3: Sanity fontu**

Run:
```bash
node -e "const fs=require('fs'); const b=fs.readFileSync('assets/fonts/PressStart2P.ttf'); console.log('TTF bytes:', b.length, 'magic:', b.toString('hex',0,4))"
```
Expected: `magic: 00010000` i sensowna liczba bajtów.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json assets/fonts/PressStart2P.ttf
git commit -m "chore(deps): satori + sharp do generowania kart; font Press Start 2P TTF

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: `scripts/buildCards.mjs` + `npm run build:cards`

**Files:**
- Create: `scripts/buildCards.mjs`
- Modify: `package.json` (scripts)
- Modify: `.gitignore` (ignoruj `public/karty/`)

- [ ] **Step 1: Dodaj `public/karty/` do `.gitignore`**

Dopisz na końcu `.gitignore`:

```
public/karty/
```

- [ ] **Step 2: Napisz `scripts/buildCards.mjs`**

```javascript
// npm run build:cards — renderuje kartę każdego gracza do public/karty/<id>.png
// (Satori → SVG → sharp → PNG). Layout karty zdefiniowany TU (jedyne źródło wyglądu).
// Czyta gotowe staty z public/data/results.json (sekcja cards). Uruchamiać PO build:results.
import { mkdirSync, readFileSync } from 'node:fs';
import satori from 'satori';
import sharp from 'sharp';

const data = JSON.parse(readFileSync('public/data/results.json', 'utf8'));
const font = readFileSync('assets/fonts/PressStart2P.ttf');
const OUT = 'public/karty';
mkdirSync(OUT, { recursive: true });

const S = 2; // skala 2× dla ostrości (wektory, bez rozmycia)
const px = (v) => v * S;
const FONT = 'PSP';

const h = (style, children) => ({ type: 'div', props: { style, children } });
const txt = (style, t) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children: t } });
const dash = (nd, v) => (nd ? '—' : v);
const formaGlyph = (f) => (f === 'UP' ? '^' : f === 'DOWN' ? 'v' : '=');

const attrRow = (label, value, opts = {}) =>
  h(
    {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: `${px(8)}px 0`, borderBottom: `${px(2)}px solid #143d16`,
    },
    [
      txt({ fontSize: px(9), color: opts.dim ? '#6e8c66' : '#fff' }, label),
      txt({ fontSize: px(12), color: opts.dim ? '#6e8c66' : '#ffd600' }, String(value)),
    ],
  );

const sec = (t, dim) =>
  txt(
    { fontSize: px(8), color: dim ? '#5c7556' : '#76ff03', padding: `${px(12)}px ${px(16)}px ${px(4)}px`, letterSpacing: px(1) },
    t,
  );

function buildCard(nick, c) {
  const najl = c.poTurze2Aktywne && c.najlepszaTura ? `T${c.najlepszaTura.turn} (${c.najlepszaTura.points})` : '—';
  const forma = c.poTurze2Aktywne && c.forma ? formaGlyph(c.forma) : '—';
  return h(
    {
      display: 'flex', flexDirection: 'column', width: px(360), backgroundColor: '#1b5e20',
      border: `${px(4)}px solid #ffd600`, borderRadius: px(6), fontFamily: FONT, color: '#fff',
    },
    [
      // nagłówek
      h(
        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#143d16', padding: `${px(13)}px ${px(16)}px`, borderBottom: `${px(4)}px solid #ffd600` },
        [txt({ fontSize: px(17), color: '#ffd600' }, nick), txt({ fontSize: px(9), color: '#76ff03' }, `GRUPA ${c.group} ★`)],
      ),
      // hero EVERGREEN: miejsce w tabeli ogólnej + punkty całkowite
      h(
        { display: 'flex', borderBottom: `${px(3)}px solid #2e7d32` },
        [
          h({ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: `${px(14)}px 0` },
            [txt({ fontSize: px(26), color: '#ffd600' }, '#' + c.generalPos), txt({ fontSize: px(7), color: '#cde8c0', marginTop: px(8) }, 'MIEJSCE OGÓLNE')]),
          h({ display: 'flex', width: px(3), backgroundColor: '#2e7d32' }, []),
          h({ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: `${px(14)}px 0` },
            [txt({ fontSize: px(26), color: '#76ff03' }, String(c.points)), txt({ fontSize: px(7), color: '#cde8c0', marginTop: px(8) }, 'PUNKTY')]),
        ],
      ),
      // WYNIKI (faza grupowa)
      sec('> WYNIKI'),
      h({ display: 'flex', flexDirection: 'column', padding: `0 ${px(16)}px` },
        [
          attrRow('MIEJSCE W GRUPIE', '#' + c.groupPos),
          attrRow('CELNOŚĆ', c.celnoscPct + '%'),
          attrRow('DOKŁADNE WYNIKI', c.dokladne),
          attrRow('ŚR. PKT / MECZ', c.srPktMecz.toFixed(1)),
        ]),
      // STYL GRY
      sec('> STYL GRY'),
      h({ display: 'flex', flexDirection: 'column', padding: `0 ${px(16)}px` },
        [
          attrRow('ODWAGA', c.odwagaPct + '%'),
          attrRow('NOS DO REMISÓW', dash(c.nosRemisowNd, c.nosRemisowPct + '%')),
          attrRow('NAJDŁUŻSZA SERIA', c.seria),
          attrRow('OFENSYWA', c.ofensywa.toFixed(1)),
          attrRow('PEWNIAK', dash(c.pewniakNd, c.pewniak.toFixed(1))),
          attrRow('ULUBIONY WYNIK', c.ulubionyWynik),
        ]),
      // plakietka osobowości
      h({ display: 'flex', justifyContent: 'center', padding: `${px(10)}px ${px(16)}px ${px(2)}px` },
        [txt({ fontSize: px(9), color: '#143d16', backgroundColor: '#76ff03', padding: `${px(7)}px ${px(10)}px`, borderRadius: px(3) }, `★ ${c.osobowosc} · ZGODNOŚĆ ${c.zgodnoscPct}%`)]),
      // PO TURZE 2
      sec('> PO TURZE 2', !c.poTurze2Aktywne),
      h({ display: 'flex', flexDirection: 'column', padding: `0 ${px(16)}px` },
        [attrRow('FORMA', forma, { dim: !c.poTurze2Aktywne }), attrRow('NAJLEPSZA TURA', najl, { dim: !c.poTurze2Aktywne })]),
      // branding
      h({ display: 'flex', justifyContent: 'center', backgroundColor: '#143d16', padding: `${px(12)}px 0`, borderTop: `${px(3)}px solid #ffd600`, marginTop: px(10) },
        [txt({ fontSize: px(7), color: '#cde8c0' }, 'typowaniemundial.vercel.app')]),
    ],
  );
}

let count = 0;
for (const [nick, c] of Object.entries(data.cards)) {
  const svg = await satori(buildCard(nick, c), {
    width: px(360),
    fonts: [{ name: FONT, data: font, weight: 400, style: 'normal' }],
  });
  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${nick}.png`);
  count += 1;
}
console.log(`OK: ${count} kart → ${OUT}/`);
```

> Uwaga o foncie: Press Start 2P nie ma glifów strzałek ▲/▼, więc dla FORMY używamy ASCII `^`/`v`/`=`. W v1 i tak jest „—" (1 tura), więc to zabezpieczenie na przyszłość. Pełna legenda atrybutów żyje na podstronie karty (Task 10), nie w PNG.

- [ ] **Step 3: Dodaj skrypt do `package.json`**

W bloku `scripts` dodaj (po `build:results`):

```json
    "build:cards": "node scripts/buildCards.mjs",
```

- [ ] **Step 4: Uruchom i policz PNG-i**

Run:
```bash
npm run build:results && npm run build:cards
ls public/karty/*.png | wc -l
```
Expected: `OK: 56 kart → public/karty/` oraz `56`.

- [ ] **Step 5: Obejrzyj kilka kart**

Otwórz `public/karty/Talvik.png`, `public/karty/DarekJell.png` i gracza z polskim znakiem w nicku (np. `public/karty/Sokółka.png`). Sprawdź: czytelność, polskie znaki, hero = miejsce ogólne + punkty, brak ucięć, paleta zgodna z apką.

- [ ] **Step 6: Commit**

```bash
git add scripts/buildCards.mjs package.json .gitignore
git commit -m "feat(cards): build:cards renderuje karty graczy do PNG (Satori+sharp)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Profil — przycisk „★ KARTA ZAWODNIKA →" + metadataBase + style

**Files:**
- Modify: `app/layout.tsx:6-9` (metadataBase)
- Modify: `app/gracz/[id]/page.tsx` (przycisk na górze)
- Modify: `app/globals.css` (style przycisku + karty — dopisz na końcu)

- [ ] **Step 1: Ustaw `metadataBase` w layoucie**

W `app/layout.tsx` rozszerz `metadata` (potrzebne do absolutnego `og:image` na podstronie karty):

```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://typowaniemundial.vercel.app'),
  title: 'Typowanie Mundial 2026',
  description: 'Wyniki i tabele konkursu typowania Mistrzostw Świata 2026',
};
```

- [ ] **Step 2: Dodaj przycisk na górze profilu**

W `app/gracz/[id]/page.tsx`, w zwracanym JSX, zaraz po `<ScreenFrame title={id.toUpperCase()}>` (przed `<div className="player-summary">`) wstaw:

```tsx
      <a className="card-cta" href={`/gracz/${encodeURIComponent(id)}/karta/`}>★ KARTA ZAWODNIKA →</a>
```

(reszta profilu — `player-summary` i tabele tur — bez zmian.)

- [ ] **Step 3: Dopisz style do `app/globals.css`**

Dodaj na końcu pliku:

```css
/* Wejście na kartę zawodnika (przycisk na profilu) */
.card-cta {
  display: block;
  text-align: center;
  background: var(--zolty);
  color: #143d16;
  padding: 12px 16px;
  margin-bottom: 16px;
  border-radius: 4px;
  text-decoration: none;
  font-size: 11px;
}
.card-cta:hover { filter: brightness(1.1); }

/* Podstrona karty zawodnika */
.card-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.player-card-img {
  width: 100%;
  max-width: 360px;
  height: auto;
  image-rendering: pixelated;
  border-radius: 6px;
}
.card-download {
  display: inline-block;
  background: var(--zolty);
  color: #143d16;
  padding: 10px 16px;
  border-radius: 4px;
  text-decoration: none;
  font-size: 10px;
}
.card-download:hover { filter: brightness(1.1); }
.card-stats, .card-legend { margin-bottom: 20px; }
.card-legend dt { color: var(--neon); margin-top: 10px; }
.card-legend dd { margin: 2px 0 0; font-size: 11px; line-height: 1.6; }
```

> Sprawdź w `globals.css` nazwy zmiennych (`--zolty`, `--neon` wg spec §2). Jeśli inne — użyj istniejących.

- [ ] **Step 4: Build + sprawdź przycisk w HTML**

Run:
```bash
npm run build:results && npm run build:cards && npm run build
node -e "const fs=require('fs'); const d=fs.readdirSync('out/gracz'); const html=fs.readFileSync('out/gracz/'+d[0]+'/index.html','utf8'); console.log('CTA:', html.includes('KARTA ZAWODNIKA'))"
```
Expected: `CTA: true`.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx "app/gracz/[id]/page.tsx" app/globals.css
git commit -m "feat(render): przycisk KARTA ZAWODNIKA na profilu + metadataBase + style

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Podstrona karty `/gracz/[id]/karta/` — obraz, pobieranie, liczby, legenda, og:image

**Files:**
- Create: `app/lib/pngSize.ts`
- Create: `app/gracz/[id]/karta/page.tsx`

- [ ] **Step 1: Helper rozmiaru PNG (bez zależności)**

Utwórz `app/lib/pngSize.ts`:

```typescript
import { closeSync, openSync, readSync } from 'node:fs';

/** Czyta szer./wys. z nagłówka IHDR pliku PNG (bajty 16–23, big-endian). Build-time. */
export function pngSize(absPath: string): { width: number; height: number } {
  const fd = openSync(absPath, 'r');
  try {
    const buf = Buffer.alloc(24);
    readSync(fd, buf, 0, 24, 0);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } finally {
    closeSync(fd);
  }
}
```

- [ ] **Step 2: Napisz podstronę karty**

Utwórz `app/gracz/[id]/karta/page.tsx` (uwaga na poziomy `../` — plik jest 4 katalogi w głąb):

```tsx
import path from 'node:path';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { pngSize } from '../../../lib/pngSize';
import { loadResults } from '../../../lib/results';

export function generateStaticParams() {
  return loadResults().general.map((r) => ({ id: r.participantId }));
}

function cardUrl(id: string): string {
  return `/karty/${encodeURIComponent(id)}.png`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const img = cardUrl(id);
  const { width, height } = pngSize(path.join(process.cwd(), 'public', 'karty', `${id}.png`));
  return {
    title: `${id} — karta zawodnika · Typowanie Mundial 2026`,
    openGraph: { title: `${id} — karta zawodnika`, images: [{ url: img, width, height }] },
    twitter: { card: 'summary_large_image', images: [img] },
  };
}

export default async function KartaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const data = loadResults();
  const row = data.general.find((r) => r.participantId === id);
  if (!row) notFound();
  const c = data.cards[id];
  const img = cardUrl(id);

  const pct = (v: number) => `${Math.round(v)}%`;
  const one = (v: number) => v.toFixed(1);

  return (
    <ScreenFrame title={`${id.toUpperCase()} — KARTA`}>
      <div className="card-wrap">
        {/* PNG = jedyne źródło wyglądu karty (to-co-widzisz = to-co-udostępniasz). */}
        <img className="player-card-img" src={img} width={720} alt={`Karta zawodnika ${id}`} />
        <a className="card-download" href={img} download={`karta-${id}.png`}>
          POBIERZ KARTĘ (PNG)
        </a>
        <a className="card-download" href={`/gracz/${encodeURIComponent(id)}/`}>← POWRÓT DO PROFILU</a>
      </div>

      {/* Te same liczby jako dostępny tekst (a11y/SEO). */}
      <section className="card-stats" aria-label="Statystyki karty">
        <h2 className="turn-heading">★ STATYSTYKI ★</h2>
        <table className="retro-table">
          <tbody>
            <tr><td>MIEJSCE OGÓLNE</td><td className="num">{c.generalPos}. / {data.general.length}</td></tr>
            <tr><td>PUNKTY (RAZEM)</td><td className="num">{c.points}</td></tr>
            <tr><td>MIEJSCE W GRUPIE {row.group}</td><td className="num">{c.groupPos}. / {data.groups[row.group].length}</td></tr>
            <tr><td>CELNOŚĆ</td><td className="num">{pct(c.celnoscPct)}</td></tr>
            <tr><td>DOKŁADNE WYNIKI</td><td className="num">{c.dokladne}</td></tr>
            <tr><td>ŚR. PKT / MECZ</td><td className="num">{one(c.srPktMecz)}</td></tr>
            <tr><td>ODWAGA</td><td className="num">{pct(c.odwagaPct)}</td></tr>
            <tr><td>NOS DO REMISÓW</td><td className="num">{c.nosRemisowNd ? '—' : pct(c.nosRemisowPct)}</td></tr>
            <tr><td>NAJDŁUŻSZA SERIA</td><td className="num">{c.seria}</td></tr>
            <tr><td>OFENSYWA</td><td className="num">{one(c.ofensywa)}</td></tr>
            <tr><td>PEWNIAK</td><td className="num">{c.pewniakNd ? '—' : one(c.pewniak)}</td></tr>
            <tr><td>ULUBIONY WYNIK</td><td className="num">{c.ulubionyWynik}</td></tr>
            <tr><td>ZGODNOŚĆ Z TŁUMEM</td><td className="num">{pct(c.zgodnoscPct)} · {c.osobowosc}</td></tr>
          </tbody>
        </table>
      </section>

      {/* Legenda: jak liczymy każdy atrybut (wszystko z typów i wyników). */}
      <section className="card-legend" aria-label="Legenda atrybutów">
        <h2 className="turn-heading">★ JAK TO LICZYMY ★</h2>
        <dl>
          <dt>MIEJSCE OGÓLNE</dt><dd>Twoja pozycja w tabeli ogólnej (wszyscy gracze). Aktualna przez cały turniej.</dd>
          <dt>PUNKTY</dt><dd>Całkowity dorobek: punkty z 3 tur fazy grupowej + bonus grupowy + faza pucharowa.</dd>
          <dt>MIEJSCE W GRUPIE</dt><dd>Pozycja w Twojej 7-osobowej grupie konkursowej.</dd>
          <dt>CELNOŚĆ</dt><dd>% rozegranych meczów, w których trafiłeś (każde trafienie za 3/4/5 pkt).</dd>
          <dt>DOKŁADNE WYNIKI</dt><dd>Ile razy trafiłeś wynik co do gola (mecz za 5 pkt).</dd>
          <dt>ŚR. PKT / MECZ</dt><dd>Średni dorobek na rozegrany mecz fazy grupowej.</dd>
          <dt>ODWAGA</dt><dd>% Twoich typów spoza „bezpiecznych" wyników (1:0, 0:1, 1:1, 0:0). Im wyżej, tym śmielej typujesz.</dd>
          <dt>NOS DO REMISÓW</dt><dd>Z wytypowanych remisów ile trafiłeś (%). Brak typowanych remisów → „—".</dd>
          <dt>NAJDŁUŻSZA SERIA</dt><dd>Najdłuższy ciąg trafień pod rząd (w kolejności meczów).</dd>
          <dt>OFENSYWA</dt><dd>Średnia liczba goli w Twoich typach (gospodarze + goście).</dd>
          <dt>PEWNIAK</dt><dd>Średnia punktów liczona tylko z meczów, które trafiłeś. Brak trafień → „—".</dd>
          <dt>ULUBIONY WYNIK</dt><dd>Najczęściej typowany przez Ciebie wynik.</dd>
          <dt>ZGODNOŚĆ Z TŁUMEM</dt><dd>Średni % graczy, którzy typowali identycznie jak Ty. Daje plakietkę: poniżej 33% — INDYWIDUALISTA, 60% i więcej — OWCZY PĘD, pomiędzy — NEUTRALNY.</dd>
          <dt>FORMA</dt><dd>Trend: czy ostatnia tura z wynikami była lepsza, gorsza czy równa poprzedniej. Aktywne po 2 turach.</dd>
          <dt>NAJLEPSZA TURA</dt><dd>Tura z najwyższym dorobkiem. Aktywne po 2 turach.</dd>
        </dl>
      </section>
    </ScreenFrame>
  );
}
```

> Legenda celowo opisuje też składniki, które na karcie są jeszcze uśpione (FORMA, NAJLEPSZA TURA, puchar w PUNKTACH) — żeby definicje były komplet od startu.

- [ ] **Step 3: Build (PNG muszą już istnieć) + sprawdź og:image**

Run:
```bash
npm run build:results && npm run build:cards && npm run build
node -e "const fs=require('fs'); const d=fs.readdirSync('out/gracz'); const html=fs.readFileSync('out/gracz/'+d[0]+'/karta/index.html','utf8'); console.log('og:image:', html.includes('og:image'), '| karty:', html.includes('/karty/'), '| twitter:', html.includes('summary_large_image'), '| legenda:', html.includes('JAK TO LICZYMY'))"
```
Expected: wszystkie `true`.

- [ ] **Step 4: Ogląd w przeglądarce**

`npm run dev` → otwórz `http://localhost:3000/gracz/Talvik/`, kliknij „★ KARTA ZAWODNIKA →", sprawdź `http://localhost:3000/gracz/Talvik/karta/`: karta-obraz, działające pobieranie (`karta-Talvik.png`), tabela STATYSTYKI, czytelna legenda, powrót do profilu. Sprawdź też profil gracza z polskim znakiem w nicku.

- [ ] **Step 5: Commit**

```bash
git add app/lib/pngSize.ts "app/gracz/[id]/karta/page.tsx"
git commit -m "feat(render): podstrona karty zawodnika (img + pobieranie + liczby + legenda + og:image)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: Smoke + bramka jakości + Vercel buildCommand

**Files:**
- Modify: `scripts/smoke.ts`
- Create: `vercel.json`

- [ ] **Step 1: Rozszerz `scripts/smoke.ts`**

Zaktualizuj import na górze (linia 2):

```typescript
import { existsSync, readdirSync, readFileSync } from 'node:fs';
```

Przed końcowym `console.log(...)` dodaj:

```typescript
// Karta zawodnika: PNG per gracz, przycisk na profilu, og:image + legenda na podstronie karty.
const kartyCount = existsSync('out/karty')
  ? readdirSync('out/karty').filter((f) => f.endsWith('.png')).length
  : 0;
if (kartyCount !== results.general.length) {
  console.error(`SMOKE FAIL: ${kartyCount} kart w out/karty, oczekiwano ${results.general.length}`);
  process.exit(1);
}
const graczDir = readdirSync('out/gracz')[0];
const profilHtml = readFileSync(`out/gracz/${graczDir}/index.html`, 'utf8');
if (!profilHtml.includes('KARTA ZAWODNIKA')) {
  console.error(`SMOKE FAIL: brak przycisku „KARTA ZAWODNIKA" w out/gracz/${graczDir}/index.html`);
  process.exit(1);
}
const kartaHtml = readFileSync(`out/gracz/${graczDir}/karta/index.html`, 'utf8');
for (const marker of ['og:image', '/karty/', 'summary_large_image', 'JAK TO LICZYMY']) {
  if (!kartaHtml.includes(marker)) {
    console.error(`SMOKE FAIL: brak "${marker}" w out/gracz/${graczDir}/karta/index.html`);
    process.exit(1);
  }
}
```

Zaktualizuj końcowy log:

```typescript
console.log(`SMOKE OK: lider "${lider}" w tabeli, ${matches} meczy, ${kartyCount} kart, przycisk + podstrona karty (og:image, legenda), intro + muzyka`);
```

- [ ] **Step 2: Uruchom pełną bramkę lokalnie (poprawiona kolejność)**

Run:
```bash
npm test && npm run typecheck && npm run build:results && npm run build:cards && npm run build && npm run smoke
```
Expected: wszystko zielone; smoke kończy się `SMOKE OK: ... 56 kart, przycisk + podstrona karty ...`.

- [ ] **Step 3: Dodaj `vercel.json`**

Utwórz `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build:cards && npm run build"
}
```

> `results.json` jest commitowany (robot), więc Vercel czyta gotową sekcję `cards`, renderuje świeże PNG do `public/karty/`, a `next build` (static export) kopiuje je do `out/`. `build:results` na Vercelu nie jest potrzebny.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke.ts vercel.json
git commit -m "test(smoke): karty + podstrona; vercel buildCommand generuje karty przy buildzie

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: Ogląd, akcept użytkownika, wdrożenie

> Zadanie proceduralne (nie kod) — spec §10 + pamięć „nie mów «działa» bez dowodu".

- [ ] **Step 1: Finalna bramka lokalna (dowód)**

Run:
```bash
npm test && npm run typecheck && npm run build:results && npm run build:cards && npm run build && npm run smoke
```
Expected: wszystko zielone. Pokaż output jako dowód.

- [ ] **Step 2: Ogląd w przeglądarce**

`npm run dev` → 3–4 profile (w tym nick z polskim znakiem): przycisk na profilu → podstrona karty, hero evergreen, pobieranie PNG, STATYSTYKI, legenda, powrót. Brak regresji w widoku tur/tabel.

- [ ] **Step 3: Akcept organizatora definicji atrybutów (spec §11)**

Pokaż organizatorowi legendę z podstrony karty (ODWAGA, NOS DO REMISÓW, ZGODNOŚĆ, progi osobowości). Zbierz „ok".

- [ ] **Step 4: WYRAŹNY akcept użytkownika na push**

NIE pushuj bez wyraźnej zgody (CLAUDE.md/pamięć). Po akcepcie:

```bash
git push
```
Vercel z nowym `buildCommand` przebuduje produkcję i wyrenderuje karty.

- [ ] **Step 5: Weryfikacja produkcji (dowód realnego dowiezienia)**

Po deployu: `…/gracz/Talvik/` → przycisk → `…/gracz/Talvik/karta/`, sprawdź kartę i pobieranie; wklej link do podstrony karty na czacie testowym i potwierdź unfurl (podgląd og:image). Dopiero teraz uznaj funkcję za dowiezioną.

---

## Self-Review (wykonane)

**Pokrycie spec (z aktualizacjami 2026-06-15: evergreen + osobna podstrona):**
- §2/§3/§5 wejście na kartę: przycisk „★ KARTA ZAWODNIKA →" na profilu (Task 9) → podstrona `/gracz/[id]/karta/` (Task 10) z PNG, pobieraniem, liczbami i legendą — ✅
- §2/§3/§4 hero evergreen: `generalPos` + `points` total z `general`; `groupPos` jako wiersz stat; `srPktMecz` z fazy grupowej (Task 1/2/6/8/10) — ✅
- §3 zakres: karta 56 graczy, PNG per gracz, pobieranie + og:image na podstronie, atrybuty §4; puchar poza planem — ✅
- §4 atrybuty: WYNIKI (Task 2), STYL GRY (Task 3+4), PO TURZE 2 (Task 5), plakietka (Task 4); legenda definicji (Task 10) — ✅
- §5 granice: engine czysty (Task 2–5), compute dolicza cards (Task 6), buildCards = layout PNG (Task 8), app czyta tylko results.json + PNG (Task 9/10) — ✅
- §6 PNG: satori+sharp+TTF (Task 7), skala 2× (Task 8), og:width/height z realnego PNG (Task 10 pngSize), odświeżanie przez Vercel buildCommand (Task 11) — ✅
- §7 kształt `cards`: typ CardStats (Task 1), wpięcie (Task 6); doprecyzowania ponad §7: `points`=total (evergreen), dodane `generalPos`; `forma`='UP'/'DOWN'/'FLAT'|null; `najlepszaTura`={turn,points}|null — ✅
- §8 edge: brak remisów / zero trafień / <2 tury / remis częstości (testy Task 3/4/5) — ✅
- §9 testy+bramka: TDD Talvik/DarekJell (Task 6), smoke (Task 11); kolejność bramki poprawiona (build:cards przed build) — ✅
- §10 workflow: ogląd + akcept + push (Task 12); odświeżanie kart przez Vercel buildCommand zamiast commitu PNG — ✅
- §11 akcept organizatora: Task 12 Step 3; legenda na podstronie (Task 10) — ✅

**Placeholdery:** brak „TBD/TODO"; każdy krok ma konkretny kod/komendę i oczekiwany wynik.

**Spójność typów:** `CardStats`/`PlayerCardInput`/`PlayerCardMatch`/`PlayerCardTurn`/`Forma`/`Osobowosc`/`BestTurn` w Task 1, używane spójnie dalej. `playerCard(input)` stała sygnatura; wejście wymaga `generalPos`+`totalPoints` (hero) od Task 1, więc testy w Task 2–5 podają te pola. `points` w CardStats = `totalPoints` (hero), `srPktMecz` z `groupPoints` (faza grupowa) — rozróżnienie udokumentowane i przetestowane (Task 2). Ścieżki importów podstrony karty (Task 10) liczone dla `app/gracz/[id]/karta/` (4 poziomy w głąb).
