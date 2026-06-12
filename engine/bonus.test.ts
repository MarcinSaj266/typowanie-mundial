import { describe, it, expect } from 'vitest';
import { groupBonus } from './bonus';

/** Grupa w kolejności miejsc: indeks 0 = miejsce 1. */
const grupa = (...pts: number[]) =>
  pts.map((points, i) => ({ participantId: `g${pts.join('-')}-${i + 1}`, points }));

const named = (ids: string[], pts: number[]) =>
  ids.map((participantId, i) => ({ participantId, points: pts[i] }));

describe('groupBonus', () => {
  it('miejsca 1-3 w każdej grupie dostają 15/10/5', () => {
    const a = named(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'], [9, 8, 7, 6, 5, 4, 3]);
    const b = named(['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'], [20, 18, 16, 14, 12, 10, 8]);
    const out = groupBonus([a, b]);
    expect(out['a1']).toBe(15);
    expect(out['a2']).toBe(10);
    expect(out['a3']).toBe(5);
    expect(out['b1']).toBe(15);
    expect(out['b2']).toBe(10);
    expect(out['b3']).toBe(5);
  });

  it('w grupie o najlepszej łącznej sumie miejsca 4-7 dostają 4/3/2/1, w pozostałych nic', () => {
    const a = named(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'], [9, 8, 7, 6, 5, 4, 3]); // suma 42
    const b = named(['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'], [20, 18, 16, 14, 12, 10, 8]); // suma 98
    const out = groupBonus([a, b]);
    expect(out['b4']).toBe(4);
    expect(out['b5']).toBe(3);
    expect(out['b6']).toBe(2);
    expect(out['b7']).toBe(1);
    expect(out['a4']).toBeUndefined();
    expect(out['a7']).toBeUndefined();
  });

  it('przy remisie najlepszej sumy bonus 4-7 dostają wszystkie zremisowane grupy (jak IF(suma=MAX) w arkuszu)', () => {
    const a = named(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'], [10, 9, 8, 7, 6, 5, 4]); // suma 49
    const b = named(['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'], [4, 5, 6, 7, 8, 9, 10]); // suma 49
    const c = named(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'], [1, 1, 1, 1, 1, 1, 1]); // suma 7
    const out = groupBonus([a, b, c]);
    expect(out['a4']).toBe(4);
    expect(out['b4']).toBe(4);
    expect(out['c4']).toBeUndefined();
  });

  it('grupa krótsza niż 7 osób nie wybucha (bonus tylko dla istniejących miejsc)', () => {
    const out = groupBonus([grupa(5, 3)]);
    expect(Object.values(out)).toEqual([15, 10]);
  });

  it('puste wejście daje pusty wynik', () => {
    expect(groupBonus([])).toEqual({});
  });
});
