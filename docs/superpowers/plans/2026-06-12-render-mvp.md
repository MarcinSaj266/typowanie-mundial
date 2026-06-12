# Render MVP — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pierwsza widoczna wersja aplikacji — 4 statyczne widoki (menu, tabela ogólna, grupy A–H, mecze + profil gracza) w stylistyce retro 16-bit, generowane z `public/data/results.json` przez Next.js static export.

**Architecture:** Najpierw rozszerzamy `compute/buildResults` o sekcję `turns` (szczegóły per mecz, punkty z istniejącego `scoreMatchK1` — zero nowej logiki punktacji). Potem stawiamy Next.js App Router z `output: 'export'`: komponenty serwerowe czytają JSON przez `fs` w czasie builda, jedyna interaktywność (rozwijanie typów przy meczu) realizowana natywnym `<details>` — zero klientowego JS (spec przewidywał `'use client'` w MatchCard; `<details>` daje to samo UX prościej, decyzja odnotowana).

**Tech Stack:** TypeScript, Vitest (TDD dla compute), Next.js (App Router, static export), czysty CSS (bez Tailwinda), font Press Start 2P hostowany lokalnie.

**Spec:** `docs/superpowers/specs/2026-06-12-render-mvp-design.md`

**Granice modułów:** `app/` i `components/` czytają wyłącznie `public/data/results.json`; jedyna zależność od `compute/` to importy **typów** (`import type` — znikają w buildzie). Silnik i ingest nietknięte.

---

### Task 0: Gałąź robocza

- [ ] **Step 1: Utwórz gałąź**

```bash
git checkout -b feat/render-mvp
```

---

### Task 1: Typy `turns` w compute

**Files:**
- Modify: `compute/types.ts`

- [ ] **Step 1: Rozszerz typy**

W `compute/types.ts` zamień definicję `TurnData` i `ResultsJson` oraz dodaj nowe typy (reszta pliku bez zmian):

```ts
/** Mecz w turze (kształt fixtures z data/k1/tura-N.json). */
export interface Fixture {
  no: number;
  home: string;
  away: string;
  kickoff: string;
}

/** Dane tury z ingestu (kształt data/k1/tura-N.json). */
export interface TurnData {
  turn: number;
  fixtures: Fixture[];
  predictions: Record<string, Record<string, Score>>;
}

/** Typ uczestnika na mecz w wyjściowym results.json.
 *  pick: null = brak typu; points: null = mecz nierozegrany LUB brak typu (sekcja 4 specu). */
export interface PredictionOut {
  pick: Score | null;
  points: number | null;
}

/** Mecz w sekcji turns wyjściowego results.json. */
export interface MatchOut {
  no: number;
  home: string;
  away: string;
  kickoff: string;
  /** null = mecz nierozegrany. */
  result: Score | null;
  /** Klucz = participantId; komplet osób z rosteru. */
  predictions: Record<string, PredictionOut>;
}

/** Tura w sekcji turns wyjściowego results.json. */
export interface TurnOut {
  turn: number;
  matches: MatchOut[];
}

/** Wyjście dla UI: public/data/results.json. */
export interface ResultsJson {
  generatedAt: string;
  general: TableRow[];
  groups: Record<Group, TableRow[]>;
  turns: TurnOut[];
}
```

- [ ] **Step 2: Napraw istniejące fixtures w testach**

Synteyczne fixtures w `compute/buildResults.test.ts` mają teraz tylko `{ no }` — typ `Fixture` wymaga pełnych pól. Zamień w `turn1`:

```ts
const turn1: TurnData = {
  turn: 1,
  fixtures: [
    { no: 1, home: 'Meksyk', away: 'RPA', kickoff: 'czwartek, 11 cze godz.21.00' },
    { no: 2, home: 'Korea Płd.', away: 'Czechy', kickoff: 'piątek, 12 cze godz. 04.00' },
    { no: 3, home: 'Kanada', away: 'Bośnia', kickoff: 'piątek 12 cze godz. 21.00' },
  ],
  predictions: {
    a1: { '1': { home: 2, away: 1 }, '2': { home: 1, away: 1 }, '3': { home: 1, away: 0 } },
    a2: { '1': { home: 1, away: 0 }, '2': { home: 1, away: 0 } },
    b1: { '1': { home: 5, away: 0 } },
    b2: {},
  },
};
```

