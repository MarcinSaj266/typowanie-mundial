# Spec: faza pucharowa K1 — ingest typów, punktacja `puch`, widok, robot

Data: 2026-06-28

## Kontekst

Po 72 meczach fazy grupowej zaczyna się faza pucharowa MŚ 2026. Organizator przysłał
zasady pucharowe oraz **typy uczestników na 1/16 finału (the last 32)** — 16 meczów,
32 drużyny. Zasady (cytat organizatora, 2026-06-28):

- Typujemy wynik meczu **do 120 minut** (regularny + dogrywka) w żółtych polach.
- Jeśli typujesz remis po 120 min → dodatkowo wskazujesz **krzyżykiem (X)** drużynę,
  która Twoim zdaniem wygra **karne**.
- Punktacja jak w grupach, ale **×2**: dokładny wynik 10, różnica bramek 8,
  rozstrzygnięcie 6.
- Karne: trafiony zwycięzca **+2**, błędny **−2**.

Te zasady **potwierdzają naszą istniejącą implementację** `engine/scoreMatchPuchar`,
która liczy bazę grupową (3/4/5) z modyfikatorem karnych ±1 **przed** podwojeniem.
Matematycznie `(5±1)×2 = {8,12}` i `(4±1)×2 = {6,10}` to dokładnie „×2 wtedy ±2".
Silnik był już zweryfikowany z agregacją `rpuch`. **Zero zmian w silniku meczu.**

### Stan danych wejściowych (ważne)

Plik `Baza puch v1.xlsx` (arkusz `t2`) to **wczesny, niepełny snapshot** — jak swojego
czasu `Baza tura 2 v1→v2→v3`. Organizator (wiadomość 2026-06-28): „Baza na dziś
(nie dosłały 3 osoby więc zupełnie pusto będzie). Jutro pozostałe [typy] niektórych."

