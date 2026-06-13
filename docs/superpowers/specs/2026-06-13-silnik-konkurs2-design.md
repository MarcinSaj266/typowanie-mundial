# Silnik Konkursu 2 — projekt

Data: 2026-06-13. Status: zatwierdzony do implementacji.

## 1. Cel i zakres

Zbudować **czysty silnik punktacji Konkursu 2** (TDD), na zapas — przed napływem typów K2
od organizatora, analogicznie do silnika pucharowego `scoreMatchPuchar` zbudowanego przed
startem fazy pucharowej.

**W zakresie teraz:** funkcja punktująca pojedynczego uczestnika + tabela końcowa K2 z
tiebreakiem. Czyste funkcje w `engine/`, pełne testy, eksport w `engine/index.ts`.

**Poza zakresem teraz (czeka na realne dane K2):** ingest typów z arkusza `konkurs2`
(parser + rozwiązanie drabinki), wpięcie w `compute/`, render w `app/`.

## 2. Ground truth — reguły z `k2.xlsx`

Zweryfikowane bezpośrednio w formułach arkuszy `zasady`, `konkurs2`, `wyniki`:

- **Faza grupowa.** Uczestnik ustala kolejność miejsc 1–4 w każdej z 12 grup turniejowych
  (A–L). 1 pkt za każdą drużynę na trafionym miejscu (max 48). W arkuszu: `D14 =
  IF(wyniki!C7 = konkurs2!C14, 1, 0)`, suma w `H19`.
- **Fazy pucharowe — punkty KUMULUJĄ się per faza.** Suma ogólna
  `H72 = H19 + H37 + H49 + H59 + H65 + H69` = grupa + 1/16 + 1/8 + ćwierć + półfinał + finał.
  Drużyna trafiona aż do tytułu daje 2+4+6+8+10+12.
- **Wagi faz** (liczy się sama OBECNOŚĆ drużyny w fazie, nie pozycja w drabince — `zasady` B5):

  | Faza | Klucz | Waga | Liczność |
  |---|---|---|---|
  | 1/16 finału | `r32` | 2 | 32 |
  | 1/8 finału | `r16` | 4 | 16 |
  | ćwierćfinał | `qf` | 6 | 8 |
  | półfinał | `sf` | 8 | 4 |
  | finał | `final` | 10 | 2 (obaj finaliści) |
  | mistrz | `champion` | 12 | 1 |

  W arkuszu `H69` (faza finałowa) = 10 za każdego z dwóch finalistów + 12 za mistrza; u nas
  rozbite na osobne pola `final` i `champion`.
- **Punktacja pucharowa = przecięcie zbiorów.** Cała „hydraulika" drabinki w arkuszu (VLOOKUP
  rozstawienia, wariant 4 odpadających z 3. miejsc „ABCK", propagacja zwycięzców „wstaw 1/2"
  w górę drabinki) służy wyłącznie wyliczeniu, jakie drużyny znajdą się w każdej fazie. Sama
  punktacja to `LOOKUP(typowana_drużyna, wyniki!AX:..)` — czyli: jeśli realna drużyna doszła
  do danej fazy, przyznaj wagę. To zwykłe przecięcie zbioru drużyn typowanych w fazie ze
  zbiorem drużyn faktycznie w niej obecnych.
- **Tiebreak tabeli końcowej** (`zasady` B13–B14): przy równej liczbie punktów wyżej jest ten,
  kto zdobył więcej punktów w **późniejszej** fazie.
- **Faktyczne dane** (`wyniki`: końcowe tabele grup + jak daleko zaszła każda drużyna) — u nas
  **wejście ręczne**, jak wyniki meczów w K1 (`data/.../results.json`). Tabel grup wg reguł
  FIFA NIE liczymy (decyzja z CLAUDE.md, pkt 4).

## 3. Decyzja architektoniczna: granica silnika (wariant A)

Silnik punktuje **gotowe, już-rozwiązane zbiory**. Dostaje kanoniczny model: kolejność grup
+ zbiory drużyn per faza — i dla typu uczestnika, i dla faktów. Robi tylko dopasowanie pozycji
w grupach + przecięcie zbiorów × waga.

Odrzucone: (B) silnik rozwiązuje też drabinkę z surowych typów „1/2" — puchnie, wiąże punktację
z topologią MŚ 2026, wymaga zgadywania formatu przed danymi; (C) model „najdalsza faza per
drużyna" — gorzej oddaje niezależne sumy per faza z arkusza.

