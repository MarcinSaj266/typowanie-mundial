# Ingest K1 — parser `grup-1` → kanoniczny JSON (Specyfikacja)

**Data:** 2026-06-12
**Autor / właściciel:** Marcin
**Status:** Zatwierdzona do spisania planu implementacji

---

## 1. Kontekst i cel

Silnik punktacji Konkursu 1 (faza grupowa) jest gotowy i przetestowany (`engine/`, 27 testów).
Brakuje warstwy, która **dostarczy mu kanoniczne dane** z realnego źródła. Tym źródłem są
**nie** osobne pliki uczestników ani pusty szablon `k1.xlsx`, lecz **master organizatora**
`konkurs 2026.06.11.xlsx`, arkusz **`grup-1`** — tam siedzą realne typy, roster i przydział do grup.

Cel tego etapu: zbudować `ingest/` czytający `grup-1` i produkujący **kanoniczny JSON**
(roster + grupy A–H + terminarz tury + typy K1). Bez wyników meczów i bez uruchamiania silnika —
to czysta, dobrze testowalna warstwa wejścia. Wyniki + sklejka z silnikiem to osobne, kolejne zadanie.

## 2. Źródło danych (`grup-1`) — ustalony układ

Arkusz `grup-1` (`xl/worksheets/sheet1.xml` w masterze), wymiar `B1:AK747`. Zawiera **turę 1**
(24 mecze). Tury 2/3 jeszcze niewypełnione — dojdą tym samym kodem, gdy organizator je wprowadzi
(prawdopodobnie kolejne arkusze).

**Bloki meczów (pozycyjnie):**
- **Nagłówek meczu** — wiersz, w którym `E` jest niepuste, a `F` **puste** (brak liczby typu).
  Z nagłówka: `home = E`, `away = K`, `kickoff = B` (np. „czwartek, 11 cze godz.21.00”).
  Wykrywanie po zawartości (nie po sztywnym skoku wierszy) — formaty daty w `B` bywają różne.
- **28 wierszy uczestników** po nagłówku (pomijając wiersz pod-etykiet `T..AA`/`AC..AJ`):
  - **Lewa kolumna — grupy A–D:** `nazwa = E`, `typ = F (gosp.) : G (gości)`.
  - **Prawa kolumna — grupy E–H:** `nazwa = K`, `typ = L (gosp.) : M (gości)`.
  - Po 7 osób na grupę (A–D po lewej, E–H po prawej). Etykiety `Grupa X` w `C` (lewa) i `P` (prawa)
    pojawiają się przy pierwszej osobie grupy — służą do **walidacji** przydziału, nie do parsowania pozycji.

Roster i przydział do grup są **identyczne w każdym meczu** (skład grup niezmienny w fazie grupowej) —
wyciągamy je raz, z pierwszego bloku, i traktujemy jako prawdę; kolejne bloki dają tylko typy.

**Czego w `grup-1` NIE ma:** faktycznych wyników meczów (zgodnie z decyzją „ręczny plik wyników”
— osobne wejście, kolejne zadanie). Arkusze `r1` (punkty mecz-po-meczu) i `tab grup` (tabele grupowe)
posłużą później jako **ground truth** testów end-to-end po wprowadzeniu wyników.

## 3. Architektura — dwie warstwy, ostra granica

Granice jak w silniku: **czytnik xlsx nie wie o konkursie**, **parser K1 nie wie o ZIP/XML**.

### 3.1. `ingest/xlsx/` — generyczny czytnik Excela (bez zależności)
- `zip.ts` — mini-rozpakowywacz ZIP oparty na wbudowanym `zlib.inflateRawSync`. Iteruje lokalne
  nagłówki `PK\x03\x04`, obsługuje metodę 8 (deflate) i 0 (store). Zwraca `Map<nazwa_wpisu, Buffer>`.
  Zero zewnętrznych zależności (zgodnie z CLAUDE.md).
- `cells.ts` — helpery `colToIndex`/`indexToCol`, `parseRef("E6") → {col:"E", row:6}`.
- `workbook.ts` — `openXlsx(buffer)`:
  - mapuje **nazwa arkusza → plik** (`xl/workbook.xml` + `xl/_rels/workbook.xml.rels`),
  - wczytuje `sharedStrings.xml` → tablica łańcuchów (scala `<t>` w obrębie `<si>`),
  - dla wskazanego arkusza zwraca **siatkę**: `cell(ref) → string | number | undefined`
    (rozwiązane `t="s"` przez sharedStrings, liczby z `<v>`, puste = `undefined`).

