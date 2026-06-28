import { describe, it, expect } from 'vitest';
import { aggregatePuchar, scorePucharMatch } from './aggregatePuchar';

describe('scorePucharMatch', () => {
  it('dokładny wynik (nie-remis) = 5×2 = 10', () => {
    expect(scorePucharMatch({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(10);
  });
  it('różnica bramek = 4×2 = 8', () => {
    expect(scorePucharMatch({ home: 3, away: 1 }, { home: 2, away: 0 })).toBe(8);
  });
  it('samo rozstrzygnięcie = 3×2 = 6', () => {
    expect(scorePucharMatch({ home: 3, away: 0 }, { home: 1, away: 0 })).toBe(6);
  });
  it('pudło = 0', () => {
    expect(scorePucharMatch({ home: 2, away: 0 }, { home: 0, away: 1 })).toBe(0);
  });
  it('remis dokładny + trafione karne = (5+1)×2 = 12', () => {
    expect(scorePucharMatch({ home: 1, away: 1, pk: 'home' }, { home: 1, away: 1, pk: 'home' })).toBe(12);
  });
  it('remis dokładny + błędne karne = (5−1)×2 = 8', () => {
    expect(scorePucharMatch({ home: 1, away: 1, pk: 'away' }, { home: 1, away: 1, pk: 'home' })).toBe(8);
  });
  it('remis (zła dokładność) + trafione karne = (4+1)×2 = 10', () => {
    expect(scorePucharMatch({ home: 0, away: 0, pk: 'home' }, { home: 1, away: 1, pk: 'home' })).toBe(10);
  });
  it('remis bez krzyżyka uczestnika = −1 → (5−1)×2 = 8', () => {
    expect(scorePucharMatch({ home: 1, away: 1 }, { home: 1, away: 1, pk: 'home' })).toBe(8);
  });
  it('remis faktyczny bez result.pk → null (brak danych o karnych)', () => {
    expect(scorePucharMatch({ home: 1, away: 1, pk: 'home' }, { home: 1, away: 1 })).toBeNull();
  });
});

describe('aggregatePuchar', () => {
  it('sumuje punkty i kategorie; pomija mecze bez typu/wyniku', () => {
    const agg = aggregatePuchar([
      { prediction: { home: 2, away: 1 }, result: { home: 2, away: 1 } }, // 10
      { prediction: { home: 1, away: 1, pk: 'home' }, result: { home: 1, away: 1, pk: 'home' } }, // 12
      { prediction: { home: 3, away: 0 }, result: { home: 1, away: 0 } }, // 6
      { prediction: { home: 2, away: 0 }, result: { home: 0, away: 1 } }, // 0
      { prediction: null, result: { home: 1, away: 0 } }, // brak typu — nie liczony
      { prediction: { home: 1, away: 0 }, result: null }, // nierozegrany — nie liczony
    ]);
    expect(agg).toEqual({ puch: 28, count6: 1, count8: 0, count10: 1, count12: 1, played: 4 });
  });

  it('remis faktyczny bez result.pk nie jest liczony (played nie rośnie)', () => {
    const agg = aggregatePuchar([
      { prediction: { home: 1, away: 1, pk: 'home' }, result: { home: 1, away: 1 } },
    ]);
    expect(agg).toEqual({ puch: 0, count6: 0, count8: 0, count10: 0, count12: 0, played: 0 });
  });
});
