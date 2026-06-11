# Typowanie Mundial 2026 — Specyfikacja (Faza 1)

**Data:** 2026-06-11
**Autor / właściciel:** Marcin (pomoc dla organizatora konkursu)
**Status:** Zatwierdzona do spisania planu implementacji

---

## 1. Kontekst i cel

W pracy organizowany jest konkurs typowania wyników na czas Mistrzostw Świata 2026
(USA / Meksyk / Kanada). Bierze udział ok. 56 uczestników. Konkurs prowadzi kolega-organizator;
ten projekt ma **pokazywać wyniki i statystyki** w atrakcyjnej, interaktywnej formie webowej
(telefon + komputer), zastępując/uzupełniając arkusze Excel.

Konkurs składa się z dwóch części:
- **Konkurs 1** — typowanie wyników poszczególnych meczów przez cały turniej.
- **Konkurs 2** — jednorazowe typowanie generalnych rozstrzygnięć (miejsca w grupach, drabinka, mistrz).

### Priorytet
Najpierw **dane + logika** (poprawne liczenie punktów i statystyk), potem oprawa wizualna.
Dlatego projekt podzielony jest na fazy — **ta specyfikacja obejmuje Fazę 1 (logika)**.
Faza 2 (oprawa 16-bit w stylu Kick Off 3 / Dino Dini's Goal, dźwięk, intro) to osobna specyfikacja.

---

## 2. Reguły konkursu (źródło prawdy = formuły w Excelu)

Logikę odtworzono przez analizę formuł w plikach `k1.xlsx`, `k2.xlsx`, `konkurs 2026.06.11.xlsx`.

### 2.1. Konkurs 1 — punktacja meczu (faza grupowa)
Porównanie typu uczestnika (gosp./gości) z faktycznym wynikiem:

| Warunek | Punkty (kumulatywnie) |
|---|---|
| Trafiony rezultat (wygrana / remis / przegrana) | 3 |
| + trafiona różnica bramek (dotyczy też remisów) | +1 → 4 |
| + dokładny wynik | +1 → 5 |

Wartość meczu ∈ {0, 3, 4, 5}. Odpowiada formułom Excela:
`Y=IF(outcome_typ=outcome_real,3,0)`, `Z=IF(diff_typ=diff_real,1,0)`,
`AA=IF(Z=1 AND home_typ=home_real,1,0)`, suma = `Y+Z+AA`.

### 2.2. Konkurs 1 — agregacja
- Suma uczestnika w turze = `#3×3 + #4×4 + #5×5`.
- Faza grupowa: **8 stałych grup konkursowych A–H po 7 osób** (56 uczestników).
  Skład niezmienny przez całą fazę grupową.
- Faza grupowa rozliczana w **3 turach** (grup I / II / III) — to punkty z tury 1/2/3.
- Tabela grupy: sort malejąco po **punktach → „%" (= (#3+#4+#5)/liczba_rozegranych) → liczbie
  dokładnych wyników → liczbie „4" → …** (tiebreakery z `SORTBY`).
- Tabela ogólna: `suma = grI + grII + grIII + bns + puch`, sortowanie po sumie + te same tiebreakery.

### 2.3. Konkurs 1 — faza pucharowa
- Punktacja meczu **×2**. W Excelu wartości meczu to **6 / 8 / 10 / 12** = 2 × {3, 4, 5, 6}.
- Od fazy pucharowej **jedna wspólna tabela** dla wszystkich (koniec grup konkursowych).
- **OTWARTE:** kategoria „6" (kolumna `6p`) — co dokładnie ją daje (np. dokładny wynik po
  dogrywce / trafienie awansującego). Do ustalenia przed startem fazy pucharowej.

### 2.4. Konkurs 2 — punktacja (jednorazowo)
Z arkusza `zasady`:

| Trafienie | Punkty |
|---|---|
| Drużyna na właściwym miejscu w grupie | 1 |
| Drużyna w 1/16 finału | 2 |
| Drużyna w 1/8 finału | 4 |
| Drużyna w ćwierćfinale | 6 |
| Drużyna w półfinale | 8 |
| Drużyna w finale | 10 |
| Mistrz świata | 12 |

- Za rozstawienie w drabince (konkretna pozycja) brak dodatkowych punktów — liczy się sama obecność
  drużyny w danej fazie.
- Tiebreak tabeli końcowej: **większa liczba punktów zdobyta w późniejszej fazie**.
- Wymaga wyliczenia **faktycznych tabel grup** z wyników meczów (reguły FIFA: punkty, różnica bramek,
  bramki zdobyte, bezpośrednie spotkania itd.) oraz faktycznego stanu drabinki.

### 2.5. Bonus grupowy (`bns`) — OTWARTE / czeka na organizatora
W Excelu istnieje **zalążek** systemu bonusów (stałe 15/10/5 — wygląda na bonus za 1./2./3. miejsce
w grupie; oraz `IF(suma_grupy = MAX, 4/3/2/1)` — meta-bonus dla najlepszych grup), **ale kolumna
`bns` w tabeli ogólnej nie ma formuły (pusta/ręczna), a spisane zasady organizatora bonusu nie
wymieniają.** Decyzja: **zaprojektować bonus jako osobny, konfigurowalny moduł, domyślnie wyłączony
(`bns = 0`)**; włączyć/zmienić po potwierdzeniu zasad przez organizatora.

---

## 3. Decyzje architektoniczne

