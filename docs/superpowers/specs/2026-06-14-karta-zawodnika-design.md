# Karta zawodnika — projekt (spec)

Data: 2026-06-14
Status: do akceptacji (po zatwierdzeniu → plan implementacji)

## 1. Cel i kontekst

Dodatkowa, „społeczna" funkcja dla uczestników konkursu typowania MŚ 2026: **karta zawodnika**
w stylistyce 16-bit (jak FIFA/Panini), pokazująca rozbudowane statystyki gracza policzone z jego
typów i wyników. Karta:

- daje **przewagę nad Excelem** organizatora (statystyki, których tam nie ma),
- jest **efektowna wizualnie** (spójna z obecną apką),
- działa **społecznie**: gracz pobiera swoją kartę jako PNG i chwali się nią na firmowym czacie.

To pierwsza z rozważanych „ekstra" funkcji. Świadomie **wąski zakres v1** — patrz §3.

## 2. Decyzje zatwierdzone w brainstormingu

- Kierunek: karta gracza + wyliczane atrybuty (nie sama tabela liczb).
- Nagłówek karty = **MIEJSCE W GRUPIE + PUNKTY** (liczby wprost z tabeli; bez abstrakcyjnego „OVR").
- Generowanie PNG: **wariant A — przy buildzie** (gotowy plik pod stałym linkiem + podgląd na czacie
  przez OG). Daje pełne pobieranie na telefon/komputer ORAZ link/unfurl, czego wariant „render w
  przeglądarce" nie ma.
- Stylistyka: paleta 1:1 z apką (`--murawa #1b5e20`, `--zolty #ffd600`, `--neon #76ff03`, biały,
  czarny cień), font Press Start 2P.
- Napisy: **z polskimi znakami** (poprawna pisownia), mimo że Press Start 2P nie ma WIELKICH liter
  z ogonkami i małe ogonkowe glify „skaczą" (niższe). Świadoma akceptacja organizatora-użytkownika.
  (Ewentualny przyszły fix: osobny pikselowy font z pełnym PL — poza tą funkcją.)
- Definicje atrybutów (§4) trafiają też do **stopki/legendy „do wiadomości organizatora"** —
  musi je zaakceptować.
- **Workflow:** nic nie idzie na produkcję bez wyraźnego akceptu użytkownika; najpierw pełne testy
  lokalne (`npm test && typecheck && build && build:cards && smoke`) + oględziny w przeglądarce.
- **Karta żyje przez CAŁY turniej (decyzja 2026-06-15).** Karta nie zamraża się po fazie grupowej.
  Hero karty jest „evergreen": pokazuje **MIEJSCE W TABELI OGÓLNEJ** + **PUNKTY = całkowity dorobek**
  (`grI+grII+grIII+bns+puch`, czyli `general.points`). W fazie grupowej `bns=puch=0`, więc to te same
  liczby co dotąd; po grupach rosną samoczynnie (bonus, później puchar) bez przebudowy karty.
  MIEJSCE W GRUPIE zostaje, ale jako wiersz statystyki. Sekcje WYNIKI/STYL GRY/PO TURZE 2 pozostają
  „historią fazy grupowej". Pełne atrybuty pucharowe (typy puchar K1) to świadomie osobna, późniejsza
  funkcja (czeka na ingest typów pucharowych) — patrz §3.
- **Wejście na kartę (decyzja 2026-06-15).** Karta NIE jest wklejona w profil. Profil `/gracz/[id]`
  zostaje jak dziś (skrót + tury), a NA GÓRZE (nad skrótem) dochodzi retro-przycisk
  „★ KARTA ZAWODNIKA →" prowadzący do osobnej podstrony `/gracz/[id]/karta/`. Podstrona zawiera:
  dużą kartę-PNG, przycisk pobrania, te same liczby tekstem (a11y/SEO) ORAZ czytelną LEGENDĘ
  wszystkich atrybutów (definicje liczone wprost z typów i wyników). `og:image` (unfurl na czacie)
  jest na TEJ podstronie — to ją wkleja się jako link do karty. (Akceptacja definicji przez
  organizatora pozostaje osobnym krokiem procesu — §11 — nie elementem strony.)

## 3. Zakres

**W zakresie v1:**

- Karta każdego z 56 graczy na osobnej podstronie `/gracz/[id]/karta/`, linkowanej z profilu
  retro-przyciskiem „★ KARTA ZAWODNIKA →" (na górze profilu, nad skrótem). Hero (miejsce ogólne +
  punkty całkowite) jest aktualne przez cały turniej; szczegółowe atrybuty (WYNIKI/STYL GRY/PO TURZE 2)
  opisują fazę grupową K1 i po jej zakończeniu zostają jako stała „historia".
