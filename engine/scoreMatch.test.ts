import { describe, it, expect } from 'vitest';
import { scoreMatchK1 } from './scoreMatch';

describe('scoreMatchK1', () => {
  it('dokładny wynik (wygrana) = 5', () => {
    expect(scoreMatchK1({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(5);
  });

  it('dokładny wynik (remis) = 5', () => {
    expect(scoreMatchK1({ home: 1, away: 1 }, { home: 1, away: 1 })).toBe(5);
  });

  it('trafiona różnica bramek bez dokładnego wyniku (wygrana) = 4', () => {
    expect(scoreMatchK1({ home: 2, away: 1 }, { home: 3, away: 2 })).toBe(4);
  });

  it('trafiona różnica bramek na remisie = 4', () => {
    expect(scoreMatchK1({ home: 1, away: 1 }, { home: 2, away: 2 })).toBe(4);
  });

  it('trafiony rezultat bez trafionej różnicy = 3', () => {
    expect(scoreMatchK1({ home: 2, away: 0 }, { home: 1, away: 0 })).toBe(3);
  });

  it('nietrafiony rezultat = 0', () => {
    expect(scoreMatchK1({ home: 2, away: 1 }, { home: 0, away: 1 })).toBe(0);
  });

  it('typowany remis, faktyczna wygrana = 0', () => {
    expect(scoreMatchK1({ home: 1, away: 1 }, { home: 2, away: 1 })).toBe(0);
  });

  it('bezbramkowy remis trafiony co do wyniku = 5', () => {
    expect(scoreMatchK1({ home: 0, away: 0 }, { home: 0, away: 0 })).toBe(5);
  });

  it('dokładny wynik (wygrana gości) = 5', () => {
    expect(scoreMatchK1({ home: 0, away: 2 }, { home: 0, away: 2 })).toBe(5);
  });

  it('trafiona różnica bramek (wygrana gości) = 4', () => {
    expect(scoreMatchK1({ home: 0, away: 2 }, { home: 1, away: 3 })).toBe(4);
  });

  it('remis 0-0 typowany, faktyczny 1-1 (różna liczba bramek) = 4', () => {
    expect(scoreMatchK1({ home: 0, away: 0 }, { home: 1, away: 1 })).toBe(4);
  });
});
