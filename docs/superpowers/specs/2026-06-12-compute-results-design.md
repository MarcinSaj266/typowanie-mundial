# Compute — sklejka silnika z danymi + wyniki-atrapy → `results.json` (Specyfikacja)

**Data:** 2026-06-12
**Autor / właściciel:** Marcin
**Status:** Zatwierdzona do spisania planu implementacji

---

## 1. Kontekst i cel

Silnik (`engine/`, 27 testów) i ingest (`ingest/`, 23 testy) są gotowe; istnieją kanoniczne
`data/k1/roster.json` (56 osób, grupy A–H) i `data/k1/tura-1.json` (24 mecze + typy).
Brakuje warstwy, która **zastosuje silnik do danych** i wyprodukuje gotowy do renderu
`public/data/results.json`. Turniej jeszcze się nie zaczął, więc do testowania całego łańcucha
służą **deterministyczne wyniki-atrapy**.

Cel: moduł `compute/` — czysta funkcja licząca tabele + dwa cienkie CLI (generator atrap,
budowa `results.json`).

## 2. Architektura — nowy moduł `compute/`

Granice jak dotąd: `engine/` = czysta logika, `ingest/` = parsowanie źródeł,
**`compute/` = zastosowanie silnika do danych kanonicznych**. Czysta funkcja liczy, CLI robi I/O.

- `compute/types.ts` — typy wejścia/wyjścia (`ResultsByTurn`, `TableRow`, `ResultsJson`).
- `compute/buildResults.ts` — **czysta**: `buildResults(roster, turns, results) → ResultsJson`.
  Dla każdego uczestnika × tura składa `MatchEntry[]` (typ z `tura-N` + wynik z `results`),
  woła `aggregateTurn`; potem `buildSeason` → `generalTable` (tabela ogólna) oraz `rankBy`
  per grupa A–H (tabele grupowe). Zero zależności od plików.
- `compute/seedResults.ts` — CLI: deterministyczny generator atrap (PRNG ze stałym ziarnem,
  bramki 0–4) → `data/k1/results.json` dla 24 meczów tury 1.
- `compute/buildResultsCli.ts` — CLI (`npm run build:results`): czyta
  `data/k1/{roster,tura-1,results}.json` → `buildResults` → zapisuje `public/data/results.json`.

### Przepływ danych

```
roster.json ┐
tura-1.json ├─→ buildResults ──→ public/data/results.json
results.json┘     (engine)
   ▲
seedResults (atrapy, deterministyczne)
```

## 3. Format wejścia wyników (`data/k1/results.json`)

Prosty JSON `tura → mecz → wynik`, ręcznie edytowalny — **ten sam plik organizator wypełni
realnymi wynikami** (podmiana atrap):

```json
{ "1": { "1": { "home": 2, "away": 1 }, "2": { "home": 0, "away": 0 } } }
```

- Klucze zewnętrzne = numer tury (`"1"`–`"3"`), wewnętrzne = numer meczu (`"1"`–`"24"`).
- Brak klucza meczu = mecz nierozegrany (pomijany w agregacji — silnik dostaje `result: null`).
- Brak tury = pusta tura (`played = 0`); typy istnieją dziś tylko dla tury 1, więc grII/grIII = 0.

Typ TS: `type ResultsByTurn = Record<string, Record<string, Score>>`.

## 4. Kształt wyjścia (`public/data/results.json`)

```ts
interface TableRow {
  participantId: string;
  group: Group;            // 'A'–'H' (z rosteru)
  position: number;        // pozycja w TEJ tabeli (ogólnej lub grupowej)
  points: number;          // suma sezonu = grI+grII+grIII+bns+puch
  grI: number; grII: number; grIII: number; bns: number; puch: number;
  hitRate: number;         // sezonowe % (sumarycznie, jak SUM(S:V)/N1)
  count3: number; count4: number; count5: number; played: number; // do statystyk
}

interface ResultsJson {
  generatedAt: string;     // ISO timestamp
  general: TableRow[];     // 56 wierszy, ranking pkt → % → puch → grIII → grII → grI
  groups: Record<Group, TableRow[]>; // A–H po 7, ranking pkt → % → grIII → grI → grII
}
```

- Uczestnik występuje w `general` i w `groups[jego grupa]` — te same pola, różne `position`.
- `count3/4/5/played` zsumowane z trzech `TurnScore` (silnik nie nosi ich w `ParticipantSeason`).
- Porządki tiebreakerów dokładnie jak w silniku (`generalTable` / `rankBy` — zgodne z SORTBY Excela).
- `bns`/`puch` = 0 (moduły przyszłe; pola już w wyjściu, by UI nie zmieniał kształtu później).

## 5. Generator atrap (`seedResults`)

- Deterministyczny PRNG (mulberry32 lub LCG) ze stałym ziarnem w kodzie.
- Bramki: liczby całkowite 0–4 dla home/away, niezależnie.
- Generuje komplet 24 meczów **tury 1**; zapis do `data/k1/results.json`.
- Dwa uruchomienia → identyczny plik (stabilne testy, powtarzalny stan).
- Atrapy są commitowane; podmiana na realne wyniki = edycja tego samego pliku.

## 6. Testy (TDD)

- **`buildResults` czysto (syntetycznie):** mała obsada (np. 2 grupy po 2 osoby — walidacji 56/8×7
  tu nie ma, `buildResults` nie waliduje rozmiaru rosteru; to rola ingestu) ze znanymi wynikami
  `scoreMatchK1`: weryfikacja punktów, `hitRate`, pozycji w ogólnej i grupowej, że tabela grupowa
  zawiera tylko swoich, oraz że `points` tej samej osoby jest równe w obu tabelach.
- **Integracja na realnych danych:** `buildResults(roster, [tura-1], stały-plik-wyników)` →
  niezmienniki: `general` ma 56 wierszy, każda grupa po 7, pozycje 1..n bez dziur,
  lider ogólnej ma maksymalne punkty, suma `played` ≤ 24.
- **Determinizm `seedResults`:** funkcja generująca wywołana dwukrotnie zwraca identyczną strukturę.
- CLI bez testów jednostkowych (cienkie I/O) — weryfikacja przez uruchomienie.

## 7. Struktura plików (po wykonaniu)

```
compute/
  types.ts
  buildResults.ts      buildResults.test.ts
  seed.ts              seed.test.ts        (czysta funkcja generatora)
  seedResults.ts                            (CLI: seed → data/k1/results.json)
  buildResultsCli.ts                        (CLI: → public/data/results.json)
data/k1/results.json                        (atrapy; później realne wyniki)
public/data/results.json                    (wyjście dla UI)
```

`tsconfig.json` rozszerzyć o `"compute"`. Skrypty npm: `seed:results`, `build:results`.

## 8. Świadomie poza zakresem (YAGNI)

Konkurs 2, faza pucharowa / `puch`, bonus `bns` (zostają 0 w wyjściu), statystyki globalne,
komentarze, render Next.js. Tury 2/3: format wejścia już je przewiduje; typy dojdą z masterem.
