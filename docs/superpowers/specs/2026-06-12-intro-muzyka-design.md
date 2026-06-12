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
| Sekwencja intro (v2, feedback użytkownika 2026-06-12) | Czysty CSS na `/`: tytuł wpada z góry (bounce), potem scenka — pikselowy **piłkarzyk** (sprite'y box-shadow, 3 klatki: 2 biegu + kopnięcie, generator `scripts/genPixelArt.mjs`) wbiega, kopie piłkę, piłka leci do pikselowej bramki, błysk siatki, napis „GOL!"; następnie subtitle + menu + PRESS START (~3 s). Odtwarza się przy każdym wejściu na `/` (tanio, zero gatingu, zero JS). |
| PRESS START | To AKCJA, nie dekoracja (feedback): link-przycisk do `/tabela/`, wyróżniony (żółte tło), miga do najechania. |
| Muzyka (v2) | `RetroAudio` (`'use client'`, jedyny klientowy komponent w apce) w `app/layout.tsx`. **Domyślnie WŁĄCZONA** (feedback): próba autoplay od razu; gdy przeglądarka zablokuje (standardowa polityka autoplay — dźwięk wymaga gestu), start przy pierwszym pointerdown/keydown. Przycisk ♪ w rogu wyłącza/włącza CAŁY dźwięk (muzyka + blipy). Plik `public/audio/full-time-glory.mp3` (od użytkownika, 2,9 MB), `loop`, volume 0.55. Przy nawigacji App Routera layout nie jest remontowany → muzyka gra dalej między widokami. |
| Odgłosy kliknięć (v2) | Generowane w locie przez WebAudio (fala kwadratowa 660→990 Hz, ~90 ms, obwiednia wykładnicza) — zero plików, 100% styl 8-bit. Globalny listener (capture) na `click` w `a, button, summary`. |
| Dostępność | `prefers-reduced-motion: reduce` wyłącza animacje intro (stan końcowy widoczny od razu: piłka w bramce, „GOL!"). Przycisk ♪ z `aria-pressed` i etykietą. |
| Poza zakresem | PWA, intro wideo, pomijanie intro (sekwencja trwa ~3 s — nie ma czego pomijać), dźwięki inne niż klik (np. fanfary gola). |

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