Sprawdź też `compute/seed.ts` / `compute/seed.test.ts`: jeśli `seed` przyjmuje własny minimalny typ `{ no: number }[]`, zostaw bez zmian (typowanie strukturalne przyjmie `Fixture[]`); jeśli importuje typ fixtures z `compute/types.ts`, dostosuj analogicznie.

- [ ] **Step 3: Typecheck — pokaż, co jeszcze się wywala**

Run: `npm run typecheck`
Expected: błędy TYLKO w miejscach z niepełnymi fixtures (napraw je); `buildResults.ts` nie zwraca jeszcze `turns` — TS zgłosi brak property `turns` w zwracanym obiekcie. To naprawi Task 2 (TDD). Jeśli chcesz zielony typecheck już teraz, NIE dodawaj implementacji — dodaj tymczasowo `turns: []` w literale zwrotnym `buildResults` (test z Task 2 i tak go wymusi poprawnie).

- [ ] **Step 4: Commit**

```bash
git add compute/types.ts compute/buildResults.test.ts compute/buildResults.ts
git commit -m "feat(compute): typy sekcji turns w results.json"
```

---

### Task 2: `buildResults` generuje sekcję `turns` (TDD)

**Files:**
- Modify: `compute/buildResults.ts`
- Test: `compute/buildResults.test.ts`

- [ ] **Step 1: Napisz testy (failing)**

Dopisz do `compute/buildResults.test.ts` (pod istniejącym `describe('buildResults (syntetycznie)')`, korzysta z tych samych `roster`/`turn1`/`results`/`out`):

```ts
describe('buildResults: sekcja turns', () => {
  const t1 = out.turns[0];

  it('jedna tura, mecze w kolejnosci fixtures z metadanymi', () => {
    expect(out.turns).toHaveLength(1);
    expect(t1.turn).toBe(1);
    expect(t1.matches.map((m) => m.no)).toEqual([1, 2, 3]);
    expect(t1.matches[0]).toMatchObject({
      home: 'Meksyk',
      away: 'RPA',
      kickoff: 'czwartek, 11 cze godz.21.00',
    });
  });

  it('wynik meczu z results; brak wyniku = null', () => {
    expect(t1.matches[0].result).toEqual({ home: 2, away: 1 });
    expect(t1.matches[2].result).toBeNull();
  });

  it('punkty per mecz zgodne ze scoreMatchK1', () => {
    // mecz 1 (2:1): a1 typ 2:1 -> 5; a2 typ 1:0 -> 4; b1 typ 5:0 -> 3
    const m1 = t1.matches[0].predictions;
    expect(m1.a1).toEqual({ pick: { home: 2, away: 1 }, points: 5 });
    expect(m1.a2).toEqual({ pick: { home: 1, away: 0 }, points: 4 });
    expect(m1.b1).toEqual({ pick: { home: 5, away: 0 }, points: 3 });
  });

  it('brak typu: pick null, points null (takze na rozegranym meczu)', () => {
    expect(t1.matches[0].predictions.b2).toEqual({ pick: null, points: null });
  });

  it('mecz nierozegrany: typ widoczny, points null', () => {
    expect(t1.matches[2].predictions.a1).toEqual({
      pick: { home: 1, away: 0 },
      points: null,
    });
  });

  it('komplet rosteru w predictions kazdego meczu', () => {
    for (const m of t1.matches) {
      expect(Object.keys(m.predictions).sort()).toEqual(['a1', 'a2', 'b1', 'b2']);
    }
  });

  it('spojnosc: suma punktow z turns = points w tabeli ogolnej', () => {
    for (const row of out.general) {
      const sum = out.turns
        .flatMap((t) => t.matches)
        .reduce((acc, m) => acc + (m.predictions[row.participantId].points ?? 0), 0);
      expect(sum).toBe(row.points);
    }
  });
});
```

Dopisz też do `describe('buildResults (realne dane + atrapy)')`:

```ts
  it('turns: tura 1 ma 24 mecze, kazdy z 56 typami', () => {
    expect(real.turns).toHaveLength(1);
    expect(real.turns[0].matches).toHaveLength(24);
    for (const m of real.turns[0].matches) {
      expect(Object.keys(m.predictions)).toHaveLength(56);
    }
  });
```

- [ ] **Step 2: Uruchom — testy mają polec**

Run: `npx vitest run compute/buildResults.test.ts`
Expected: FAIL — `out.turns` jest `undefined` (lub `[]` po tymczasowym stubie z Task 1).

