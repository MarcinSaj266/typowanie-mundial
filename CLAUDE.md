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
  = `openXlsx → Sheet`, `xlsx/cells`) + parser domenowy (`k1/parseGrup1`). **Źródło typów to
  NAJNOWSZY master organizatora (obecnie `konkurs 2026.06.12.xlsx`), arkusz `grup-1`** (NIE pusty
  szablon `k1.xlsx` ani 56 osobnych plików).
  CLI `npm run build:k1` → `data/k1/roster.json` (56 osób, grupy A–H) + `data/k1/tura-1.json`
  (24 mecze + typy). Granice: `xlsx/` nie wie o konkursie, `k1/` nie wie o ZIP/XML.
- ✅ Warstwa compute — `compute/buildResults` skleja silnik z danymi (`roster` + tury + ręczny
  `data/k1/results.json`) → `public/data/results.json` (tabela ogólna, grupy A–H, sekcja `turns`
  ze szczegółami per mecz). CLI `npm run build:results`. Wyniki tury 1 wpisywane ręcznie.
- ✅ Render MVP — spec: `docs/superpowers/specs/2026-06-12-render-mvp-design.md`, plan:
  `docs/superpowers/plans/2026-06-12-render-mvp.md`. Next.js App Router, static export
  (`output: 'export'`, `trailingSlash`), 4 widoki: menu (ekran tytułowy), `/tabela`, `/grupy`
  (kotwice #A–#H), `/mecze` (rozwijanie typów natywnym `<details>` — zero klientowego JS),
  `/gracz/[id]` (56 statycznych profili przez `generateStaticParams`). Retro 16-bit: Press Start 2P
  hostowany lokalnie (`public/fonts/`, `scripts/fetchFont.mjs`), czysty CSS w `app/globals.css`.
  Bramka jakości: `npm test && npm run typecheck && npm run build && npm run smoke`.
- ✅ Wdrożenie na Vercel — projekt `marcinsaj266s-projects/typowanie_mundial`, **produkcja:
  https://typowaniemundial.vercel.app**. Integracja Git podpięta (aplikacja GitHub „Vercel" ma
  dostęp do repo): push na `master` automatycznie przebudowuje produkcję.
- ✅ Walidacja end-to-end vs master z realnymi wynikami (`konkurs 2026.06.12.xlsx`, mecze 1–2):
  `npm run validate:excel` (`scripts/validateVsExcel.ts`) porównuje punkty per gracz/mecz z naszego
  silnika z cache formuł Excela (`grup-1`, kolumny H/N) — **112 par, 0 rozbieżności**. Master 06.12
  naprawił błąd Excela (brak formuł `H` dla 2 pierwszych wierszy bloku w meczach 2–24 — Dario i
  Wojtek nie dostawali punktów); nasz silnik liczył to dobrze od początku, bo liczy z typów, nie
  z formuł. Narzędzia diagnostyczne: `scripts/diffXlsx.ts`, `scripts/dumpRegion.ts`,
  `scripts/dumpFormulas.ts`.
- ✅ Bonus grupowy `bns` — reguła potwierdzona przez organizatora (2026-06-12), zaimplementowany
  TDD (`engine/groupBonus`, 78 testów zielonych). Przyznawany automatycznie po komplecie wyników
  3 tur (`groupStageComplete` w `compute/buildResults.ts`); do tego czasu `bns = 0`. Przy okazji
  poprawione: tabele grupowe rankują i pokazują pkt = `grI+grII+grIII` (bez bns/puch), jak
  `SUM` w arkuszu `tab grup` — bonus liczy się Z tabel grupowych, nie odwrotnie.
- ✅ Silnik pucharowy `scoreMatchPuchar` (`engine/scoreMatchPuchar.ts`) — TDD, 87 testów zielonych.
  Wynik po dogrywce jak z 90 min, bazowa punktacja `scoreMatchK1` ×2; przy remisie (karnych)
  obowiązkowy krzyżyk na zwycięzcę karnych: ±1 do bazy PRZED podwojeniem (brak krzyżyka = −1).
  Interpretacja ZWERYFIKOWANA z `rpuch`: `AI=AJ*6+AK*8+AL*10+AM*12`, `AJ:AM=COUNTIF(C:AH,6/8/10/12)`
  — wartości meczowe są parzyste {6,8,10,12}, więc ±1 działa przed ×2. Formuł liczących pojedynczy
  mecz pucharowy w masterze jeszcze NIE ma (C:AH puste) — porównać z nimi, gdy organizator je dopnie.
  Do zrobienia przy starcie pucharu: ingest typów pucharowych (krzyżyk!), agregacja do `puch`
  i wkład #6 w „%" tabeli ogólnej.
