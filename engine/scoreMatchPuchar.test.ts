import { describe, it, expect } from 'vitest';
import { scoreMatchPuchar } from './scoreMatchPuchar';

describe('scoreMatchPuchar (punkty ×2, wynik po dogrywce jak z 90 min)', () => {
  it('rozstrzygniety mecz: rezultat/roznica/dokladny = 6/8/10', () => {
    expect(scoreMatchPuchar({ home: 2, away: 0 }, { home: 1, away: 0 })).toBe(6);
    expect(scoreMatchPuchar({ home: 2, away: 1 }, { home: 1, away: 0 })).toBe(8);
    expect(scoreMatchPuchar({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(10);
  });

  it('nietrafiony rezultat = 0', () => {
    expect(scoreMatchPuchar({ home: 0, away: 1 }, { home: 1, away: 0 })).toBe(0);
  });

  it('typ nie-remis przy remisie (karnych) = 0', () => {
    expect(
      scoreMatchPuchar(
        { home: 1, away: 0 },
        { home: 3, away: 3 },
        { zwyciezca: 'home', typ: 'home' },
      ),
    ).toBe(0);
  });

  it('dokladny remis + trafiony zwyciezca karnych: (5+1)*2 = 12', () => {
    expect(
      scoreMatchPuchar(
        { home: 3, away: 3 },
        { home: 3, away: 3 },
        { zwyciezca: 'away', typ: 'away' },
      ),
    ).toBe(12);
  });

  it('dokladny remis + nietrafiony zwyciezca karnych: (5-1)*2 = 8', () => {
    expect(
      scoreMatchPuchar(
        { home: 3, away: 3 },
        { home: 3, away: 3 },
        { zwyciezca: 'away', typ: 'home' },
      ),
    ).toBe(8);
  });

  it('remis bez dokladnego wyniku + trafione karne: (4+1)*2 = 10', () => {
    expect(
      scoreMatchPuchar(
        { home: 2, away: 2 },
        { home: 3, away: 3 },
        { zwyciezca: 'home', typ: 'home' },
      ),
    ).toBe(10);
  });

  it('remis bez dokladnego wyniku + nietrafione karne: (4-1)*2 = 6', () => {
    expect(
      scoreMatchPuchar(
        { home: 2, away: 2 },
        { home: 3, away: 3 },
        { zwyciezca: 'home', typ: 'away' },
      ),
    ).toBe(6);
  });

  it('brak krzyzyka przy typowanym remisie liczy sie jak nietrafiony (-1)', () => {
    expect(
      scoreMatchPuchar(
        { home: 3, away: 3 },
        { home: 3, away: 3 },
        { zwyciezca: 'home', typ: null },
      ),
    ).toBe(8);
  });

  it('remis w wyniku bez danych o karnych = blad danych', () => {
    expect(() => scoreMatchPuchar({ home: 1, away: 1 }, { home: 1, away: 1 })).toThrow(
      /karn/i,
    );
  });
});