- [ ] **Step 3: Implementacja**

W `compute/buildResults.ts`:

Dodaj importy:

```ts
import { scoreMatchK1 } from '../engine/scoreMatch';
import type { MatchOut, TurnOut } from './types';
```

Dodaj funkcję pomocniczą (nad `buildResults`):

```ts
/** Sekcja turns: szczegóły per mecz dla widoków „Mecze" i „Profil" (sekcja 1 specu renderu). */
function buildTurns(roster: Participant[], turns: TurnData[], results: ResultsByTurn): TurnOut[] {
  return [...turns]
    .sort((a, b) => a.turn - b.turn)
    .map((t) => ({
      turn: t.turn,
      matches: t.fixtures.map((f): MatchOut => {
        const result = results[String(t.turn)]?.[String(f.no)] ?? null;
        const predictions = Object.fromEntries(
          roster.map((p) => {
            const pick = t.predictions[p.id]?.[String(f.no)] ?? null;
            const points = pick && result ? scoreMatchK1(pick, result) : null;
            return [p.id, { pick, points }];
          }),
        );
        return { no: f.no, home: f.home, away: f.away, kickoff: f.kickoff, result, predictions };
      }),
    }));
}
```

W literale zwrotnym `buildResults` zamień `return { generatedAt, general, groups };` na:

```ts
return { generatedAt, general, groups, turns: buildTurns(roster, turns, results) };
```

(Usuń stub `turns: []`, jeśli był.)

- [ ] **Step 4: Testy zielone**

Run: `npm test`
Expected: wszystkie pliki PASS (61 dotychczasowych + 8 nowych). `npm run typecheck` też zielony.

- [ ] **Step 5: Commit**

```bash
git add compute/buildResults.ts compute/buildResults.test.ts
git commit -m "feat(compute): sekcja turns w results.json (typy + punkty per mecz)"
```

---

### Task 3: Regeneracja `public/data/results.json`

**Files:**
- Modify: `public/data/results.json` (generowany)

- [ ] **Step 1: Przebuduj**

Run: `npm run build:results`
Expected: `OK: 56 osob, lider ... → public/data/results.json` (CLI bez zmian — `buildResults` sam dokłada `turns`).

- [ ] **Step 2: Sanity-check wyjścia**

Run (PowerShell-safe, przez node):

```bash
node -e "const r=require('./public/data/results.json'); console.log(r.turns.length, r.turns[0].matches.length, Object.keys(r.turns[0].matches[0].predictions).length)"
```

Expected: `1 24 56`

- [ ] **Step 3: Commit**

```bash
git add public/data/results.json
git commit -m "feat(data): results.json z sekcja turns"
```

---

### Task 4: Szkielet Next.js (static export) + font + layout

**Files:**
- Modify: `package.json`, `tsconfig.json`, `.gitignore`
- Create: `next.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/lib/results.ts`, `scripts/fetchFont.mjs`, `public/fonts/press-start-2p-latin.woff2`, `public/fonts/press-start-2p-latin-ext.woff2`

- [ ] **Step 1: Instalacja zależności**

```bash
npm install next react react-dom
npm install -D @types/react @types/react-dom
```

- [ ] **Step 2: `next.config.ts`**

```ts
import type { NextConfig } from 'next';

// Static export: build generuje czyste HTML-e do out/ (spec renderu, sekcja „Architektura").
// trailingSlash daje out/tabela/index.html zamiast out/tabela.html — przewidywalne ścieżki.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
```

- [ ] **Step 3: Dostosuj `tsconfig.json`**

Zamień całość na (różnice: `jsx`, `lib`, `isolatedModules`, plugin Next, rozszerzone `include`):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["engine", "ingest", "compute", "app", "components", "next-env.d.ts", ".next/types/**/*.ts"]
}
```

Uwaga: `next build` może dopisać drobiazgi do tsconfig (np. `incremental`) i wygenerować `next-env.d.ts` — zaakceptuj te zmiany i dodaj `next-env.d.ts` do repo.

- [ ] **Step 4: `.gitignore`**

Dopisz:

```
.next/
out/
```

- [ ] **Step 5: Pobierz font Press Start 2P (latin + latin-ext) lokalnie**

Utwórz `scripts/fetchFont.mjs`:

```js
// Jednorazowe pobranie Press Start 2P (latin + latin-ext) do public/fonts/.
// Uruchom: node scripts/fetchFont.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const css = await (
  await fetch('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap', {
    headers: { 'user-agent': UA },
  })
).text();