- ✅ Poprawione typy uczestników (2026-06-12 wieczorem) — organizator przysłał
  `konkurs 2026.06.12 - poprawiony.xlsx` (AKTUALNY master; 383 poprawione typy: wyłącznie
  mecze 8–24, wyłącznie gracze grup E–H — naprawione przesunięcie wierszy po prawej stronie
  `grup-1`; naprawia też zgłoszony błąd `r1!E33:E60`) oraz `Baza tura 1.xlsx` (płaska baza
  56×24 typów). Krzyżowa walidacja `scripts/diffTura1.ts`: 1344/1344 typów zgodnych
  (uwaga: 5 nicków w bazie ma inną pisownię niż master — mapa aliasów w skrypcie);
  `validate:excel` na poprawionym masterze: 112 par, 0 rozbieżności.
- ✅ Intro + dźwięk (v3 po feedbacku) — spec: `docs/superpowers/specs/2026-06-12-intro-muzyka-design.md`.
  Intro CSS na `/`: tytuł z bounce + pikselowa piłka (box-shadow) turla się na środek; PRESS
  START (`components/PressStart.tsx`) turla piłeczkę od nowa. Dźwięk: `components/RetroAudio.tsx`
  w layoucie (muzyka gra między widokami; domyślnie ON — przy blokadzie autoplay start na
  pierwszy gest; blipy WebAudio na klik w `a/button/summary` GRAJĄ ZAWSZE; przycisk ♪ steruje
  TYLKO muzyką). Stopka „Designed by MarcinS" w layoucie (na każdej stronie).
  `prefers-reduced-motion` wyłącza animacje. Smoke sprawdza markery w `out/`.
  UWAGA: wariant v2 (scenka piłkarzyka) WYCOFANY — kolizja klasy `.frame` sprite'ów z ramką
  `ScreenFrame` rozsypała wszystkie widoki + użytkownik wolał turlającą piłkę. Lekcja:
  nowe klasy CSS prefiksować, kolizje sprawdzać grepem przed dodaniem.
- ✅ Auto-pobieranie wyników (2026-06-13) — moduł `ingest/scores/` + robot GitHub Actions.
  Źródło: **football-data.org** (darmowy plan, competition `WC`; spike potwierdził pełne
  pokrycie MŚ 2026 i zgodność 4 rozegranych meczów z naszym `results.json`). Granice jak reszta:
  `teamMap.ts` (48 drużyn PL→API, brak = twardy błąd), `matchScores.ts` (CZYSTA `mergeScores`,
  TDD 7 testów — dopasowanie po nieuporządkowanej parze, wynik w orientacji NASZEGO fixture'a,
  tylko `FINISHED`, NIE nadpisuje istniejących = ręczna nadpiska wygrywa), `footballData.ts`
  (klient, token z env `FOOTBALL_DATA_TOKEN`), `fetchScoresCli.ts` (`npm run fetch:scores` —
  czyta `tura-*.json` + `results.json`, dokleja tylko brakujące). Robot
  `.github/workflows/auto-scores.yml`: cron `*/30 * * * *` + `workflow_dispatch` →
  fetch:scores → (gdy zmiana) build:results → commit (autor noreply!) → push master → Vercel.
  Sekret `FOOTBALL_DATA_TOKEN` w GitHub Actions. **Świadomie BEZ `[skip ci]`** (Vercel pomija
  deploy przy `[skip ci]`, a my chcemy go wywołać). Zweryfikowane e2e przez `workflow_dispatch`
  (bieg `success`, idempotentny). Poza zakresem: mecze pucharowe (powtórki par — po dacie).