- Build-time PNG per gracz: `public/karty/<id>.png`.
- Na podstronie karty: przycisk „Pobierz kartę (PNG)" (link do pliku), liczby tekstem (a11y/SEO),
  czytelna legenda atrybutów oraz `og:image` (unfurl na czacie).
- Atrybuty z §4 (część „PO TURZE 2" wyświetlana, ale aktywuje się dopiero z danymi ≥2 tur).

**Poza zakresem v1 (osobne funkcje na później):**

- Nemezis/bliźniak i pojedynki H2H między graczami.
- Skróty meczów (YouTube/TVP).
- Karta dla Konkursu 2 i fazy pucharowej.
- Udostępnianie „jednym klikiem" do konkretnych komunikatorów (polegamy na natywnym
  pobieraniu/udostępnianiu obrazka i wklejaniu linku).

## 4. Atrybuty i definicje (ground truth do akceptacji organizatora)

Wszystko liczone z danych, które już są w systemie (typy + wyniki). Nic nie jest zmyślane.

### Nagłówek

| Pole | Definicja | Źródło |
|---|---|---|
| MIEJSCE OGÓLNE (hero) | pozycja w tabeli ogólnej (`#k / 56`) — żywe przez cały turniej | tabela ogólna (`general.position`) |
| PUNKTY (hero) | całkowity dorobek `grI+grII+grIII+bns+puch` (= `general.points`) | tabela ogólna |
| MIEJSCE W GRUPIE (wiersz stat) | pozycja gracza w tabeli jego grupy (`#k / 7`) | tabela grupowa (`groups`) |

`ŚR. PKT / MECZ` (§4 WYNIKI) liczy się z dorobku FAZY GRUPOWEJ (suma pkt meczowych / rozegrane),
nie z `general.points` — to celowe rozróżnienie: hero = standing ogólny, sekcje = historia grupowa.

### Sekcja WYNIKI (twarde, wprost z reguł konkursu)

| Atrybut | Definicja | Wzór |
|---|---|---|
| CELNOŚĆ | % trafionych meczów (każde trafienie 3/4/5) | `hitRate` = `(count3+count4+count5)/played` |
| DOKŁADNE WYNIKI | liczba meczów za „5" (wynik co do gola) | `count5` |
| ŚR. PKT / MECZ | średni dorobek na mecz | `points / played` |

### Sekcja STYL GRY (zabawne; regułę definiujemy MY)

| Atrybut | Definicja | Uwagi/edge |
|---|---|---|
| ODWAGA | % typów spoza „bezpiecznych" {1:0, 0:1, 1:1, 0:0} | im wyżej, tym śmielej |
| NOS DO REMISÓW | `trafione remisy / wytypowane remisy` (%) | brak wytypowanych remisów → `—` |
| NAJDŁUŻSZA SERIA | najdłuższy ciąg trafień pod rząd (w kolejności meczów) | działa już od tury 1 |
| OFENSYWA | śr. liczba goli w Twoich typach (`home+away`) | |
| PEWNIAK | śr. pkt liczona TYLKO z meczów trafionych | brak trafień → `—` |
| ULUBIONY WYNIK | najczęściej typowany wynik | remis częstości → niższa suma bramek → alfabetycznie |
| ZGODNOŚĆ Z TŁUMEM | śr. (po meczach) % graczy z TYM SAMYM REZULTATEM (1/X/2) | → plakietka osobowości |