mkdirSync('public/fonts', { recursive: true });
const blocks = [...css.matchAll(/\/\* ([\w-]+) \*\/[^}]*?url\((\S+?\.woff2)\)/g)];
for (const [, subset, url] of blocks) {
  if (subset !== 'latin' && subset !== 'latin-ext') continue;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(`public/fonts/press-start-2p-${subset}.woff2`, buf);
  console.log(`OK ${subset} <- ${url}`);
}
```

Run: `node scripts/fetchFont.mjs`
Expected: dwie linie `OK latin...` / `OK latin-ext...`; pliki w `public/fonts/`.

- [ ] **Step 6: `app/globals.css` — paleta, ramki, tabele retro**

```css
/* Font lokalnie (spec renderu, sekcja 3). Standardowe unicode-range Google Fonts. */
@font-face {
  font-family: 'Press Start 2P';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/press-start-2p-latin-ext.woff2') format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304,
    U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0,
    U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face {
  font-family: 'Press Start 2P';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/press-start-2p-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304,
    U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

:root {
  --czern: #000;
  --murawa: #1b5e20;
  --zolty: #ffd600;
  --neon: #76ff03;
  --bialy: #fff;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--czern);
  color: var(--bialy);
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  line-height: 1.7;
  -webkit-font-smoothing: none;
}

a { color: inherit; }

/* ── Ekran w ramce (wariant B makiety) ─────────────────────────── */
.screen { max-width: 960px; margin: 0 auto; padding: 8px; }

.frame {
  border: 4px solid var(--zolty);
  background: var(--murawa);
  padding-bottom: 12px;
}

.title-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--czern);
  border-bottom: 4px solid var(--zolty);
  padding: 10px;
}
.title-bar h1 {
  margin: 0;
  font-size: 12px;
  font-weight: 400;
  color: var(--zolty);
}
.menu-btn {
  flex-shrink: 0;
  background: var(--zolty);
  color: var(--czern);
  text-decoration: none;
  padding: 6px 8px;
  font-size: 9px;
}
.menu-btn:active { background: var(--neon); }

.screen-body { padding: 10px; overflow-x: auto; }

/* ── Tabela retro ──────────────────────────────────────────────── */
.retro-table { width: 100%; border-collapse: collapse; }
.retro-table th {
  color: var(--zolty);
  font-weight: 400;
  font-size: 9px;
  text-align: left;
  padding: 6px 5px;
}
.retro-table td {
  padding: 7px 5px;
  border-top: 1px dashed rgba(255, 255, 255, 0.35);
}
.retro-table .num { text-align: right; }
.retro-table .pkt { text-align: right; color: var(--neon); }
.hide-mobile { display: none; }

/* ── Menu główne (ekran tytułowy) ──────────────────────────────── */
.title-screen {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  text-align: center;
}
.game-title {
  font-size: 20px;
  font-weight: 400;
  color: var(--zolty);
  text-shadow: 3px 3px 0 var(--murawa);
  margin: 0;
}
.subtitle { color: var(--neon); margin: 0; }
.menu { display: flex; flex-direction: column; gap: 14px; }
.menu-item {
  border: 4px solid var(--zolty);
  background: var(--murawa);
  padding: 12px 24px;
  text-decoration: none;
}
.menu-item:hover, .menu-item:focus { background: var(--zolty); color: var(--czern); }
.press-start { color: var(--zolty); animation: blink 1.2s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }

/* ── Mecze ─────────────────────────────────────────────────────── */
.turn-heading { color: var(--zolty); font-size: 12px; font-weight: 400; }
.match-card {
  border: 2px solid var(--zolty);
  margin-bottom: 10px;
  background: rgba(0, 0, 0, 0.25);
}
.match-card summary {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 9px;
  cursor: pointer;
  list-style: none;
}
.match-card summary::-webkit-details-marker { display: none; }
.match-card[open] summary { border-bottom: 2px dashed var(--zolty); }
.match-no { color: var(--zolty); }
.match-teams { flex: 1; }
.match-score { color: var(--neon); }
.kickoff { color: rgba(255, 255, 255, 0.7); font-size: 8px; padding: 0 9px; }
.match-card .screen-body { padding: 0 9px 9px; }

/* ── Profil gracza ─────────────────────────────────────────────── */
.player-summary { display: flex; flex-wrap: wrap; gap: 16px; padding: 0 0 10px; }
.player-summary .stat { color: var(--neon); }
.player-summary .label { color: var(--zolty); font-size: 8px; display: block; }