- ✅ Silnik Konkursu 2 (2026-06-13) — TDD, 16 testów K2 (110 w całym zestawie). Spec:
  `docs/superpowers/specs/2026-06-13-silnik-konkurs2-design.md`, plan:
  `docs/superpowers/plans/2026-06-13-silnik-konkurs2.md`. Reguły ZWERYFIKOWANE z formuł
  `k2.xlsx` (`zasady`/`konkurs2`/`wyniki`): grupa 1 pkt za drużynę na trafionym miejscu (max 48);
  fazy pucharowe KUMULOWANE (`H72=H19+H37+H49+H59+H65+H69`) — obecność drużyny w fazie ×
  waga 1/16→2, 1/8→4, ćwierć→6, półfinał→8, finał→10 (obaj finaliści), mistrz→12; tiebreak
  tabeli końcowej = punkty z PÓŹNIEJSZEJ fazy. Wariant A: silnik punktuje GOTOWE, rozwiązane
  zbiory — `scoreK2(participantId, typ, fakt)` (`engine/scoreK2.ts`: dopasowanie pozycji w
  grupach + przecięcie zbiorów per faza × waga) i `k2Table` (`engine/k2Table.ts`: reuse `rankBy`
  z kluczami total→champion→final→sf→qf→r16→r32→group). Typy K2 w `engine/types.ts`
  (`K2Entry`, `PhaseRosters`, `GroupStandings`, `K2Score`; `TeamId` = pełna nazwa PL jak w arkuszu).
  Granica jak reszta: silnik nie zna drabinki/Excela/UI.
  Do zrobienia po danych K2: ingest typów z arkusza `konkurs2` (parser + rozwiązanie drabinki:
  typy „1/2", rozstawienie, wariant 3. miejsc, karne finału → `champion`), ręczne faktyczne dane
  (`data/k2/results.json`), wpięcie w `compute/` + render.
- ⏳ Następne: PWA (odłożone — patrz rozmowy), ingest + render Konkursu 2 (czekamy na typy K2
  od organizatora), ingest typów pucharowych K1 (przy starcie 1/16).

## Architektura (ustalona)

**Static-first:** silnik punktacji (TypeScript, czysty) + skrypt ingest (parser Excela + plik wyników)
→ generuje `public/data/results.json` → render Next.js (statyczny) na Vercel (PWA, link dla uczestników,
bez logowania). Wyniki meczów: ręczny plik teraz, hak na API piłkarskie później.

Struktura: `engine/` (silnik, testowalny), `ingest/` (parser → JSON), `compute/` (sklejka →
`public/data/results.json`), `data/` (wejście), `app/` + `components/` (Next.js render — czyta
WYŁĄCZNIE `public/data/results.json`; jedyna zależność od `compute/` to `import type`).
Workflow aktualizacji: wynik meczu do `data/k1/results.json` → `npm run build:results` →
commit+push → Vercel przebudowuje. Ustalenia z organizatorem (2026-06-12): wyniki meczów
będzie wysyłał na bieżąco (alternatywnie sprawdzamy sami w oficjalnych źródłach); typy
uczestników są zbierane PRZED KAŻDĄ turą i przyjdą kolejnym masterem (wtedy dopiąć parser
do arkusza tury 2/3 — ten sam układ co `grup-1`); typy K2 też dośle.

## Reguły punktacji (skrót — pełne w specyfikacji)

**Konkurs 1, mecz (grupa):** trafiony rezultat 3 → + różnica bramek +1 (też remisy) → + dokładny wynik +1.
Wartość ∈ {0,3,4,5}. Suma w turze = `#3×3 + #4×4 + #5×5`.
**Faza grupowa:** 8 stałych grup konkursowych A–H po 7 osób; 3 tury (grup I/II/III).
**Tiebreakery (reguła organizatora, POPRAWIONA 2026-06-13):** tabela grupowa
`pkt → % → grIII → grII → grI`; tabela ogólna `pkt → % → puch → grIII → grII → grI`.
Zasada organizatora: „im późniejsze punkty, tym większe znaczenie przy tej samej liczbie pkt
i tej samej %" → PÓŹNIEJSZA tura bije wcześniejszą (tura3 > tura2 > tura1). Obowiązuje od tury 2
(czwartek 2026-06-18). UWAGA HISTORYCZNA: 2026-06-12 organizator powiedział nam I→II→III i
zgłosiliśmy mu jego `SORTBY` (III→II→I) jako błąd — 2026-06-13 WYCOFAŁ to: właściwa jest III→II→I,
czyli wraca do pierwotnego SORTBY. Zaimplementowane w `engine/generalTable.ts` i `GROUP_ORDER`
w `compute/buildResults.ts` (TDD). „%" = (#3+#4+#5[+#6 w ogólnej])/rozegrane.
Tabela ogólna = `grI+grII+grIII+bns+puch`; tabela grupowa pokazuje pkt = `grI+grII+grIII`.
**Bonus `bns` (potwierdzony 2026-06-12):** przyznawany NA ZAKOŃCZENIE fazy grupowej z końcowych
tabel grupowych: miejsca 1–3 w każdej grupie → 15/10/5; w grupie o najlepszej łącznej sumie
punktów 7 graczy miejsca 4–7 → 4/3/2/1 (przy remisie najlepszej sumy — wszystkie zremisowane
grupy, jak `IF(suma=$D$44,...)` w `tab grup`, kol. M/Z). Implementacja: `engine/bonus.ts`.
**Faza pucharowa (doprecyzowana 2026-06-12):** punkty ×2 (6/8/10/12), jedna wspólna tabela.
Dogrywka: wynik po dogrywce liczy się jak wynik z 90 min. Karne: kto typuje remis, obowiązkowo
wskazuje zwycięzcę karnych („krzyżyk"); trafiony zwycięzca +1, nietrafiony −1 do wartości
bazowej: dokładny remis 5±1, remis bez dokładnego wyniku 4±1. Kategorie bazowe {3,4,5,6} są
podwajane → {6,8,10,12} (interpretacja: ±1 PRZED podwojeniem — bo organizator podaje komplet
wartości jako parzyste; ZWERYFIKOWAĆ z formułami `rpuch` przed startem pucharu).
Kategoria „6" (= remis dokładny + trafione karne) nie daje osobnych punktów — służy do „%":
w tabeli ogólnej „%" wlicza #6, w grupowej nie.
**Konkurs 2:** miejsce w grupie 1, 1/16 → 2, 1/8 → 4, ćwierć → 6, półfinał → 8, finał → 10, mistrz → 12;
tiebreak = dorobek z późniejszej fazy.

## Dane źródłowe

- `k1.xlsx` — szablon typów konkursu 1 (3 tury × 24 mecze).
- `k2.xlsx` — szablon konkursu 2 (arkusze `konkurs2`, `zasady`).
- `konkurs 2026.06.12 - poprawiony.xlsx` — AKTUALNY master organizatora (arkusze: `grup-1`,
  `tab grup`, `stat`, `tabela`, `r1`, `rpuch`, `day by day`). **Tu siedzi cała logika
  w formułach** + realne wyniki meczów 1–2. Naprawia 383 błędne typy graczy grup E–H
  (mecze 8–24) i błąd `r1!E33:E60` z wersji 06.12.
- `Baza tura 1.xlsx` — płaska baza typów tury 1 od organizatora (1344 wiersze:
  uczestnik × mecz × typ); użyta do krzyżowej walidacji (`scripts/diffTura1.ts`).
- `konkurs 2026.06.12.xlsx` — poprzedni master (typy graczy E–H w meczach 8–24 przesunięte
  o wiersz; naprawiał błąd z 06.11 — brakujące formuły `H` w `grup-1`).
- `konkurs 2026.06.11.xlsx` — poprzedni master (zachowany do porównań; był źródłem analizy formuł).

Pliki Excel to archiwa ZIP; do podejrzenia formuł rozpakuj i parsuj XML (`xl/worksheets/*.xml`,
`xl/sharedStrings.xml`). Python NIE jest dostępny; jest Node.js.

## Pytania otwarte (potwierdzić)

1. ✅ **ROZSTRZYGNIĘTE** (2026-06-12) — organizator potwierdził regułę bonusu `bns` (opis
   w „Reguły punktacji"). Zaimplementowany: `engine/bonus.ts` (`groupBonus`), podpięty w
   `compute/buildResults.ts` — aktywuje się dopiero po komplecie wyników wszystkich 3 tur.
   Zgodny z zalążkiem w `tab grup` (kol. M/Z: 15/10/5 + `IF(suma=$D$44, 4/3/2/1)`).
2. ✅ **ROZSTRZYGNIĘTE** — typy są w jednym masterze `konkurs 2026.06.11.xlsx`, arkusz `grup-1`
   (układ pozycyjny: nagłówek meczu B+E+K, 28 wierszy uczestników, lewa kolumna grupy A–D / prawa E–H,
   po 7). Parser `ingest/k1/parseGrup1` czyta to bezpośrednio. Tura 1 wypełniona; tury 2/3 dojdą tym
   samym kodem (parser waliduje spójność każdego bloku z rosterem).
3. ✅ **ROZSTRZYGNIĘTE** (2026-06-12) — kategoria „6" = dokładny remis + trafiony zwycięzca
   karnych (5+1); pełne reguły dogrywek/karnych w „Reguły punktacji". „%" w tabeli ogólnej
   wlicza „6", w grupowej nie. Silnik pucharowy (`scoreMatchPuchar`) zaimplementowany,
   interpretacja „±1 przed podwojeniem" zweryfikowana z agregacją `rpuch` (patrz Status);
   przed startem 1/16 zostaje ingest typów pucharowych + wpięcie `puch` i #6 do tabel.
4. ✅ **ROZSTRZYGNIĘTE pragmatycznie** (2026-06-12) — tiebreakerów FIFA NIE implementujemy:
   realne końcowe układy grup turnieju weźmiemy z oficjalnych tabel FIFA jako ręczne dane
   wejściowe (jak wyniki meczów). Arkusz `zasady` w `k2.xlsx` sprawdzony — opisuje tylko
   punktację K2 (1/2/4/6/8/10/12 + tiebreak „dorobek z późniejszej fazy"), zgodną z tym,
   co już mamy w specyfikacji.
5. ✅ **ROZSTRZYGNIĘTE** — sezonowe „%" liczone sumarycznie (`suma_trafień / suma_rozegranych`,
   zgodne z `SUM(S:V)/N1` w arkuszu `tabela`); `buildSeason(...)` dodany do `engine/`. Przy okazji
   wykryto i poprawiono błąd: silnik miał tiebreakery `#5/#4`, a Excel sortuje po dorobku fazowym
   (patrz „Reguły punktacji" wyżej) — `rankBy(rows, keys)` przyjmuje teraz listę kluczy w kolejności.
6. ✅ **ROZSTRZYGNIĘTE (a) — ODWRÓCONE 2026-06-13:** właściwa kolejność tiebreakerów to
   **grIII → grII → grI** (obie tabele) — późniejsza tura bije wcześniejszą („im późniejsze punkty,
   tym większe znaczenie"). To odwraca decyzję z 2026-06-12 (była grI→grII→grIII) i zgadza się z
   pierwotnym `SORTBY` III→II→I w jego arkuszu, więc arkusz NIE wymaga już poprawy w tym zakresie.
   Silnik zaktualizowany (`engine/generalTable.ts`, `GROUP_ORDER` w `compute/buildResults.ts`, TDD).
   Obowiązuje od tury 2 (2026-06-18).
   ✅ (b) potwierdzone (2026-06-12): „%" w tabeli ogólnej wlicza też „6" (puchar), w grupowej nie.
7. ✅ **ROZSTRZYGNIĘTE** (2026-06-12 wieczorem) — organizator naprawił w masterze
   „poprawiony" (E33:E60 → `'grup-1'!N68:N95`). Historyczny opis błędu:
   błąd w masterze 06.12, arkusz `r1`, kolumna E (mecz 3,
   Kanada–Bośnia):** wiersze `E33:E60` (uczestnicy grup E–H) odwołują się do `'grup-1'!H96:H123`
   (pusty wiersz przerwy + nagłówek + punkty MECZU 4 lewej strony) zamiast do `'grup-1'!N68:N95`
   (prawa kolumna meczu 3, tak jak w masterze 06.11). Dziś niewidoczne (mecz 3 nierozegrany, więc
   strażnik `IF($G$66="",...)` zwraca puste), ale po wpisaniu wyniku meczu 3 Excel pokaże tym 28
   osobom złe punkty. Nasza apka liczy z typów, więc NIE jest dotknięta; `npm run validate:excel`
   wykryje rozbieżność automatycznie po rozegraniu meczu 3.

## Jak pracować

- **Silnik najpierw, TDD.** Ground truth = formuły z Excela; testy mają zgadzać się co do punktu.
- Trzymaj granice modułów: silnik nie wie o Excelu ani UI.
- Środowisko: Windows, PowerShell, Node.js (brak Pythona). Repo git na GitHubie (prywatne):
  `https://github.com/MarcinSaj266/typowanie-mundial`, gałąź `master` (śledzi `origin/master`).
- Język interfejsu i komentarzy: **polski**.
