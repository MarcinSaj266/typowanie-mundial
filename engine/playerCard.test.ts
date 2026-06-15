import { describe, expect, it } from 'vitest';
import { playerCard } from './playerCard';
import type { PlayerCardInput, Score } from './types';

const s = (home: number, away: number): Score => ({ home, away });

/** Mecz: typ gracza + wynik; allPicks domyślnie = sam gracz (nadpisywane w testach ZGODNOŚCI). */
function m(pick: Score | null, result: Score | null, allPicks?: (Score | null)[]) {
  return { pick, result, allPicks: allPicks ?? [pick] };
}

describe('playerCard — hero (evergreen) i WYNIKI', () => {
  it('hero bierze totalPoints/generalPos z wejścia; WYNIKI liczy z meczów grupowych', () => {
    const input: PlayerCardInput = {
      group: 'A',
      groupPos: 3,
      generalPos: 5,
      totalPoints: 20, // np. zawiera już bonus — celowo ≠ suma meczów grupowych (12)
      turns: [
        {
          turn: 1,
          matches: [
            m(s(2, 1), s(2, 1)), // 5
            m(s(1, 0), s(3, 0)), // 3
            m(s(0, 0), s(1, 0)), // 0
            m(s(2, 0), s(3, 1)), // 4
            m(s(1, 1), null),    // nierozegrany — pomijany
          ],
        },
      ],
    };
    const c = playerCard(input);
    expect(c.group).toBe('A');
    expect(c.groupPos).toBe(3);
    expect(c.generalPos).toBe(5);
    expect(c.points).toBe(20); // hero = totalPoints, NIE suma meczów
    expect(c.dokladne).toBe(1);
    expect(c.celnoscPct).toBe(75); // 3 trafienia / 4 rozegrane
    expect(c.srPktMecz).toBeCloseTo(3.0, 5); // dorobek grupowy 12 / 4 rozegrane
  });

  it('pusta historia → zera, hero z wejścia, bez wyjątków', () => {
    const c = playerCard({ group: 'B', groupPos: 7, generalPos: 50, totalPoints: 0, turns: [] });
    expect(c.points).toBe(0);
    expect(c.generalPos).toBe(50);
    expect(c.celnoscPct).toBe(0);
    expect(c.srPktMecz).toBe(0);
    expect(c.dokladne).toBe(0);
  });
});

describe('playerCard — STYL GRY cz. 1', () => {
  const base = { group: 'C', groupPos: 1, generalPos: 1, totalPoints: 0 };

  it('odwaga, ofensywa, seria i ulubiony wynik', () => {
    const c = playerCard({
      ...base,
      turns: [
        {
          turn: 1,
          matches: [
            m(s(2, 1), s(2, 1)), // odważny, trafiony → seria 1
            m(s(0, 1), s(0, 1)), // bezpieczny 0:1, trafiony → seria 2
            m(s(1, 1), s(2, 0)), // bezpieczny 1:1, pudło → seria reset
            m(s(2, 1), s(0, 3)), // odważny 2:1 (powtórka), pudło
          ],
        },
      ],
    });
    expect(c.odwagaPct).toBe(50); // 2 z 4 typów poza {1:0,0:1,1:1,0:0}
    expect(c.ofensywa).toBeCloseTo(2.3, 5); // (3+1+2+3)/4 = 2.25 → round1 = 2.3
    expect(c.seria).toBe(2); // mecze 1–2
    expect(c.ulubionyWynik).toBe('2:1'); // 2 razy
  });

  it('ulubiony wynik — remis częstości rozstrzyga niższa suma bramek', () => {
    const c = playerCard({
      ...base,
      turns: [{ turn: 1, matches: [m(s(3, 0), s(0, 0)), m(s(1, 0), s(0, 0))] }],
    });
    expect(c.ulubionyWynik).toBe('1:0'); // obie po 1 → niższa suma bramek
  });
});