| Temat | Decyzja |
|---|---|
| Architektura | **Static-first**: silnik TS + skrypt ingest → JSON → render Next.js (statyczny) |
| Hosting | Vercel (darmowo), link dla uczestników, PWA (skrót na ekran telefonu) |
| Logowanie | Brak — uczestnik wybiera swój login, zapamiętany w przeglądarce |
| Źródło wyników | **Ręczny plik wyników** teraz; hak na API piłkarskie później (nie MCP) |
| Format typów (wejście) | **Jeszcze nieustalony** — parser z warstwą adaptera; domknąć po zobaczeniu realnych plików (rozsyłane 11.06) |
| Język/stack | TypeScript, Next.js + React |

**Uwaga o MCP:** MCP to protokół dla asystentów AI, nie sposób na pobieranie wyników do aplikacji.
Auto-pobieranie wyników (opcjonalnie, później) zrealizowałoby zwykłe API piłkarskie
(np. football-data.org / API-Football); ryzyko: darmowe plany ograniczone i niepewna dostępność
danych WC2026.

---

## 4. Struktura projektu

Jeden projekt Next.js (TypeScript) z wydzielonymi, niezależnie testowalnymi modułami:

- `engine/` — czysty silnik punktacji (bez zależności od UI; pełne testy jednostkowe)
- `ingest/` — parser plików (adapter Excel) + ładowanie pliku wyników → liczy → zapisuje
  `public/data/results.json`
- `data/` — wejście: roster + przydziały do grup konkursowych, terminarz, plik wyników, pliki typów
- `app/` — render Next.js (selektor uczestnika, tabele, statystyki, komentarze)

Granice modułów: silnik dostaje kanoniczne dane (typy + wyniki) i zwraca policzone tabele/statystyki;
nie wie nic o Excelu ani UI. Ingest tłumaczy pliki źródłowe na model kanoniczny. UI tylko renderuje JSON.

---

## 5. Model danych (kanoniczny JSON)

- **teams** — 48 drużyn (kod + nazwa PL).
- **fixtures** — 72 mecze fazy grupowej (z `k1.xlsx`: para drużyn, tura, grupa turniejowa) + szkielet
  drabinki pucharowej (uzupełniany wg postępu).
- **groups** — 12 grup turniejowych (A–L) FIFA.
- **participants** — 56 uczestników (loginy z `tab grup`).
- **participantGroups** — 8 grup konkursowych A–H po 7 (przydziały z `tab grup`).
- **predictions.k1** — per uczestnik → per tura (I/II/III) → per mecz: (bramki_gosp, bramki_gości).
- **predictions.k2** — per uczestnik → kolejność drużyn w 12 grupach + obsada faz: 1/16, 1/8, ćwierć,
  półfinał, finał, mistrz.
- **results** — per mecz faktyczny wynik; stan drabinki pucharowej w miarę postępu.

---

## 6. Silnik punktacji (rdzeń — TDD)

Funkcje czyste, deterministyczne:
- `scoreMatchK1(typ, wynik) → 0|3|4|5` (reguła 2.1).
- Agregacja tur, tabele 8 grup konkursowych z tiebreakerami (2.2).
- Tabela ogólna `= grI+grII+grIII+bns+puch` (2.2).
- Faza pucharowa ×2 (2.3) — włączana, gdy ruszy.
- Konkurs 2 (2.4): wylicz faktyczne tabele grup (reguły FIFA) i stan drabinki z wyników,
  porównaj z typami, przyznaj 1/2/4/6/8/10/12; tiebreak = dorobek z późniejszej fazy.
- Moduł bonusu (`bns`) — osobny, konfigurowalny, domyślnie wyłączony (2.5).

---

## 7. Statystyki

- **Per uczestnik:** pozycja w grupie i ogólna, trend (zmiana pozycji), liczba 3/4/5, punkty „dziś",
  „dzień po dniu", najlepszy/najgorszy typ, seria.
- **Globalne:** najczęstsze typy, najlepszy wynik dnia, rozkłady, ciekawostki.

---

## 8. Komentarze (zabawne)

Mały silnik regułowy: na podstawie statystyk (ostatnie miejsce, awans/spadek, seria dokładnych
wyników, zero punktów w turze itd.) wybiera polski tekst z szablonów — motywujące/żartobliwe
(„Jesteś ostatni, ale ostatni będą pierwszymi 😉"). W Fazie 1 — treść i wyzwalacze; stylizacja w Fazie 2.

---

## 9. Render (Faza 1 — minimalny)

Next.js statyczny: wybór uczestnika (bez logowania, zapamiętany lokalnie), jego wyniki + statystyki +
komentarz, tabele grup konkursowych i tabela ogólna, podgląd konkursu 2. Wygląd surowy/funkcjonalny —
retro oprawa 16-bit dochodzi w Fazie 2.

---

## 10. Testy

TDD silnika. **Ground truth = formuły Excela** — przypadki testowe odtworzone z logiki arkusza, aby
wyniki zgadzały się co do punktu. Testy parsera na realnych plikach typów (gdy dostępne).

---

## 11. Świadomie poza zakresem Fazy 1 (YAGNI)

Panel wgrywania w przeglądarce, integracja z API wyników, oprawa wizualna/audio, intro z piłkarzykiem.

---

## 12. Pytania otwarte (do domknięcia)

1. **Bonus `bns`** — czy obowiązuje i w jakiej formie (15/10/5? + meta-bonus?). Czeka na organizatora.
2. **Format plików typów** — 56 indywidualnych plików vs jeden wypełniony master. Domknąć po
   otrzymaniu realnych plików (11.06).
3. **Kategoria „6" w fazie pucharowej** — co ją przyznaje. Przed startem fazy pucharowej.
4. **Reguły kolejności w grupach turniejowych FIFA** dla konkursu 2 (zestaw tiebreakerów do potwierdzenia).
