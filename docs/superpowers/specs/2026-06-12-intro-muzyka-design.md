# Intro + muzyka — specyfikacja (2026-06-12)

> Tryb przyspieszony: użytkownik offline, oddanie produkcji 2026-06-13. Decyzje podjęte
> autonomicznie na bazie specyfikacji Fazy 1 (wizja: 16-bit, Kick Off 3 / Dino Dini's Goal).
> Do weryfikacji przez użytkownika po fakcie.

## Cel

Ekran tytułowy `/` dostaje klimat intra ze starej gry: krótka animowana sekwencja
wejściowa + muzyka włączana przyciskiem. Bez zmiany architektury (static export,
render czyta tylko `public/data/results.json`).

## Zakres

| Element | Decyzja |
|---|---|
| Sekwencja intro | Czysty CSS na `/`: pas murawy wjeżdża, tytuł wpada z góry (bounce), pikselowa piłka (box-shadow art) przetacza się przez ekran, subtitle + menu pojawiają się z opóźnieniem (~2 s), PRESS START miga jak dotąd. Odtwarza się przy każdym wejściu na `/` (tanio, zero gatingu, zero JS). |
| Muzyka | `MusicToggle` (`'use client'`, jedyny klientowy komponent w apce) w `app/layout.tsx`: stały przycisk ♪ w rogu, `<audio loop>` z `public/audio/full-time-glory.mp3` (plik od użytkownika: `muzyczka do aplikacji/Full_Time_Glory.mp3`, 2,9 MB — ładowany leniwie dopiero po włączeniu, `preload="none"`). Domyślnie wyłączona (autoplay i tak blokują przeglądarki); bez zapamiętywania preferencji (YAGNI — odtworzenie po powrocie i tak wymaga gestu). Przy nawigacji App Routera layout nie jest remontowany → muzyka gra dalej między widokami. |
| Dostępność | `prefers-reduced-motion: reduce` wyłącza animacje intro (wszystko widoczne od razu). Przycisk z `aria-pressed` i czytelną etykietą. |
| Poza zakresem | Efekty dźwiękowe per akcja, PWA, intro wideo, pomijanie intro (sekwencja trwa ~2 s — nie ma czego pomijać). |

## Rozważone warianty

1. **(wybrany)** Intro jako animacja CSS ekranu tytułowego — zero JS, zero gatingu,
   działa offline i ze static exportem; minus: odtwarza się za każdym wejściem na `/`
   (akceptowalne przy ~2 s).
2. Overlay intro raz na sesję (`sessionStorage`) — wymaga JS na każdej stronie,
   komplikuje hydrację; odrzucone.
3. Osobna trasa `/intro` z przekierowaniem — łamie prostotę linku dla uczestników;
   odrzucone.

## Testy / bramka jakości

- `npm run build` przechodzi (typy `MusicToggle` sprawdzane w buildzie).
- `npm run smoke` rozszerzony: `out/index.html` zawiera element intro (`game-title`)
  i przycisk muzyki; `out/audio/full-time-glory.mp3` istnieje.
- Reszta bramki bez zmian: `npm test && npm run typecheck`.