describe('playerCard — STYL GRY cz. 2', () => {
  const base = { group: 'D', generalPos: 1, totalPoints: 0 };

  it('nos do remisów, pewniak, zgodność i osobowość', () => {
    const c = playerCard({
      ...base,
      groupPos: 2,
      turns: [
        {
          turn: 1,
          matches: [
            m(s(1, 1), s(1, 1), [s(1, 1), s(1, 1), s(1, 1), s(1, 1)]), // remis trafiony (5), tłum 100%
            m(s(0, 0), s(2, 1), [s(0, 0), s(3, 0), s(2, 1), s(1, 0)]),  // remis pudło, tłum 25%
            m(s(2, 0), s(2, 0), [s(2, 0), s(0, 1), s(0, 1), s(0, 1)]),  // trafiony (5), tłum 25%
          ],
        },
      ],
    });
    expect(c.nosRemisowPct).toBe(50); // wytypowane remisy 2, trafione 1
    expect(c.nosRemisowNd).toBe(false);
    expect(c.pewniak).toBeCloseTo(5.0, 5); // trafione: 5 i 5
    expect(c.pewniakNd).toBe(false);
    expect(c.zgodnoscPct).toBe(50); // (100+25+25)/3
    expect(c.osobowosc).toBe('NEUTRALNY'); // 33 ≤ 50 < 60
  });

  it('brak remisów → Nd; brak trafień → Nd; INDYWIDUALISTA przy <33%', () => {
    const c = playerCard({
      ...base,
      groupPos: 7,
      turns: [
        {
          turn: 1,
          matches: [m(s(4, 0), s(0, 0), [s(4, 0), s(1, 0), s(1, 0), s(0, 1)])], // unikat, pudło, brak remisu
        },
      ],
    });
    expect(c.nosRemisowNd).toBe(true);
    expect(c.nosRemisowPct).toBe(0);
    expect(c.pewniakNd).toBe(true);
    expect(c.pewniak).toBe(0);
    expect(c.zgodnoscPct).toBe(25);
    expect(c.osobowosc).toBe('INDYWIDUALISTA');
  });

  it('OWCZY PĘD przy ≥60% zgodności', () => {
    const c = playerCard({
      ...base,
      groupPos: 1,
      turns: [{ turn: 1, matches: [m(s(1, 0), s(1, 0), [s(1, 0), s(1, 0), s(1, 0)])] }],
    });
    expect(c.zgodnoscPct).toBe(100);
    expect(c.osobowosc).toBe('OWCZY PĘD');
  });
});

describe('playerCard — PO TURZE 2', () => {
  const base = { group: 'E', generalPos: 1, totalPoints: 0 };

  it('1 tura z wynikami → sekcja nieaktywna', () => {
    const c = playerCard({
      ...base,
      groupPos: 4,
      turns: [
        { turn: 1, matches: [m(s(1, 0), s(1, 0))] },
        { turn: 2, matches: [m(s(2, 2), null)] }, // brak wyników
      ],
    });
    expect(c.poTurze2Aktywne).toBe(false);
    expect(c.forma).toBeNull();
    expect(c.najlepszaTura).toBeNull();
  });

  it('≥2 tury z wynikami → forma i najlepsza tura', () => {
    const c = playerCard({
      ...base,
      groupPos: 1,
      turns: [
        { turn: 1, matches: [m(s(1, 0), s(1, 0))] }, // 5 pkt
        { turn: 2, matches: [m(s(0, 0), s(1, 0))] }, // 0 pkt → spadek
        { turn: 3, matches: [m(s(2, 1), s(2, 1)), m(s(1, 1), s(1, 1))] }, // 10 pkt → wzrost
      ],
    });
    expect(c.poTurze2Aktywne).toBe(true);
    expect(c.forma).toBe('UP'); // ostatnia (10) > poprzednia (0)
    expect(c.najlepszaTura).toEqual({ turn: 3, points: 10 });
  });

  it('forma FLAT gdy ostatnie dwie tury równe; remis najlepszej → wcześniejsza', () => {
    const c = playerCard({
      ...base,
      groupPos: 2,
      turns: [
        { turn: 1, matches: [m(s(1, 0), s(1, 0))] }, // 5
        { turn: 2, matches: [m(s(2, 1), s(2, 1))] }, // 5
      ],
    });
    expect(c.forma).toBe('FLAT');
    expect(c.najlepszaTura).toEqual({ turn: 1, points: 5 });
  });
});
