# Render MVP — pierwsza widoczna wersja aplikacji (design)

Data: 2026-06-12
Status: zaakceptowany w brainstormingu (sekcje 1–3 potwierdzone przez użytkownika)

## Cel

Pierwsza publiczna wersja aplikacji: uczestnicy konkursu dostają link i widzą na żywo
tabele oraz wyniki, w pełnej stylistyce retro 16-bit (Kick Off 3 / Dino Dini's Goal).
Logika i dane już istnieją (`engine/`, `ingest/`, `compute/`); ten etap to render.

## Decyzje z brainstormingu

| Decyzja | Wybór |
|---|---|
| Zakres widoków MVP | tabela ogólna, grupy A–H, mecze (wyniki + typy), profil uczestnika |
| Kierunek wizualny | pełny retro 16-bit od razu (wariant B makiety) |
| Intro i dźwięk | POZA zakresem MVP — następny etap |
| Nawigacja | menu główne jak w grze (ekran tytułowy), każdy widok osobny „ekran" |
| Architektura | Next.js App Router, static export (`output: 'export'`), Vercel |

## 1. Dane: rozszerzenie `public/data/results.json`

Widoki „Mecze" i „Profil" potrzebują szczegółów per mecz. `buildResults` dostaje nową
sekcję `turns`; `general` i `groups` bez zmian.

```jsonc
{
  "generatedAt": "...",
  "general": [ /* jak dotychczas */ ],
  "groups":  { /* jak dotychczas */ },
  "turns": [
    {
      "turn": 1,
      "matches": [
        {
          "no": 1, "home": "Meksyk", "away": "RPA",
          "kickoff": "czwartek, 11 cze godz.21.00",
          "result": { "home": 2, "away": 0 },          // null = mecz nierozegrany
          "predictions": {
            "Talvik": { "pick": { "home": 2, "away": 0 }, "points": 5 }
            // ... wszyscy z rosteru; pick: null = brak typu; points: null = nierozegrany
          }
        }
      ]
    }
  ]
}
```

- Punkty per mecz liczy istniejący `scoreMatchK1` — zero nowej logiki punktacji.
- Widok „Mecze" czyta `turns[].matches[]`; „Profil" filtruje te same dane po
  `participantId`. Jeden plik, zero duplikacji.
- Rozmiar (~70 KB/turę) bez znaczenia: przy static export JSON jest zużywany w buildzie,
  do przeglądarki idą gotowe HTML-e.
- Implementacja w `compute/` w TDD; `ResultsJson` w `compute/types.ts` rośnie o `turns`.

## 2. Struktura aplikacji Next.js

```
app/
  layout.tsx          ← wspólna rama: font, kolory, metadane
  page.tsx            ← MENU GŁÓWNE (ekran tytułowy jak w grze)
  tabela/page.tsx     ← tabela ogólna (56 osób)
  grupy/page.tsx      ← 8 tabel grup A–H na jednej stronie (kotwice #A…#H)
  mecze/page.tsx      ← tura 1: lista meczów; mecz rozwija listę typów z punktami
  gracz/[id]/page.tsx ← profil: typy mecz po meczu, punkty, pozycje
components/
  ScreenFrame.tsx     ← żółta ramka + czarny pasek tytułu + przycisk „◀ MENU"
  RetroTable.tsx      ← tabela retro (wspólna dla ogólnej i grup)
  MatchCard.tsx       ← mecz: wynik + rozwijane typy ('use client')
```

- Komponenty serwerowe renderowane w buildzie; dane z `public/data/results.json`
  czytane przez `fs` w czasie builda. Jedyny klientowy JS: rozwijanie typów w `MatchCard`.
- 56 profili przez `generateStaticParams` z rosteru → statyczne URL-e `/gracz/<id>/`.
  ID w URL-u = `participantId` z rosteru; polskie znaki (np. `Sokółka`) Next koduje
  procentowo — bez osobnego slugowania, dopóki build i nawigacja działają.
- Nazwiska klikalne wszędzie → profil gracza.
- Workflow aktualizacji bez zmian: wynik → `npm run build:results` → push → Vercel.
- Granice modułów: `app/` tylko czyta JSON, nie zna silnika ani Excela.

## 3. Wizual

- Font **Press Start 2P** (latin-ext, polskie znaki), hostowany lokalnie w repo.
- Paleta: czerń `#000` (tła, paski tytułów), murawa `#1b5e20`, żółty `#ffd600`
  (ramki, nagłówki), neonowa zieleń `#76ff03` (punkty, wyróżnienia), biel (treść).
- Żółte grube ramki, kreskowane separatory wierszy, ★ w tytułach — wg makiety
  zaakceptowanej w brainstormingu (wariant B: czarny pasek tytułu na murawie w żółtej ramce).
- **Mobile-first**: na telefonie kolumny kluczowe (poz., gracz, pkt, %), pełny zestaw
  (grI/II/III, 3/4/5) od szerokości tabletu.
- Czysty CSS (globalny arkusz / CSS modules), bez Tailwinda.

## 4. Obsługa braków danych

- Brak typu uczestnika na mecz → „—", `points: null`.
- Mecz bez wyniku → „–:–", typy widoczne, punkty puste.
- Tury 2/3 jeszcze nieopublikowane → `turns` zawiera tylko turę 1; UI nie pokazuje
  pustych tur.

## 5. Testy i jakość

- TDD dla rozszerzenia `buildResults` (sekcja `turns`): zgodność punktów z
  `scoreMatchK1`, `null` dla nierozegranych, spójność sum z tabelami.
- `npm run build` (static export) jako bramka błędów typów/danych.
- Szybki test e2e-smoke: wygenerowany HTML tabeli zawiera lidera z `results.json`.

## 6. Deploy

- Vercel, preset Next.js, auto-deploy z gałęzi `master` (repo już na GitHubie).

## Poza zakresem MVP (następne etapy)

- Intro (ekran tytułowy animowany), muzyka (`muzyczka do aplikacji/`), efekty dźwiękowe.
- PWA/manifest.
- Walidacja end-to-end vs Excel organizatora (`r1`/`tab grup`) — gdy organizator
  udostępni zaktualizowany master z realnymi wynikami.
- Konkurs 2, faza pucharowa.
