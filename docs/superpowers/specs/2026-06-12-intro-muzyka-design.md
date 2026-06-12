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
| Sekwencja intro (v3, feedback użytkownika 2026-06-12) | Czysty CSS na `/`: tytuł wpada z góry (bounce), pikselowa piłka (box-shadow art) turla się na środek, subtitle + menu + PRESS START pojawiają się sekwencyjnie (~2 s). Odtwarza się przy każdym wejściu na `/`. UWAGA HISTORYCZNA: wariant v2 ze scenką piłkarzyka strzelającego gola został WYCOFANY na życzenie użytkownika („turlająca piłka była lepsza"); v2 wprowadził też regresję — klasa `.frame` klatek sprite'a kolidowała z `.frame` ramki `ScreenFrame` i rozsypała wszystkie widoki. Lekcja: nowe klasy CSS prefiksować kontekstem (np. `intro-`), sprawdzać kolizje greparem. |
| PRESS START | Przycisk (`components/PressStart.tsx`, klientowy): kliknięcie turla piłeczkę od nowa (restart animacji CSS przez `style.animation='none'` + reflow), żółte tło, miga do najechania. |
| Muzyka (v2) | `RetroAudio` (`'use client'`, jedyny klientowy komponent w apce) w `app/layout.tsx`. **Domyślnie WŁĄCZONA** (feedback): próba autoplay od razu; gdy przeglądarka zablokuje (standardowa polityka autoplay — dźwięk wymaga gestu), start przy pierwszym pointerdown/keydown. Przycisk ♪ w rogu wyłącza/włącza CAŁY dźwięk (muzyka + blipy). Plik `public/audio/full-time-glory.mp3` (od użytkownika, 2,9 MB), `loop`, volume 0.55. Przy nawigacji App Routera layout nie jest remontowany → muzyka gra dalej między widokami. |
| Odgłosy kliknięć (v3) | Generowane w locie przez WebAudio (fala kwadratowa 660→990 Hz, ~90 ms, obwiednia wykładnicza) — zero plików, 100% styl 8-bit. Globalny listener (capture) na `click` w `a, button, summary`. **Grają zawsze, niezależnie od stanu muzyki** (decyzja użytkownika 2026-06-12): przycisk ♪ steruje wyłącznie muzyką w tle. |
| Stopka | „Designed by MarcinS" w `app/layout.tsx` (na każdej stronie), wyśrodkowana, drobna, z prawym marginesem, by nie wchodzić pod przycisk ♪. |
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
