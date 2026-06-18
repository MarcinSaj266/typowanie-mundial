# Spec: bonus „skuteczności" (ukryty tiebreaker etapowy)

Data: 2026-06-18

## Kontekst

Organizator wprowadził w trakcie turnieju (2026-06-18) nową regułę: nagradza top 3
**każdego z czterech etapów** (tura 1, tura 2, tura 3 fazy grupowej oraz cała faza
pucharowa) dodatkowymi „punktami za skuteczność": **+3 / +2 / +1**. To NIE są zwykłe
punkty (nie dublują dorobku ani bonusu grupowego `bns`) — mają służyć jako rozstrzygnięcie
remisu w tabeli końcowej („as z rękawa przy tej samej liczbie punktów").

Doprecyzowanie organizatora (WhatsApp, 2026-06-18 22:10): bonus ma być **policzony
i zapamiętany, ale na razie NIE wyświetlany**; **zacznie funkcjonować dopiero od rundy
pucharowej**.

Za turę 1 (już zamkniętą) ranking po `grI`: KSZ 55 > Mirella 54 > MateuszKn 53 →
**KSZ +3, Mirella +2, MateuszKn +1** (zgadza się z ogłoszeniem organizatora).

## Zakres (świadomie minimalny)

W zakresie TERAZ:
- Policzyć bonus automatycznie z punktów etapu (decyzja użytkownika: auto, nie ręcznie).
- Przechować go w `public/data/results.json` jako ukryte pole per gracz.
- Udokumentować regułę (CLAUDE.md + pamięć).

POZA zakresem teraz (świadomie):
- Wyświetlanie w UI (tabela/profil/karta) — żadne.
- Wpięcie jako aktywny tiebreaker — dopiero od fazy pucharowej (osobne zadanie, razem
  z ingestem typów pucharowych, `puch` i #6 w „%"). Wtedy też ustalimy mechanikę
  (doliczanie do „%" vs osobny stopień) — dziś nierozstrzygnięte, bo nieaktywne.

## Reguły

- **Etap = jedna tura grupowa albo cała faza pucharowa.** 4 etapy łącznie.
- **Top 3 etapu** liczony po punktach tego etapu: tura → `grI`/`grII`/`grIII`,
  puchar → `puch`. Ranking wśród WSZYSTKICH 56 uczestników (nie per grupa).
- **Bonus**: miejsce 1 → 3, 2 → 2, 3 → 1.
- **Kumulacja**: sumuje się przez etapy (gracz w top3 kilku etapów zbiera sumę).
- **Aktywacja etapu**: dopiero gdy etap KOMPLETNY (wszystkie jego mecze rozegrane).
  Niekompletny etap nie przyznaje bonusu. Dziś: tura 1 kompletna → bonus; tura 2/3
  i puchar niekompletne → 0.
- **Remis w rankingu etapu** rozstrzygany deterministycznie: punkty etapu → sezonowe „%"
  → alfabetycznie nick (wbudowany tiebreaker `rankBy`). W turze 1 brak remisu w top 3.
  Gdyby organizator chciał inny podział przy remisie — korekta przy aktywacji (puchar).

## Architektura

Granice jak reszta silnika: czysta funkcja w `engine/`, sklejka w `compute/`.

### `engine/efficiencyBonus.ts` (nowy, czysty, TDD)
Wzorowany na `engine/bonus.ts` (`groupBonus`).
```ts
export interface PhaseStanding {
  /** Czy etap kompletny (wszystkie mecze rozegrane). */
  complete: boolean;
  /** participantId w kolejności miejsc (indeks 0 = miejsce 1). */
  standings: readonly string[];
}
const PLACE = [3, 2, 1];
/** participantId → skumulowany bonus skuteczności (tylko nagrodzeni). */
export function efficiencyBonus(phases: readonly PhaseStanding[]): Record<string, number>;
```
Logika: dla każdego `complete` etapu dodaj `PLACE[i]` trzem pierwszym ze `standings`,
sumując między etapami. Niekompletne pomiń.

### `compute/buildResults.ts` (wpięcie)
- Dla tur 1/2/3: `complete` = tura wczytana i każdy jej mecz ma wynik (jak istniejący
  helper `groupStageComplete`, ale per tura); `standings` = `rankBy(seasons po grN + hitRate)`
  → lista id. Puchar pominięty (brak danych — `puch`=0, etap niekompletny).
- `efficiencyBonus([tura1, tura2, tura3])` → mapa `skutBonus`.
- Doklej `skutBonus` do wierszy `general` (i grupowych = ta sama wartość per gracz —
  to atrybut gracza). NIE zmienia `points`, NIE wchodzi do kluczy `rankBy`.

### `compute/types.ts`
- `TableRow` dostaje pole `skutBonus: number` (suma; 0 = brak).

## Co się NIE zmienia
- Kolejność i zawartość tabel (ogólnej i grupowych) — identyczne; `skutBonus` jest tylko
  noszony, nie sortuje.
- UI, karty, robot, ingest — bez zmian.

## Testy (TDD)
- `engine/efficiencyBonus.test.ts`: pusty wejściowo; jeden kompletny etap → 3/2/1 dla top3;
  etap niekompletny → 0; kumulacja przez etapy; <3 graczy w etapie (krótka lista);
  brak podwójnego liczenia.
- `compute/buildResults.test.ts`: po komplecie tury → top3 dostają skutBonus 3/2/1,
  reszta 0; niekompletna tura → wszyscy 0; `points`/pozycje BEZ zmian względem stanu
  bez bonusu (dowód, że to tylko zapis).

## Weryfikacja
- `npm test`, `typecheck`, `build`, `smoke`, `validate:excel` (112/0) — wszystko zielone.
- Sprawdzić w `public/data/results.json`: KSZ.skutBonus=3, Mirella=2, MateuszKn=1, reszta 0;
  kolejność tabeli ogólnej identyczna jak przed zmianą.