**Plakietka osobowości** (z ZGODNOŚCI Z TŁUMEM `c`): `c < 65%` → ★ INDYWIDUALISTA;
`c > 73%` → ★ OWCZY PĘD; w przeciwnym razie → ★ NEUTRALNY.

> **Uwaga (2026-06-16):** miara ZGODNOŚCI liczy zgodę na **rezultat** (1/X/2), nie na dokładny
> wynik. Powód: dokładne wyniki rozdrabniają się przy ~56 graczach — wszyscy lądują w 12–35%, więc
> każdy wychodził „indywidualistą", a OWCZY PĘD (próg ≥60%) był martwy. Zgoda na rezultat mieści się
> realnie w ~55–78%, stąd progi 65/73 (różnicują stawkę na 3 niepuste grupy). Progi bezwzględne
> celowo — gracz sam je sprawdzi ze swojej liczby (warunek: jasne dla graczy + opis w legendzie).

### Sekcja PO TURZE 2 (aktywne, gdy ≥2 tury mają wyniki)

| Atrybut | Definicja |
|---|---|
| FORMA | trend: znak `(dorobek ostatniej tury z wynikami − poprzedniej)` → ▲ / ▼ / ▬ |
| NAJLEPSZA TURA | `max(grI, grII, grIII)` po turach z wynikami |