/* ── Grupy ─────────────────────────────────────────────────────── */
.group-section { margin-bottom: 18px; }
.group-heading { color: var(--zolty); font-size: 12px; font-weight: 400; }
.group-nav { display: flex; flex-wrap: wrap; gap: 8px; padding-bottom: 10px; }
.group-nav a {
  border: 2px solid var(--zolty);
  padding: 4px 10px;
  text-decoration: none;
}

/* ── Tablet+ : pełny zestaw kolumn ─────────────────────────────── */
@media (min-width: 768px) {
  body { font-size: 11px; }
  .hide-mobile { display: table-cell; }
  .title-bar h1 { font-size: 14px; }
}
```

- [ ] **Step 7: `app/lib/results.ts` — czytnik danych (build-time)**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
// Import WYŁĄCZNIE typów — znika w buildzie; app/ nie zna silnika (granica modułów).
import type { ResultsJson } from '../../compute/types';

/** Czyta wygenerowany results.json w czasie builda (komponenty serwerowe). */
export function loadResults(): ResultsJson {
  const p = path.join(process.cwd(), 'public', 'data', 'results.json');
  return JSON.parse(readFileSync(p, 'utf8')) as ResultsJson;
}
```

- [ ] **Step 8: `app/layout.tsx`**

```tsx
import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Typowanie Mundial 2026',
  description: 'Wyniki i tabele konkursu typowania Mistrzostw Świata 2026',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Tymczasowy `app/page.tsx` (placeholder, podmieni Task 6)**

```tsx
export default function MenuPage() {
  return <main className="screen">MENU — w budowie</main>;
}
```

- [ ] **Step 10: Skrypty npm + pierwszy build**

W `package.json` dodaj do `scripts`:

```json
"dev": "next dev",
"build": "next build",
```

Run: `npm run build`
Expected: build zielony, katalog `out/` z `index.html`. Potem `npm test` i `npm run typecheck` — nadal zielone.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore next.config.ts next-env.d.ts app scripts/fetchFont.mjs public/fonts
git commit -m "feat(app): szkielet Next.js static export + retro CSS + font lokalnie"
```

---

### Task 5: Komponenty wspólne — `ScreenFrame` i `RetroTable`

**Files:**
- Create: `components/ScreenFrame.tsx`, `components/RetroTable.tsx`

- [ ] **Step 1: `components/ScreenFrame.tsx`**

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

/** Rama ekranu: żółta ramka + czarny pasek tytułu + przycisk „◀ MENU" (wariant B makiety). */
export function ScreenFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="screen">
      <div className="frame">
        <header className="title-bar">
          <Link href="/" className="menu-btn">◀ MENU</Link>
          <h1>★ {title} ★</h1>
        </header>
        <div className="screen-body">{children}</div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: `components/RetroTable.tsx`**

Tabela wspólna dla ogólnej i grupowych (ten sam kształt `TableRow`). Mobile: poz./gracz/pkt/%; tablet+: pełny zestaw.

```tsx
import Link from 'next/link';
// Import wyłącznie typu (granica modułów: app zna tylko kształt JSON-a).
import type { TableRow } from '../compute/types';

/** Link do profilu gracza — używany we wszystkich widokach. */
export function PlayerLink({ id }: { id: string }) {
  return <Link href={`/gracz/${encodeURIComponent(id)}/`}>{id}</Link>;
}

/** Tabela retro: wspólna dla tabeli ogólnej i tabel grup (spec, sekcja 2). */
export function RetroTable({ rows, showGroup = false }: { rows: TableRow[]; showGroup?: boolean }) {
  return (
    <table className="retro-table">
      <thead>
        <tr>
          <th className="num">#</th>
          <th>GRACZ</th>
          {showGroup && <th className="hide-mobile">GR</th>}
          <th className="num hide-mobile">I</th>
          <th className="num hide-mobile">II</th>
          <th className="num hide-mobile">III</th>
          <th className="num hide-mobile">×3</th>
          <th className="num hide-mobile">×4</th>
          <th className="num hide-mobile">×5</th>
          <th className="num">PKT</th>
          <th className="num">%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.participantId}>
            <td className="num">{r.position}</td>
            <td><PlayerLink id={r.participantId} /></td>
            {showGroup && <td className="hide-mobile">{r.group}</td>}
            <td className="num hide-mobile">{r.grI}</td>
            <td className="num hide-mobile">{r.grII}</td>
            <td className="num hide-mobile">{r.grIII}</td>
            <td className="num hide-mobile">{r.count3}</td>
            <td className="num hide-mobile">{r.count4}</td>
            <td className="num hide-mobile">{r.count5}</td>
            <td className="pkt">{r.points}</td>
            <td className="num">{Math.round(r.hitRate * 100)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components
git commit -m "feat(app): komponenty ScreenFrame i RetroTable"
```

