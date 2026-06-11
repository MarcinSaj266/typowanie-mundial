import { describe, it, expect } from 'vitest';
import { aggregateTurn } from './aggregate';

describe('aggregateTurn', () => {
  it('liczy sumę, kategorie i %', () => {
    const turn = aggregateTurn([
      { prediction: { home: 2, away: 1 }, result: { home: 2, away: 1 } }, // 5
      { prediction: { home: 2, away: 1 }, result: { home: 3, away: 2 } }, // 4
      { prediction: { home: 2, away: 0 }, result: { home: 1, away: 0 } }, // 3
      { prediction: { home: 2, away: 1 }, result: { home: 0, away: 1 } }, // 0
    ]);
    expect(turn.points).toBe(12); // 5+4+3+0
    expect(turn.count5).toBe(1);
    expect(turn.count4).toBe(1);
    expect(turn.count3).toBe(1);
    expect(turn.count0).toBe(1);
    expect(turn.played).toBe(4);
    expect(turn.hitRate).toBeCloseTo(3 / 4);
  });

  it('pomija mecze nierozegrane (result === null)', () => {
    const turn = aggregateTurn([
      { prediction: { home: 1, away: 0 }, result: { home: 1, away: 0 } }, // 5
      { prediction: { home: 1, away: 0 }, result: null },                 // pominięty
    ]);
    expect(turn.played).toBe(1);
    expect(turn.points).toBe(5);
    expect(turn.hitRate).toBe(1);
  });

  it('brak typu na rozegranym meczu liczy 0 pkt', () => {
    const turn = aggregateTurn([
      { prediction: null, result: { home: 1, away: 0 } },
    ]);
    expect(turn.played).toBe(1);
    expect(turn.points).toBe(0);
    expect(turn.count0).toBe(1);
    expect(turn.hitRate).toBe(0);
  });

  it('pusta tura daje zerowy wynik i hitRate=0', () => {
    const turn = aggregateTurn([]);
    expect(turn.played).toBe(0);
    expect(turn.points).toBe(0);
    expect(turn.hitRate).toBe(0);
  });
});
