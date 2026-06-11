# CLAUDE.md

Wskazówki dla Claude Code (i innych asystentów) przy pracy nad tym projektem.

## Czym jest projekt

Aplikacja webowa pokazująca **wyniki i statystyki konkursu typowania Mistrzostw Świata 2026**
(USA / Meksyk / Kanada). Ok. 56 uczestników, organizowane w pracy. Dwa konkursy:
- **Konkurs 1** — typowanie wyników poszczególnych meczów (cały turniej).
- **Konkurs 2** — jednorazowe typowanie rozstrzygnięć (miejsca w grupach, drabinka, mistrz).

Docelowo: zabawna, interaktywna apka w stylistyce 16-bitowej gry piłkarskiej (Kick Off 3 /
Dino Dini's Goal) z dźwiękiem i intro. **Najpierw jednak logika i dane, potem wizual.**

## Status

- ✅ Analiza reguł z Excela (logika punktacji rozszyfrowana).
- ✅ Specyfikacja Fazy 1: `docs/superpowers/specs/2026-06-11-typowanie-mundial-design.md`
  (CZYTAJ JĄ — to źródło prawdy o zakresie i decyzjach).
- ✅ Plan rdzenia silnika K1: `docs/superpowers/plans/2026-06-11-silnik-konkurs1.md`.
- ✅ Rdzeń silnika Konkursu 1 (faza grupowa) — zaimplementowany, TDD, 27 testów zielonych.
  Moduł `engine/`: `scoreMatchK1`, `aggregateTurn`, `rankBy`, `buildSeason`, `generalTable` + typy (`engine/index.ts`).
  Setup: TypeScript + Vitest (`npm test`, `npm run typecheck`).
- ✅ Spec + plan ingestu K1: `docs/superpowers/specs/2026-06-12-ingest-k1-design.md`,
  `docs/superpowers/plans/2026-06-12-ingest-k1.md`.
- ✅ Ingest K1 — zaimplementowany, TDD, 50 testów zielonych (silnik 27 + ingest 23). Moduł `ingest/`:
  generyczny czytnik xlsx bez zależności (`xlsx/zip` na `zlib` przez central directory, `xlsx/workbook`
  = `openXlsx → Sheet`, `xlsx/cells`) + parser domenowy (`k1/parseGrup1`). **Źródło typów to master
  `konkurs 2026.06.11.xlsx`, arkusz `grup-1`** (NIE pusty szablon `k1.xlsx` ani 56 osobnych plików).
  CLI `npm run build:k1` → `data/k1/roster.json` (56 osób, grupy A–H) + `data/k1/tura-1.json`
  (24 mecze + typy). Granice: `xlsx/` nie wie o konkursie, `k1/` nie wie o ZIP/XML.
- ⏳ Następne: wyniki meczów (ręczny plik) + sklejka z silnikiem → `public/data/results.json`,
  tabele grup A–H end-to-end (walidacja vs `r1`/`tab grup`), Konkurs 2, faza pucharowa ×2, render.

## Architektura (ustalona)

**Static-first:** silnik punktacji (TypeScript, czysty) + skrypt ingest (parser Excela + plik wyników)
→ generuje `public/data/results.json` → render Next.js (statyczny) na Vercel (PWA, link dla uczestników,
bez logowania). Wyniki meczów: ręczny plik teraz, hak na API piłkarskie później.

Planowana struktura: `engine/` (silnik, testowalny), `ingest/` (parser → JSON), `data/` (wejście),
`app/` (Next.js render).

## Reguły punktacji (skrót — pełne w specyfikacji)

**Konkurs 1, mecz (grupa):** trafiony rezultat 3 → + różnica bramek +1 (też remisy) → + dokładny wynik +1.
Wartość ∈ {0,3,4,5}. Suma w turze = `#3×3 + #4×4 + #5×5`.
**Faza grupowa:** 8 stałych grup konkursowych A–H po 7 osób; 3 tury (grup I/II/III).
**Tiebreakery (z formuł `SORTBY` — NIE z liczby „5"/„4", to było błędne odczytanie!):**
tabela grupowa `pkt → % → grIII → grI → grII` (arkusz `tab grup`); tabela ogólna
`pkt → % → puch → grIII → grII → grI` (arkusz `tabela`). „%" = (#3+#4+#5[+#6 w ogólnej])/rozegrane.
Tabela ogólna = `grI+grII+grIII+bns+puch`.
**Faza pucharowa:** punkty ×2 (6/8/10/12), jedna wspólna tabela.
**Konkurs 2:** miejsce w grupie 1, 1/16 → 2, 1/8 → 4, ćwierć → 6, półfinał → 8, finał → 10, mistrz → 12;
tiebreak = dorobek z późniejszej fazy.

## Dane źródłowe

- `k1.xlsx` — szablon typów konkursu 1 (3 tury × 24 mecze).
- `k2.xlsx` — szablon konkursu 2 (arkusze `konkurs2`, `zasady`).
- `konkurs 2026.06.11.xlsx` — master organizatora (arkusze: `grup-1`, `tab grup`, `stat`, `tabela`,
  `r1`, `rpuch`, `day by day`). **Tu siedzi cała logika w formułach** — to było źródło analizy.

Pliki Excel to archiwa ZIP; do podejrzenia formuł rozpakuj i parsuj XML (`xl/worksheets/*.xml`,
`xl/sharedStrings.xml`). Python NIE jest dostępny; jest Node.js.

## Pytania otwarte (potwierdzić)

1. **Bonus `bns`** — w Excelu jest zalążek (15/10/5 + meta 4/3/2/1), niepodłączony; spisane zasady go
   nie wymieniają. Silnik: moduł konfigurowalny, domyślnie wyłączony. Czeka na organizatora.
2. ✅ **ROZSTRZYGNIĘTE** — typy są w jednym masterze `konkurs 2026.06.11.xlsx`, arkusz `grup-1`
   (układ pozycyjny: nagłówek meczu B+E+K, 28 wierszy uczestników, lewa kolumna grupy A–D / prawa E–H,
   po 7). Parser `ingest/k1/parseGrup1` czyta to bezpośrednio. Tura 1 wypełniona; tury 2/3 dojdą tym
   samym kodem (parser waliduje spójność każdego bloku z rosterem).
3. **Kategoria „6" w fazie pucharowej** — co ją przyznaje. Przed startem pucharu.
4. **Tiebreakery grup turniejowych FIFA** (do konkursu 2) — potwierdzić zestaw reguł.
5. ✅ **ROZSTRZYGNIĘTE** — sezonowe „%" liczone sumarycznie (`suma_trafień / suma_rozegranych`,
   zgodne z `SUM(S:V)/N1` w arkuszu `tabela`); `buildSeason(...)` dodany do `engine/`. Przy okazji
   wykryto i poprawiono błąd: silnik miał tiebreakery `#5/#4`, a Excel sortuje po dorobku fazowym
   (patrz „Reguły punktacji" wyżej) — `rankBy(rows, keys)` przyjmuje teraz listę kluczy w kolejności.
6. **Do potwierdzenia z organizatorem** (drobne, wynikły z analizy formuł): (a) tabela grupowa sortuje
   `grIII → grI → grII`, a ogólna `grIII → grII → grI` — zamiana grI/grII w grupowej wygląda na literówkę
   w arkuszu; (b) „%" w tabeli ogólnej wlicza też „6" (puchar), w grupowej nie.

## Jak pracować

- **Silnik najpierw, TDD.** Ground truth = formuły z Excela; testy mają zgadzać się co do punktu.
- Trzymaj granice modułów: silnik nie wie o Excelu ani UI.
- Środowisko: Windows, PowerShell, Node.js (brak Pythona). Repo git na GitHubie (prywatne):
  `https://github.com/MarcinSaj266/typowanie-mundial`, gałąź `master` (śledzi `origin/master`).
- Język interfejsu i komentarzy: **polski**.