---

### Task 6: Menu główne (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Implementacja (podmień placeholder)**

```tsx
import Link from 'next/link';

const MENU = [
  { href: '/tabela/', label: 'TABELA OGÓLNA' },
  { href: '/grupy/', label: 'GRUPY A–H' },
  { href: '/mecze/', label: 'MECZE I TYPY' },
] as const;

export default function MenuPage() {
  return (
    <main className="screen title-screen">
      <h1 className="game-title">TYPOWANIE<br />MUNDIAL 2026</h1>
      <p className="subtitle">★ KONKURS 1 ★</p>
      <nav className="menu">
        {MENU.map((m) => (
          <Link key={m.href} className="menu-item" href={m.href}>{m.label}</Link>
        ))}
      </nav>
      <p className="press-start">PRESS START</p>
    </main>
  );
}
```

(Profile graczy nie mają pozycji w menu — wchodzi się w nie klikając nazwisko, zgodnie ze spekiem.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS (strony /tabela itd. jeszcze nie istnieją — to tylko linki w HTML, build się nie wywali).

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(app): menu glowne (ekran tytulowy)"
```

---

### Task 7: Tabela ogólna (`app/tabela/page.tsx`)

**Files:**
- Create: `app/tabela/page.tsx`

- [ ] **Step 1: Implementacja**

```tsx
import { RetroTable } from '../../components/RetroTable';
import { ScreenFrame } from '../../components/ScreenFrame';
import { loadResults } from '../lib/results';

export default function TabelaPage() {
  const { general } = loadResults();
  return (
    <ScreenFrame title="TABELA OGÓLNA">
      <RetroTable rows={general} showGroup />
    </ScreenFrame>
  );
}
```

- [ ] **Step 2: Build + oględziny**

Run: `npm run build`
Expected: PASS; `out/tabela/index.html` istnieje i zawiera 56 wierszy (sprawdź, że jest w nim lider z `public/data/results.json` — `general[0].participantId`).

- [ ] **Step 3: Commit**

```bash
git add app/tabela
git commit -m "feat(app): widok tabeli ogolnej"
```

---

### Task 8: Grupy A–H (`app/grupy/page.tsx`)

**Files:**
- Create: `app/grupy/page.tsx`

- [ ] **Step 1: Implementacja**

Osiem tabel na jednej stronie + pasek kotwic `#A…#H` (spec, sekcja 2).

```tsx
import { RetroTable } from '../../components/RetroTable';
import { ScreenFrame } from '../../components/ScreenFrame';
import { loadResults } from '../lib/results';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export default function GrupyPage() {
  const { groups } = loadResults();
  return (
    <ScreenFrame title="GRUPY A–H">
      <nav className="group-nav">
        {GROUPS.map((g) => <a key={g} href={`#${g}`}>{g}</a>)}
      </nav>
      {GROUPS.map((g) => (
        <section key={g} id={g} className="group-section">
          <h2 className="group-heading">★ GRUPA {g} ★</h2>
          <RetroTable rows={groups[g]} />
        </section>
      ))}
    </ScreenFrame>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS; `out/grupy/index.html` z ośmioma nagłówkami `GRUPA`.

- [ ] **Step 3: Commit**

```bash
git add app/grupy
git commit -m "feat(app): widok grup A-H z kotwicami"
```

---

### Task 9: Mecze i typy (`MatchCard` + `app/mecze/page.tsx`)

**Files:**
- Create: `components/MatchCard.tsx`, `app/mecze/page.tsx`

- [ ] **Step 1: `components/MatchCard.tsx`**

Rozwijanie typów natywnym `<details>` — zero klientowego JS (decyzja z nagłówka planu; spec dopuszczał `'use client'`, `<details>` daje to samo).

```tsx
// Import wyłącznie typów (granica modułów).
import type { MatchOut, Score } from '../compute/types';
import { PlayerLink } from './RetroTable';

/** „2:1" albo „–:–" dla braku (spec, sekcja 4). */
export function fmtScore(s: Score | null): string {
  return s ? `${s.home}:${s.away}` : '–:–';
}

/** Mecz: wynik + rozwijana lista typów wszystkich uczestników z punktami. */
export function MatchCard({ match }: { match: MatchOut }) {
  const preds = Object.entries(match.predictions).sort(
    ([aId, a], [bId, b]) => (b.points ?? -1) - (a.points ?? -1) || aId.localeCompare(bId, 'pl'),
  );
  return (
    <details className="match-card">
      <summary>
        <span className="match-no">{match.no}.</span>
        <span className="match-teams">{match.home} – {match.away}</span>
        <span className="match-score">{fmtScore(match.result)}</span>
      </summary>
      <p className="kickoff">{match.kickoff}</p>
      <div className="screen-body">
        <table className="retro-table">
          <thead>
            <tr><th>GRACZ</th><th className="num">TYP</th><th className="num">PKT</th></tr>
          </thead>
          <tbody>
            {preds.map(([id, p]) => (
              <tr key={id}>
                <td><PlayerLink id={id} /></td>
                <td className="num">{p.pick ? fmtScore(p.pick) : '—'}</td>
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

- [ ] **Step 2: `app/mecze/page.tsx`**

```tsx
import { MatchCard } from '../../components/MatchCard';
import { ScreenFrame } from '../../components/ScreenFrame';
import { loadResults } from '../lib/results';

export default function MeczePage() {
  const { turns } = loadResults();
  return (
    <ScreenFrame title="MECZE">
      {turns.map((t) => (
        <section key={t.turn}>
          <h2 className="turn-heading">★ TURA {t.turn} ★</h2>
          {t.matches.map((m) => <MatchCard key={m.no} match={m} />)}
        </section>
      ))}
    </ScreenFrame>
  );
}
```

(Tury 2/3 nieopublikowane → `turns` ma tylko turę 1, UI niczego pustego nie pokaże — spec, sekcja 4.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS; `out/mecze/index.html` zawiera 24 elementy `<details`.

- [ ] **Step 4: Commit**

```bash
git add components/MatchCard.tsx app/mecze
git commit -m "feat(app): widok meczow z rozwijanymi typami (details, zero JS)"
```

---

### Task 10: Profil gracza (`app/gracz/[id]/page.tsx`)

**Files:**
- Create: `app/gracz/[id]/page.tsx`

- [ ] **Step 1: Implementacja**

56 statycznych profili przez `generateStaticParams` (spec, sekcja 2). ID = `participantId`; Next koduje polskie znaki procentowo, w page dekodujemy.

```tsx
import { notFound } from 'next/navigation';
import { fmtScore } from '../../../components/MatchCard';
import { ScreenFrame } from '../../../components/ScreenFrame';
import { loadResults } from '../../lib/results';

export function generateStaticParams() {
  return loadResults().general.map((r) => ({ id: r.participantId }));
}

export default async function GraczPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const data = loadResults();
  const row = data.general.find((r) => r.participantId === id);
  if (!row) notFound();
  const groupRow = data.groups[row.group].find((r) => r.participantId === id)!;

  return (
    <ScreenFrame title={id.toUpperCase()}>
      <div className="player-summary">
        <div><span className="label">PUNKTY</span><span className="stat">{row.points}</span></div>
        <div><span className="label">TABELA OGÓLNA</span><span className="stat">{row.position}. / 56</span></div>
        <div>
          <span className="label">GRUPA {row.group}</span>
          <span className="stat">{groupRow.position}. / {data.groups[row.group].length}</span>
        </div>
        <div><span className="label">SKUTECZNOŚĆ</span><span className="stat">{Math.round(row.hitRate * 100)}%</span></div>
      </div>
      {data.turns.map((t) => (
        <section key={t.turn}>
          <h2 className="turn-heading">★ TURA {t.turn} ★</h2>
          <table className="retro-table">
            <thead>
              <tr>
                <th className="num">#</th><th>MECZ</th>
                <th className="num">WYNIK</th><th className="num">TYP</th><th className="num">PKT</th>
              </tr>
            </thead>
            <tbody>
              {t.matches.map((m) => {
                const p = m.predictions[id];
                return (
                  <tr key={m.no}>
                    <td className="num">{m.no}</td>
                    <td>{m.home} – {m.away}</td>
                    <td className="num">{fmtScore(m.result)}</td>
                    <td className="num">{p.pick ? fmtScore(p.pick) : '—'}</td>
                    <td className="pkt">{p.points ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </ScreenFrame>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS; w `out/gracz/` 56 podkatalogów (nazwy z polskimi znakami zakodowane procentowo — OK, spec sekcja 2).

- [ ] **Step 3: Klik-test nawigacji (dev)**

Run: `npm run dev` (w tle), otwórz `http://localhost:3000` → menu → tabela → klik nazwisko z polskimi znakami (np. zawierające ó/ł) → profil się renderuje. Zatrzymaj dev server.

- [ ] **Step 4: Commit**

```bash
git add app/gracz
git commit -m "feat(app): profil gracza (56 statycznych stron)"
```

---

### Task 11: Smoke test e2e + bramka jakości

**Files:**
- Create: `scripts/smoke.ts`
- Modify: `package.json`

- [ ] **Step 1: `scripts/smoke.ts`**

```ts
// Smoke po `npm run build`: HTML tabeli zawiera lidera z results.json (spec, sekcja 5).
import { readFileSync } from 'node:fs';

const results = JSON.parse(readFileSync('public/data/results.json', 'utf8'));
const lider: string = results.general[0].participantId;
const html = readFileSync('out/tabela/index.html', 'utf8');

if (!html.includes(lider)) {
  console.error(`SMOKE FAIL: brak lidera "${lider}" w out/tabela/index.html`);
  process.exit(1);
}
const matches = (readFileSync('out/mecze/index.html', 'utf8').match(/<details/g) ?? []).length;
if (matches !== results.turns[0].matches.length) {
  console.error(`SMOKE FAIL: ${matches} meczy w HTML, oczekiwano ${results.turns[0].matches.length}`);
  process.exit(1);
}
console.log(`SMOKE OK: lider "${lider}" w tabeli, ${matches} meczy w widoku meczow`);
```

- [ ] **Step 2: Skrypt npm**

W `package.json` dodaj do `scripts`:

```json
"smoke": "tsx scripts/smoke.ts"
```

- [ ] **Step 3: Pełna bramka**

Run: `npm test && npm run typecheck && npm run build && npm run smoke`
Expected: wszystko PASS, na końcu `SMOKE OK: ...`.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke.ts package.json
git commit -m "test(app): smoke e2e na wygenerowanym HTML"
```

---

### Task 12: Aktualizacja CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Status**

W sekcji „Status" dodaj punkt o ukończonym renderze MVP (4 widoki, static export, smoke test, `npm run build`/`npm run smoke`) i zaktualizuj „Następne:" (zostaje: walidacja vs `r1`/`tab grup` po realnych wynikach, intro+dźwięk, PWA, Konkurs 2, faza pucharowa). W „Architektura" odnotuj istnienie `app/` + `components/` i granicę: tylko `import type` z `compute/types`.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: status po renderze MVP"
```

---

### Task 13: Deploy (akcja użytkownika — poza automatem)

- [ ] Vercel: jednorazowe podpięcie repo `MarcinSaj266/typowanie-mundial` w dashboardzie Vercel (preset Next.js wykryje `output: 'export'` automatycznie; auto-deploy z `master`). Workflow aktualizacji bez zmian: wynik → `npm run build:results` → commit+push → Vercel buduje.

---

## Self-review (wykonany)

- **Pokrycie specu:** sekcja 1 (turns) → Taski 1–3; sekcja 2 (struktura) → Taski 4–10; sekcja 3 (wizual) → Taski 4–5 (CSS, font, mobile-first); sekcja 4 (braki danych) → Task 2 (null-e) + Taski 9–10 („—", „–:–", puste PKT); sekcja 5 (testy) → Task 2 (TDD) + Task 11 (build gate + smoke); sekcja 6 (deploy) → Task 13.
- **Odstępstwo od specu (świadome):** `MatchCard` bez `'use client'` — natywny `<details>` realizuje rozwijanie bez JS; mniej kodu, identyczne UX.
- **Spójność typów:** `Fixture`/`PredictionOut`/`MatchOut`/`TurnOut` zdefiniowane w Task 1, używane w Taskach 2, 4 (`loadResults` → `ResultsJson`), 9, 10. `fmtScore` eksportowany z `MatchCard` (Task 9), importowany w Task 10. `PlayerLink` z `RetroTable` (Task 5), używany w Task 9.