Hydraulika drabinki (zamiana typów „1/2" + rozstawienia + wariantu 3. miejsc na zbiory faz)
należy do **ingestu** i jest odroczona do czasu realnych plików K2. Granica jak w reszcie
projektu: silnik nie wie o Excelu, drabince ani UI.

## 4. Model danych (`engine/types.ts`)

```ts
type TeamId = string;   // KONWENCJA: pełna nazwa PL jak w arkuszu (np. "Bośnia i Hercegowina",
                        // "Korea Płd."). Dla silnika nieprzezroczysty string; spójność pilnuje ingest.

// Końcowe miejsca w grupie: 4 drużyny w kolejności miejsc 1→4. Klucz grupy: "A".."L".
type GroupStandings = Record<string, [TeamId, TeamId, TeamId, TeamId]>;

// Obsada faz pucharowych (zbiory drużyn obecnych w danej fazie).
interface PhaseRosters {
  r32: TeamId[];      // 1/16 — 32 drużyny
  r16: TeamId[];      // 1/8  — 16
  qf:  TeamId[];      // ćwierć — 8
  sf:  TeamId[];      // półfinał — 4
  final: TeamId[];    // finał — 2
  champion: TeamId;   // mistrz — 1
}

// Ten sam kształt dla typu uczestnika i dla faktycznego wyniku.
interface K2Entry {
  groups: GroupStandings;
  phases: PhaseRosters;
}
```

Zbiory faz jako tablice (JSON-friendly, deterministyczne); silnik traktuje je jak zbiory
(defensywnie deduplikuje przy przecięciu).

## 5. Punktacja (`engine/scoreK2.ts`, czysta)

```ts
interface K2Score {
  participantId: string;
  group: number;     // Σ trafionych pozycji w grupach × 1  (max 48)
  r32: number;       // |typ.r32 ∩ fakt.r32| × 2
  r16: number;       // × 4
  qf:  number;       // × 6
  sf:  number;       // × 8
  final: number;     // |typ.final ∩ fakt.final| × 10
  champion: number;  // typ.champion === fakt.champion ? 12 : 0
  total: number;     // suma wszystkich powyżej
}

function scoreK2(participantId: string, typ: K2Entry, fakt: K2Entry): K2Score;
```

- **Grupy:** dla każdej grupy obecnej w faktach porównaj pozycja-po-pozycji (indeks 0..3);
  +1 za każdą zgodną. Grupy/pozycje nieobecne w typie lub faktach nie dają punktów.
- **Fazy:** dla `r32/r16/qf/sf/final` przecięcie zbioru typu z faktem × waga. `champion`:
  zgodność pojedynczej drużyny × 12.
- **Odporność:** brakujące pola (niekompletny typ) liczone jako brak trafień, nie błąd.

## 6. Tabela końcowa (`engine/k2Table.ts`)

Wykorzystuje istniejące `rankBy(rows, keys)`. Tiebreak organizatora (późniejsza faza ważniejsza):

```ts
rankBy(scores, ['total', 'champion', 'final', 'sf', 'qf', 'r16', 'r32', 'group'])
```

Zwraca wiersze z `position` (jak w K1). Stabilne, bez mutacji wejścia.

## 7. Testy (TDD, Vitest)

`scoreK2`:
- pełne trafienie grup → 48; częściowe; zero.
- przecięcia faz z poprawnymi wagami (r32×2 … final×10).
- mistrz trafiony (12) i nietrafiony (0).
- kumulacja: drużyna typowana od 1/16 do tytułu → 2+4+6+8+10+12.
- niekompletny/pusty typ → brak trafień, bez wyjątku.
- `total` = suma składników.

`k2Table`:
- sort malejąco po `total`.
- tiebreak: równe `total`, ale jeden ma punkty w późniejszej fazie → wyżej (sprawdzić
  rozstrzyganie kolejno champion → final → … → group).
- brak mutacji wejścia; nadanie `position` 1..n.

Eksport `scoreK2`, `k2Table`, typy (`K2Entry`, `PhaseRosters`, `GroupStandings`, `K2Score`)
w `engine/index.ts`. Bramka: `npm test && npm run typecheck`.

## 8. Poza zakresem (następne kroki, po danych K2)

1. Ingest typów K2 z arkusza `konkurs2` organizatora: parser + rozwiązanie drabinki
   (typy „1/2", rozstawienie, wariant 3. miejsc, karne w finale → `champion`) → `K2Entry`.
2. Ręczne faktyczne dane K2 (`data/k2/results.json`: końcowe tabele grup + obsada faz).
3. Wpięcie w `compute/` → `public/data/results.json` (sekcja K2) i render widoku K2.