### 3.2. `ingest/k1/` — warstwa domenowa (zna układ `grup-1`)
- `parseGrup1.ts` — `parseGrup1(grid, turn) → { fixtures, participants, predictions }`:
  - skanuje wiersze, wykrywa nagłówki meczów, dla każdego czyta 28 wierszy uczestników,
  - mapuje pozycję na grupę (A–D lewa, E–H prawa; po 7),
  - z pierwszego bloku buduje `participants` (roster + grupa); z każdego bloku dokłada typy,
  - **walidacje twarde (rzut błędu)**: dokładnie 56 unikalnych uczestników, każda grupa A–H = 7 osób,
    24 mecze, `home`/`away` niepuste, etykiety `Grupa X` zgodne z pozycją, typy to liczby ≥ 0
    (lub brak — wtedy `null`/pominięcie).
- `buildK1.ts` — skrypt CLI: czyta master xlsx z dysku, woła `openXlsx` + `parseGrup1`,
  zapisuje pliki JSON do `data/k1/`.

## 4. Kanoniczny wynik (`data/k1/`)

- `roster.json` — niezależny od tury:
  ```json
  [{ "id": "Dario", "group": "A" }, { "id": "Talvik", "group": "E" }, … 56 ]
  ```
- `tura-1.json`:
  ```json
  {
    "turn": 1,
    "fixtures": [{ "no": 1, "home": "Meksyk", "away": "RPA", "kickoff": "czwartek, 11 cze godz.21.00" }, … ×24],
    "predictions": { "Dario": { "1": { "home": 1, "away": 0 }, "2": { … }, … }, … }
  }
  ```
- `id` uczestnika = nazwa z `grup-1` (parser wymusza unikalność; przy duplikacie — błąd).
- Brak typu na danym meczu → klucz pominięty w `predictions[id]`.
- Parser sparametryzowany nazwą arkusza + numerem tury; tura 2/3 użyją tego samego kodu.

## 5. Świadomie poza zakresem (kolejne zadania, YAGNI)

- Wyniki meczów (osobne wejście) + sklejka z silnikiem → `public/data/results.json`.
- Mapowanie nazw drużyn → kody 3-literowe (`MEX`, `RSA`…) z arkusza `r1`.
- Konkurs 2, faza pucharowa, render.

## 6. Testy (TDD, ground truth = realny plik)

Testy czytają prawdziwy `konkurs 2026.06.11.xlsx` (read-only) i sprawdzają:
- **Konkretne komórki / typy** (z analizy pliku): `Dario` mecz 1 = `1:0`, `Talvik` = `2:0`,
  `Wojtek` = `2:1`, `PiotreG` mecz 1 = `0:0`.
- **Niezmienniki strukturalne**: 56 uczestników, każda grupa A–H = 7 osób, 24 mecze,
  fixture 1 = `Meksyk` vs `RPA`, `Dario`∈A, `Talvik`∈E.
- **Czytnik xlsx osobno**: `openXlsx` na masterze zwraca arkusz `grup-1`, `cell("E6") === "Dario"`,
  `cell("F6") === 1`.
- **Walidacje**: sztuczna siatka z 6-osobową grupą / duplikatem nazwy → rzut błędu.

Kolejność TDD: najpierw czytnik xlsx (`zip` → `workbook`), potem `parseGrup1`, na końcu CLI.

## 7. Struktura plików (po wykonaniu)

```
ingest/
  xlsx/
    zip.ts            zip.test.ts
    cells.ts          cells.test.ts
    workbook.ts       workbook.test.ts
  k1/
    types.ts          (typy kanoniczne ingestu; Score reużyty z engine)
    parseGrup1.ts     parseGrup1.test.ts
  buildK1.ts          (CLI; bez testu jednostkowego — cienka sklejka I/O)
data/k1/
  roster.json
  tura-1.json
```

`tsconfig.json` rozszerzyć o `"ingest"` w `include`. Master xlsx pozostaje w katalogu głównym repo
i jest czytany przez testy ścieżką względną.
