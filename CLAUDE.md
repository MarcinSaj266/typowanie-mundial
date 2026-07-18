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
  ✅ ZROBIONE (2026-06-29): ingest typów pucharowych (krzyżyk!), agregacja do `puch` i wkład #6
  w „%" tabeli ogólnej — patrz wpis „Faza pucharowa K1 — WDROŻONA" niżej.
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
  ZNANE OGRANICZENIE (2026-06-13): GitHub `schedule` nie ma gwarancji — opóźnia/pomija crony,
  więc realnie biegi idą co ~80–95 min, nie co 30. Skutek: wynik meczu potrafi wskoczyć z lagiem
  ~1–1,5h po zakończeniu (zaobserwowane na meczu 5 Katar 1:1 Szwajcaria — doklejony dopiero po
  ręcznym `workflow_dispatch`). Fallback: ręczny „Run workflow". POMYSŁ NA PRZYSZŁOŚĆ (świadomie
  NIE robione mid-turniej, 2026-06-13): zamiast pollować całą dobę, ograniczyć biegi do OKIEN wokół
  zakończeń meczów, ale W OKNIE pollować kilka razy (np. co 15 min przez ~1h) — łączy oszczędność
  z odpornością na pominięte crony i ogarnia dogrywki + opóźnienie API (darmowy plan oznacza
  `FINISHED` z poślizgiem). WARUNEK WSTĘPNY: godziny meczów w formie maszynowej (dziś `kickoff`
  to wolny tekst PL, np. `"czwartek, 11 cze godz.21.00"`, w dodatku niespójny `godz.21.00`/`godz. 21.00`)
  — najpierw ustrukturyzować datę+czas+strefę, dopiero potem liczyć z nich okna cron (UTC).
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
- ✅ Faza pucharowa K1 — WDROŻONA na produkcję (2026-06-29, Etap A + profil/tabela/karta). Spec:
  `docs/superpowers/specs/2026-06-28-faza-pucharowa-design.md`, plan:
  `docs/superpowers/plans/2026-06-28-faza-pucharowa.md`. Pipeline: parser tolerancyjny
  `ingest/k1/parseBazaPuchar` (płaska „Baza puch vN.xlsx", arkusz `t2`; krzyżyk x/X = zwycięzca
  karnych; NIE wymaga kompletu rosteru) → CLI `npm run build:puchar` → `data/k1/puchar.json`
  (runda 1/16, 16 meczów, typy 52/56) → agregacja `engine/aggregatePuchar` (`scorePucharMatch`
  reuse `scoreMatchPuchar`; kategorie 6/8/10/12) → wpięcie w `compute/buildResults`. Tabela
  OGÓLNA: suma `grI+grII+grIII+bns+puch`, „%" wlicza puchar, liczniki ×3/×4/×5 wliczają trafienia
  pucharowe (6→baza3, 8→4, 10→5) + kolumny ×6 (baza6=remis dokładny+karne) i PUCH — ZGODNE z
  tabelą organizatora po 1/16. Tabele GRUPOWE celowo nietknięte (sama faza grupowa). `skutBonus`:
  etap pucharowy dodany jako najniższy tiebreaker (`engine/generalTable.ts`). Widok `/puchar`
  (rundy→mecze→typy, natywne `<details>`), sekcja „PUCHAR 1/16" w profilu `/gracz/[id]`, blok
  „FAZA PUCHAROWA" na karcie (`engine/playerCard.ts`: punkty ×2, celność pucharowa, dokładne
  10+12 — OSOBNY blok, statystyki grupowe zostają czyste; decyzja organizatora/użytkownika
  2026-06-29 — bez mieszania skali ×1/×2). Wynik 1/16 wpisany ręcznie: Kanada 1:0 RPA (klucz
  `"puch"` w `data/k1/results.json`). Bramka: 185 testów, typecheck, build, smoke.
  ✅ ETAP B WDROŻONY (2026-07-05): robot football-data.org pobiera też PUCHAR. Czysta
  `mergePucharScores` (`ingest/scores/matchPucharScores.ts`, TDD 13 testów): dopasowanie po
  **stage z API + parze drużyn** (NIE po dacie — w drabince para jest unikalna w obrębie rundy,
  a powtórkę pary z fazy grupowej odcina stage; mapa `ROUND_TO_STAGE`: 1/16→`LAST_32`,
  1/8→`LAST_16`, … `finał`→`FINAL`, nieznana runda = twardy błąd). Ekstrakcja (spike
  `scripts/spikePuchar.ts` na żywym API): `duration REGULAR|EXTRA_TIME` → `fullTime` wprost
  (dogrywka = wynik jak z 90'); `PENALTY_SHOOTOUT` → wynik 120' = `regularTime+extraTime`
  (**`fullTime` przy karnych ZAWIERA bramki konkursu karnych!**) + `pk` z `score.winner`,
  wynik I `pk` tłumaczone na orientację naszego fixture'a. Niespójność (remis bez karnych itp.)
  → pomiń + warning (doklei następny bieg / ręcznie), permanentną lukę łapie `check:stale`
  (rozszerzony o puchar: `findStalePucharMatches`). Ręczna nadpiska nadal wygrywa. `teamMap`:
  aliasy pisowni z bazy puch („Wybrzeże Kość. Słon.", „Republika Ziel. Przylądka"). GOLDEN
  zweryfikowany: robot odtworzył z API 18/18 ręcznych wpisów `puch` 1:1 (w tym karne meczów
  3/4/14) — `scripts/goldenPuchar.ts` + workflow `spike-puchar.yml` (workflow_dispatch,
  zostaje jako narzędzie diagnostyczne). Workflow `auto-scores.yml` bez zmian (git add już
  obejmował `puch`); bieg e2e zielony, idempotentny. Kolejne rundy: nadal reingest bazy typów
  od organizatora (`build:puchar`) — fixtures muszą być w `puchar.json`, wyniki zejdą już same.
  ✅ Runda 1/8 WDROŻONA (2026-07-04): baza od v3 („Baza puch v3 (2026.07.04).xlsx") jest
  WIELORUNDOWA — arkusz `t2` ma mecze 1–32 (1–16 = 1/16, 17–24 = 1/8, 25–32 = przyszłe rundy,
  puste pary → parser pomija). `parseBazaPuchar` ma opcję `matches: {from,to}` (zakres numerów
  meczów rundy, TDD), `buildPuchar` parsuje rundy osobno (stała `ROUNDS`) + terminarz 1/8 w PL
  (ET+6h). Numery meczów GLOBALNE: wyniki 1/8 → klucz `"puch"`, numery 17–24. `MANUAL_PICKS`
  w `buildPuchar` = typy dosłane poza bazą (Sokółka mecz 17 Kanada-Maroko 1:2); zgodny typ
  w nowszej bazie = no-op, różny = twardy błąd. 1/8: 48/56 graczy z typami. Widoki/compute były
  już generyczne (iterują po `rounds`) — zero zmian w app/. Bramka: 186 testów.
  ✅ Maruderzy 1/8 (2026-07-04, commit ba3c463): `BAZA` podmienione na „Baza puch v4 (2026.07.04).xlsx".
  Doszło 5 graczy bez typu 1/8 w v3: Żaklina, Małgorzata, KamilF, KrzysztofeR (komplet 18–24) +
  Pimozid (TYLKO mecz 18 — reszta pusta w bazie, tak dosłał). Sokółka mecz 17 już w bazie
  (MANUAL_PICKS = no-op). 1/8: 48/56 → 53/56; bez typu 1/8 nadal: KasiaK, DarekL, Turbo-Ryżu.
  ✅ Uzupełnienia 1/8 — Baza puch v5 (2026-07-05, commit f11bc4d): `BAZA` → „Baza puch v5
  (2026.07.05).xlsx" (czysty nadzbiór v4 — tylko dopiski). Komplet 8 dostali: KrzysztoW, MarekS,
  KrzysztoWś, Mirella (dopisane 19–24), Sokółka (20, 22); Pimozid 1→7. 1/8 nadal 53/56. 7/8
  (brak TYLKO meczu 17 Kanada-Maroko, już rozegrany → 0 pkt za m.17): Żaklina, Małgorzata, KamilF,
  Pimozid, KrzysztofeR. Bez żadnego typu 1/8: KasiaK, DarekL, Turbo-Ryżu. Diagnostyka:
  `scripts/diffBazaV4V5.ts`. Bramka: 204 testy.
  ✅ Runda 1/4 WDROŻONA (2026-07-09, commit 74e3309): `BAZA` → „Baza puch v6 2026.07.09.xlsx"
  (czysty nadzbiór v5), `ROUNDS` + mecze 25–28 (Francja-Maroko, Hiszpania-Belgia, Norwegia-Anglia,
  Argentyna-Szwajcaria), terminarz ET→PL. 54/56 z typami (bez typu: KasiaK, DarekL).
  `ROUND_TO_STAGE` miał już 1/4. Nowość: `CORRECTIONS` w `buildPuchar` — organizator wpisał
  błędny typ do bazy (Magiera mecz 25 odwrotnie) → świadome nadpisanie, samonaprawcze przy
  nowszej bazie.
  ✅ Runda 1/2 WDROŻONA (2026-07-14, commit 2fef086): `BAZA` → „Baza puch v7 2026.07.14.xlsx".
  UWAGA: od v7 arkusz nazywa się `typy` (wcześniej `t2`) — stała `SHEET` w `buildPuchar.ts`.
  v7 = czysty nadzbiór v6 (diff puchar.json: same insercje). Mecze 29–30: Francja-Hiszpania
  (wt 14 lip 21:00 PL), Anglia-Argentyna (śr 15 lip 21:00 PL) — terminy z football-data.org
  (workflow `spike-puchar.yml` zrzuca utcDate; 19:00Z = 15:00 ET). 1/2: 54/56 z typami,
  18 krzyżyków (bez typu: KasiaK, DarekL). Bramka: 204 testy. Finał wg API: 2026-07-19 19:00Z
  (21:00 PL) — przy reingest finału sprawdzić numer meczu w bazie i dodać wpis w `ROUNDS`.
  ✅ Mecz o 3. MIEJSCE + FINAŁ WDROŻONE (2026-07-18, commit c3c0952): `BAZA` → „Baza puch v8
  2026.07.18.xlsx" (czysty nadzbiór v7 — diff puchar.json: same insercje). `ROUNDS` + rundy
  `3. miejsce` (mecz 31 Francja-Anglia, sob 18 lip 23:00 PL, 5 krzyżyków) i `finał` (mecz 32
  Hiszpania-Argentyna, nd 19 lip 21:00 PL, 8 krzyżyków) — etykiety zgodne z `ROUND_TO_STAGE`
  (THIRD_PLACE/FINAL), terminy z API (spike-puchar: 21:00Z/19:00Z). Obie rundy 54/56 z typami
  (bez typu: KasiaK, DarekL). UWAGA: KamUla ma w bazie typ finału **12:0** — podejrzana wartość
  (możliwa literówka organizatora), zgłoszona użytkownikowi 2026-07-18. Bramka: 204 testy.
- ⏳ Następne: PWA (odłożone — patrz rozmowy), ingest + render Konkursu 2 (czekamy na typy K2
  od organizatora); po finale: komplet wyników zejdzie robotem, turniej domknięty.

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
**Bonus „skuteczności" `skutBonus` (nowa reguła organizatora, 2026-06-18):** top 3 KAŻDEGO
z 4 etapów (tura 1, tura 2, tura 3, cała faza pucharowa) dostaje +3/+2/+1. To NIE są zwykłe
punkty (nie dublują dorobku ani `bns`) — doliczane do skuteczności jako UKRYTY tiebreaker
tabeli końcowej („as z rękawa przy równych punktach"). Organizator (WhatsApp 2026-06-18):
ma być policzony i zapamiętany, ale NA RAZIE NIE wyświetlany, i ZACZNIE FUNKCJONOWAĆ dopiero
od fazy pucharowej. Implementacja: `engine/efficiencyBonus.ts` (czysta, top3 per zamknięty
etap, kumulacja) + wpięcie w `compute/buildResults.ts` (ranking etapu po grI/grII/grIII;
remis → sezonowe %; pole `skutBonus` w `TableRow`, NIE wliczane do `points` ani do `rankBy`).
Tura 1 (zamknięta): KSZ +3, Mirella +2, MateuszKn +1. Spec:
`docs/superpowers/specs/2026-06-18-bonus-skutecznosci-design.md`. ✅ ZROBIONE (2026-06-29):
etap pucharowy dodany, `skutBonus` jest najniższym tiebreakerem tabeli ogólnej
(`engine/generalTable.ts`: `pkt → % → puch → grIII → grII → grI → skutBonus`), aktywny od fazy
pucharowej. Nadal NIE wyświetlany i NIE wliczany do `points`.
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
   interpretacja „±1 przed podwojeniem" zweryfikowana z agregacją `rpuch` (patrz Status).
   ✅ Ingest typów pucharowych + wpięcie `puch` i #6 do tabel ZROBIONE i WDROŻONE (2026-06-29).
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