Dopóki jest tylko 1 tura z wynikami — obie pozycje wyszarzone z wartością `—`
(„ODBLOKUJE SIĘ PO TURZE 2").

## 5. Architektura i moduły

Trzymamy istniejące granice (silnik nie wie o Excelu/UI/PNG; render czyta tylko
`public/data/results.json` + statyczne pliki).

```
engine/playerCard.ts   – CZYSTA funkcja: (typy gracza + wyniki + wiersz tabeli) → staty karty.
                         TDD; ground truth = ręcznie zweryfikowane liczby (Talvik, DarekJell).
compute/buildResults.ts – dolicza sekcję `cards` do public/data/results.json
                         (jedna mapa: nick → komplet stat karty).
scripts/buildCards.mjs  – `npm run build:cards`: dla każdego gracza renderuje PNG
                         (Satori → SVG → PNG przez `sharp`) do public/karty/<id>.png.
                         Layout karty zdefiniowany TU (jedno źródło wyglądu).
app/gracz/[id]/         – profil bez zmian (skrót + tury); NA GÓRZE dochodzi retro-przycisk
                         „★ KARTA ZAWODNIKA →" linkujący do ./karta/.
app/gracz/[id]/karta/   – podstrona karty: <img src="/karty/<id>.png"> + przycisk pobrania
                         (link z download) + te same liczby tekstem (a11y/SEO) + czytelna
                         legenda atrybutów + og:image = /karty/<id>.png (unfurl). Static export
                         (generateStaticParams po 56 id; trailingSlash → out/gracz/<id>/karta/).
```

**Zasada „PNG = jedyne źródło wyglądu karty":** na stronie pokazujemy ten sam PNG jako `<img>`,
więc to-co-widzisz = to-co-udostępniasz. Brak podwójnego utrzymywania layoutu (HTML + PNG).
Liczby pod spodem to zwykły, dostępny tekst (dla czytników/SEO), stylowany jak reszta apki.

## 6. Generowanie PNG (szczegóły techniczne)

- **Silnik:** `satori` (HTML/flexbox → SVG) + `sharp` (SVG → PNG). `sharp` jest już zależnością
  (ciąga go Next.js); dodajemy `satori` do `package.json`. Satori **wektoryzuje tekst do ścieżek**
  używając podanego fontu → PNG jest ostry i nie zależy od fontów systemowych.
- **Font:** Satori potrzebuje TTF/OTF/WOFF (nie WOFF2). Commitujemy `PressStart2P-Regular.ttf`
  (np. `assets/fonts/` lub obok skryptu); w repo dziś jest tylko WOFF2 do CSS.
- **Skala:** render w 2× dla ostrości (szer. karty ~720 px), bez rozmywania (wektory).
- **OG:** strona `/gracz/[id]` ustawia `og:image`, `og:image:width/height`, `twitter:card=summary_large_image`
  → wklejony link rozwija się jako podgląd karty na czacie.
- **Zależność danych:** karty zależą od `public/data/results.json`. `build:cards` uruchamiamy
  PO `build:results`. Robot auto-scores (przy zmianie wyników) musi też odświeżyć karty
  (dodać `build:cards` do jego kroku build) — inaczej PNG się zdezaktualizują względem tabeli.

## 7. Kształt danych w results.json

Dodajemy sekcję `cards` (mapa nick → staty). Przykład:

```json
"cards": {
  "Talvik": {
    "group": "E", "groupPos": 4, "points": 13,
    "celnoscPct": 38, "dokladne": 2, "srPktMecz": 1.6,
    "odwagaPct": 63, "nosRemisowPct": 0, "nosRemisowNd": false,
    "seria": 2, "ofensywa": 2.0, "pewniak": 4.3, "pewniakNd": false,
    "ulubionyWynik": "0:2", "zgodnoscPct": 60, "osobowosc": "INDYWIDUALISTA",
    "forma": null, "najlepszaTura": null, "poTurze2Aktywne": false
  }
}
```

(`*Nd` = „nie dotyczy" — np. brak wytypowanych remisów; render pokazuje `—`.)

## 8. Przypadki brzegowe

- **Brak wytypowanych remisów** → NOS DO REMISÓW = `—`.
- **Zero trafień** → PEWNIAK = `—`; CELNOŚĆ 0%; SERIA 0.
- **<2 tury z wynikami** → FORMA i NAJLEPSZA TURA wyszarzone (`—`).
- **Gracz bez typów w danym meczu** → mecz pomijany w licznikach (jak dziś w silniku).
- **ULUBIONY WYNIK — remis częstości** → reguła deterministyczna (niższa suma bramek, dalej
  alfabetycznie), żeby wynik był powtarzalny.
- **Tura bez wyników** → nie wlicza się do CELNOŚCI/PEWNIAKA itd. (liczymy z `played`).

## 9. Testy i bramka jakości

- **TDD `engine/playerCard.ts`** (vitest): asercje co do liczby na ręcznie zweryfikowanych
  wartościach (Talvik: 38% / 2 / 1.6 / 63% / 0% / seria 2 / ofensywa 2.0 / pewniak 4.3 /
  ulubiony 0:2 / zgodność 60% → INDYWIDUALISTA; DarekJell: 63% / 3 / 2.6 / nos 100% / …).
  Testy edge (brak remisów, brak trafień, <2 tury).
- **Smoke** rozszerzony: `out/karty/<id>.png` istnieją (56 plików), strony `/gracz` mają `og:image`.
- **Bramka:** `npm test && npm run typecheck && npm run build && npm run build:cards && npm run smoke`
  — wszystko zielone **lokalnie** → oględziny kilku kart w przeglądarce.

## 10. Workflow / wdrożenie

1. Implementacja + zielona bramka lokalnie.
2. Oględziny kart w przeglądarce (kilka profili).
3. **Wyraźny akcept użytkownika.**
4. Dopiero wtedy commit + push na `master` → Vercel przebudowuje produkcję.
5. Robot auto-scores rozszerzony o `build:cards`, by PNG nadążały za wynikami.

## 11. Do akceptacji organizatora

- Definicje atrybutów STYL GRY (§4) — zwłaszcza ODWAGA (zbiór „bezpiecznych" wyników),
  NOS DO REMISÓW, ZGODNOŚĆ Z TŁUMEM i progi osobowości.
- Zgoda na napisy z „skaczącymi" polskimi znakami (lub decyzja o innym foncie — wtedy osobne zadanie).

## 12. Prototyp (dowód wykonalności)

Wariant A zweryfikowany jednorazowym, niecommitowanym skryptem (`.superpowers/cardproto/`,
gitignored): Satori + sharp + Press Start 2P TTF → realne PNG (karty Talvik i DarekJell,
wersje ASCII i PL) na prawdziwych danych z tury 1. Pipeline działa.