Zaobserwowane w v1:
- **55 nicków w bazie vs 56 w rosterze.** Brak `KasiaK` (znany osobny przypadek,
  „caveat KasiaK").
- **52/56 obstawiło ≥1 typ.** Zero typów: `Sokółka`, `DarekL`, `KrzysztoWś` (= „3 osoby"
  od organizatora) + `KasiaK` (nieobecna).
- Typy częściowe: ~10 osób wypełniło tylko mecz 1; `KrystianM` 14/16 (2 mecze bez wyniku
  gościa). To dane „w trakcie zbierania" — będą uzupełniane w nowszych bazach.
- Karne oznaczane `x` **oraz** `X` (54+7 / 48+8 = 117 znaczników) — parsowanie
  **case-insensitive**.

Wniosek: parser pucharowy **musi tolerować braki i częściowe typy** (inaczej niż
`parseBazaTura`, który wymaga kompletu 56). Reingest nowszych baz nadpisuje plik danych.

## Zakres

**Etap A (ten spec, do wdrożenia teraz):**
1. Parser `ingest/k1/parseBazaPuchar` + CLI `build:puchar` → `data/k1/puchar.json`.
2. Agregacja `engine/aggregatePuchar` (czysta) — z istniejącego `scoreMatchPuchar`.
3. Wpięcie `puch` + „6" w „%" tabeli ogólnej + aktywacja etapu pucharowego w `skutBonus`
   (`compute/buildResults.ts`).
4. Widok `/puchar` (rundy → mecze → rozwijane typy), link w menu.

**Etap B (osobny spec/plan po Etapie A):**
5. Robot football-data.org dla pucharu — wyniki + zwycięzca karnych, dopasowanie po
   **dacie** (pary się powtarzają między rundami). Terminy meczów pucharowych jako
   **data + godzina w polskim czasie (Europe/Warsaw)**, konwertowane z UTC API.

POZA zakresem (świadomie):
- Ingest kolejnych rund (1/8, ćwierć…) — ten sam parser, gdy przyjdą typy; nie teraz.
- Render zmian w karcie zawodnika / race / K2.

## Model danych

### `data/k1/puchar.json` (generowany)

```jsonc
{
  "rounds": [
    {
      "round": "1/16",
      "fixtures": [
        { "no": 1, "home": "Kanada", "away": "RPA", "kickoff": "" },
        // ...16 meczów
      ],
      "predictions": {
        "AndrzejO": {
          "1": { "home": 1, "away": 0 },
          "4": { "home": 3, "away": 3, "pk": "away" }   // remis → krzyżyk
        }
        // gracze bez typów po prostu nie występują
      }
    }
  ]
}
```

- **Typ pucharowy** `PucharPick = { home: number; away: number; pk?: 'home' | 'away' }`.
  `pk` obecne tylko gdy `home === away` (remis) i uczestnik postawił krzyżyk.
  Krzyżyk przy nie-remisie → ignorowany (parser ostrzega).
- Brak `kickoff` na razie (`""`); wypełni go Etap B (data+czas PL) lub ręczne uzupełnienie.
- Reingest: CLI nadpisuje `puchar.json` w całości z najnowszej bazy.

### `data/k1/results.json` — nowy klucz `"puch"`

```jsonc
{
  "1": { /* tura 1 */ }, "2": {...}, "3": {...},
  "puch": {
    "1": { "home": 2, "away": 1 },
    "4": { "home": 1, "away": 1, "pk": "home" }   // remis → faktyczny zwycięzca karnych
  }
}
```

`pk` = faktyczny zwycięzca karnych (tylko mecze zakończone remisem po 120'). Jedno źródło
dla ręcznej nadpiski i (Etap B) robota; `mergeScores` nie nadpisuje istniejących wpisów
(ręczne wygrywa — jak w grupach). Numeracja meczów per runda (1..16 dla 1/16).

## Komponenty

### `ingest/k1/parseBazaPuchar.ts` (czysty)

Wzorzec `parseBazaTura`, ale:
- Arkusz `t2`, kolumny: `B`=nick, `C`=mecz, `D/E`=drużyny, `F/G`=wynik,
  `H`=krzyżyk kraj1 (home), `I`=krzyżyk kraj2 (away). Krzyżyk: wartość po `trim()`
  równa `x`/`X` (case-insensitive).
- **Tolerancyjny**: NIE wymaga kompletu rosteru. Waliduje wyłącznie, że każdy obecny
  nick (po aliasie) ∈ roster — nieznany nick to twardy błąd. Nieobecni i częściowe typy
  → brak typu (gracz nie punktuje).
- Typ pełny tylko gdy `F` i `G` obecne. `pk` ustawiane gdy `home===away` i jest krzyżyk;
  krzyżyk przy nie-remisie lub bez kompletnego wyniku → pominięty + `console.warn`.
- Aliasy nicków (base → roster): `WojtekN→Wojtek`, `RafałCz→Rafał`, `PawełS→PawełSt`,
  `Sławek G.→Sławek`, `Turbo-Ryzu→Turbo-Ryżu`.
- Aliasy drużyn: nazwy w bazie zgadzają się z naszą nomenklaturą (32 sprawdzone);
  parametr `teamAlias` zostaje na zapas.
- Fixtures: pierwszy wiersz danego meczu ustala parę, kolejne muszą się zgadzać
  (jak w `parseBazaTura`).
- Sygnatura: `parseBazaPuchar(sheet, opts) → { round, fixtures, predictions }`.
  `round` z opcji (np. `"1/16"`).

CLI `ingest/k1/buildPucharCli.ts` (`npm run build:puchar`): czyta `Baza puch v1.xlsx`
+ `roster.json`, woła parser, scala do `data/k1/puchar.json` (jedna runda teraz;
przy kolejnych rundach dokleja/aktualizuje wpis po `round`).

### `engine/aggregatePuchar.ts` (czysty)

```ts
interface PucharEntry { prediction: PucharPick | null; result: PucharResult | null; }
interface PucharAgg { puch: number; count6: number; count8: number;
                      count10: number; count12: number; played: number; }
function aggregatePuchar(entries: PucharEntry[]): PucharAgg
```

- Per mecz z typem i wynikiem: woła `scoreMatchPuchar(typ, wynik, karne?)`.
  `karne` budowane gdy `wynik` to remis: `{ zwyciezca: wynik.pk, typ: prediction.pk ?? null }`.
- `played` = mecze z typem **i** wynikiem. Kategorie zliczą wartości {6,8,10,12}.
  „Trafienie" do „%" = wynik > 0 (kategorie 6/8/10/12; w tym „12" = remis dokładny
  + trafione karne, czyli organizatorska „6” bazowa).
- `puch` = suma punktów.

### `compute/buildResults.ts`

- Wczytanie `puchar.json` (runda 1/16) + `results.puch`. Per gracz:
  `aggregatePuchar(entries) → puch, kategorie, played`.
- `buildSeason(id, ts, { puch })` — `puch` wchodzi do sumy ogólnej i tiebreakera
  (już oprogramowane w `generalTable`: `pkt → % → puch → grIII → grII → grI`).
- **„%" tabeli ogólnej** rozszerzone o puchar:
  `(hitsGrup + hitsPuch) / (playedGrup + playedPuch)`, gdzie `hitsPuch` = #6+#8+#10+#12.
  Liczone w `buildSeason`/compute tak, by **tabela grupowa pozostała bez zmian**
  (jej „%" i pozycje to nadal sama faza grupowa).
- **`skutBonus`**: dochodzi 4. etap (puchar) jako `PhaseStanding` — `complete` gdy
  wszystkie mecze rundy mają wynik; ranking po `puch` (remis → sezonowe „%"). Reguła
  „aktywny od pucharu" — patrz `2026-06-18-bonus-skutecznosci-design.md`. Mechanika
  aktywacji jako tiebreaker tabeli ogólnej: doliczana jako ostatni klucz `rankBy`
  PO `grI` (najniższy priorytet), nadal niewidoczna w UI.
- Sekcja wynikowa: do `ResultsJson` dochodzi `puchar` (lista rund z meczami, typami
  i punktami per gracz — analogicznie do `turns`) na potrzeby widoku.

### Widok `/puchar` (`app/puchar/page.tsx`)

- Jak `/mecze`: nagłówek rundy → lista meczów → każdy mecz w `<details>`:
  para drużyn + wynik (gdy jest), rozwinięcie = 56 graczy z typem i punktami,
  przy remisach pokazany krzyżyk (PK: home/away). Zero klientowego JS.
- Link w menu (ekran tytułowy) obok `/mecze`. Styl 16-bit jak reszta.
- Static export — strona renderowana z `public/data/results.json` (sekcja `puchar`).

## Przepływ / workflow aktualizacji

1. Nowsza baza typów (`Baza puch vN.xlsx`) → `npm run build:puchar` → `puchar.json`.
2. Wynik meczu pucharowego → `data/k1/results.json` klucz `puch` (ręcznie teraz;
   Etap B: robot).
3. `npm run build:results` → `public/data/results.json`.
4. commit + push → Vercel.

Bramka jakości bez zmian: `npm test && npm run typecheck && npm run build && npm run smoke`.

## Etap B — robot pucharowy (szkic, osobny spec)

- football-data.org zwraca mecze pucharowe ze `stage` (`LAST_16` itd.), `utcDate`,
  oraz po rozegraniu `score.winner`, `score.duration`, `score.penalties`.
- Dopasowanie do naszych fixtures **po dacie** (para drużyn może się powtórzyć między
  rundami — `mergeScores` po samej parze jest niejednoznaczny w skali całego turnieju;
  zakres per runda + data usuwa kolizję).
- Zwycięzca karnych z `score.penalties` (wynik karnych) lub `score.winner` przy
  `duration: 'PENALTY_SHOOTOUT'` → `pk`.
- **Terminy**: `utcDate` → konwersja na **Europe/Warsaw**, zapis jako data+godzina PL
  w `kickoff` fixture'u (rozwiązuje też dług grupowych `kickoff` = wolny tekst).
- Spike: potwierdzić pola karnych w darmowym planie przed wdrożeniem.

## Testowanie (TDD)

- `parseBazaPuchar`: case-insensitive `x/X`; krzyżyk tylko przy remisie; tolerancja
  braków/częściowych; nieznany nick → błąd; aliasy; spójność par.
- `aggregatePuchar`: kategorie {0,6,8,10,12}; karne ±2 (trafiony/błędny/brak krzyżyka);
  `played` i „trafienia" do „%"; remis bez krzyżyka faktycznego — guard.
- `compute`: „%" ogólna wlicza puchar, grupowa nie; `puch` w sumie i tiebreakerze;
  `skutBonus` etap pucharowy aktywny dopiero po komplecie wyników rundy.
- Walidacja: `npm run build:puchar` na `Baza puch v1.xlsx` → 52 graczy z typami,
  3 zero (+KasiaK nieobecna), 117 krzyżyków rozpoznanych, brak twardych błędów.

## Otwarte / do potwierdzenia

- Czy „6" bazowa (remis dokładny + trafione karne) liczy się do „%" jako jedna kategoria
  (#12) — przyjęte: TAK, każda kategoria >0 to trafienie. Zweryfikować z `rpuch`/masterem,
  gdy organizator dopnie formuły meczu pucharowego (dziś `C:AH` puste).
- Mechanika `skutBonus` jako aktywny tiebreaker (osobny stopień vs „%") — przyjęte:
  najniższy klucz `rankBy`, niewidoczny. Potwierdzić przy pierwszych remisach.
