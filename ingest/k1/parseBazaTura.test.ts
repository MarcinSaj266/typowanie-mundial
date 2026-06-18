import { describe, expect, it } from 'vitest';
import type { Sheet } from '../xlsx/workbook';
import type { Participant } from './parseGrup1';
import { parseBazaTura } from './parseBazaTura';

/** Buduje atrapę arkusza z mapy "A1" → wartość. */
function fakeSheet(cells: Record<string, string | number>): Sheet {
  let maxRow = 0;
  for (const ref of Object.keys(cells)) {
    const row = Number(ref.match(/\d+/)![0]);
    if (row > maxRow) maxRow = row;
  }
  return { cell: (ref) => cells[ref], maxRow };
}

/** Składa wiersze płaskiej bazy (od wiersza 2) w mapę komórek; wiersz 1 = nagłówek. */
function bazaSheet(
  rows: Array<{ player: string; match: number; k1: string; k2: string; w1?: number; w2?: number }>,
): Sheet {
  const cells: Record<string, string | number> = {
    A1: 'lp', B1: 'nr', C1: 'uczestnik', D1: 'mecz', E1: 'kraj1', F1: 'kraj2', G1: 'w1', H1: 'w2',
  };
  rows.forEach((row, i) => {
    const r = i + 2;
    cells[`C${r}`] = row.player;
    cells[`D${r}`] = row.match;
    cells[`E${r}`] = row.k1;
    cells[`F${r}`] = row.k2;
    if (row.w1 !== undefined) cells[`G${r}`] = row.w1;
    if (row.w2 !== undefined) cells[`H${r}`] = row.w2;
  });
  return fakeSheet(cells);
}

const ROSTER: Participant[] = [
  { id: 'Ala', group: 'A' },
  { id: 'Bob', group: 'A' },
];

describe('parseBazaTura', () => {
  it('buduje fixtures z kraj1/kraj2 i typy z w1/w2', () => {
    const sheet = bazaSheet([
      { player: 'Ala', match: 1, k1: 'Polska', k2: 'Niemcy', w1: 2, w2: 1 },
      { player: 'Ala', match: 2, k1: 'Brazylia', k2: 'Haiti', w1: 3, w2: 0 },
      { player: 'Bob', match: 1, k1: 'Polska', k2: 'Niemcy', w1: 1, w2: 1 },
      { player: 'Bob', match: 2, k1: 'Brazylia', k2: 'Haiti', w1: 0, w2: 0 },
    ]);
    const out = parseBazaTura(sheet, { turn: 2, roster: ROSTER });
    expect(out.turn).toBe(2);
    expect(out.fixtures).toEqual([
      { no: 1, home: 'Polska', away: 'Niemcy', kickoff: '' },
      { no: 2, home: 'Brazylia', away: 'Haiti', kickoff: '' },
    ]);
    expect(out.predictions).toEqual({
      Ala: { 1: { home: 2, away: 1 }, 2: { home: 3, away: 0 } },
      Bob: { 1: { home: 1, away: 1 }, 2: { home: 0, away: 0 } },
    });
  });

  it('pomija puste typy (brak w1 lub w2) — gracz nie punktuje za ten mecz', () => {
    const sheet = bazaSheet([
      { player: 'Ala', match: 1, k1: 'Polska', k2: 'Niemcy', w1: 2, w2: 1 },
      { player: 'Bob', match: 1, k1: 'Polska', k2: 'Niemcy' }, // brak typu
    ]);
    const out = parseBazaTura(sheet, { turn: 2, roster: ROSTER });
    expect(out.predictions.Ala[1]).toEqual({ home: 2, away: 1 });
    expect(out.predictions.Bob).toBeUndefined();
  });

  it('stosuje alias nicków (pisownia bazy → roster)', () => {
    const sheet = bazaSheet([
      { player: 'AlaX', match: 1, k1: 'Polska', k2: 'Niemcy', w1: 2, w2: 1 },
      { player: 'Bob', match: 1, k1: 'Polska', k2: 'Niemcy', w1: 0, w2: 0 },
    ]);
    const out = parseBazaTura(sheet, { turn: 2, roster: ROSTER, nickAlias: { AlaX: 'Ala' } });
    expect(out.predictions.Ala[1]).toEqual({ home: 2, away: 1 });
    expect(out.predictions.AlaX).toBeUndefined();
  });

  it('normalizuje nazwy drużyn przez teamAlias', () => {
    const sheet = bazaSheet([
      { player: 'Ala', match: 1, k1: 'Wybrzeże Kości Słon.', k2: 'Niemcy', w1: 1, w2: 0 },
      { player: 'Bob', match: 1, k1: 'Wybrzeże Kości Słon.', k2: 'Niemcy', w1: 0, w2: 0 },
    ]);
    const out = parseBazaTura(sheet, {
      turn: 2,
      roster: ROSTER,
      teamAlias: { 'Wybrzeże Kości Słon.': 'Wybrzeże Koś. Słon.' },
    });
    expect(out.fixtures[0]).toEqual({ no: 1, home: 'Wybrzeże Koś. Słon.', away: 'Niemcy', kickoff: '' });
  });

  it('wstrzykuje kickoffy po numerze meczu', () => {
    const sheet = bazaSheet([
      { player: 'Ala', match: 1, k1: 'Polska', k2: 'Niemcy', w1: 2, w2: 1 },
      { player: 'Bob', match: 1, k1: 'Polska', k2: 'Niemcy', w1: 0, w2: 0 },
    ]);
    const out = parseBazaTura(sheet, {
      turn: 2,
      roster: ROSTER,
      kickoffs: { 1: 'czwartek, 18 cze godz. 21.00' },
    });
    expect(out.fixtures[0].kickoff).toBe('czwartek, 18 cze godz. 21.00');
  });

  it('rzuca, gdy w bazie jest uczestnik spoza rosteru', () => {
    const sheet = bazaSheet([
      { player: 'Ala', match: 1, k1: 'Polska', k2: 'Niemcy', w1: 2, w2: 1 },
      { player: 'Bob', match: 1, k1: 'Polska', k2: 'Niemcy', w1: 0, w2: 0 },
      { player: 'Czesiek', match: 1, k1: 'Polska', k2: 'Niemcy', w1: 1, w2: 1 },
    ]);
    expect(() => parseBazaTura(sheet, { turn: 2, roster: ROSTER })).toThrow(/Czesiek/);
  });

  it('rzuca, gdy gracz z rosteru w ogóle nie występuje w bazie', () => {
    const sheet = bazaSheet([
      { player: 'Ala', match: 1, k1: 'Polska', k2: 'Niemcy', w1: 2, w2: 1 },
    ]);
    expect(() => parseBazaTura(sheet, { turn: 2, roster: ROSTER })).toThrow(/Bob/);
  });

  it('rzuca, gdy ten sam numer meczu ma różne drużyny', () => {
    const sheet = bazaSheet([
      { player: 'Ala', match: 1, k1: 'Polska', k2: 'Niemcy', w1: 2, w2: 1 },
      { player: 'Bob', match: 1, k1: 'Polska', k2: 'Francja', w1: 0, w2: 0 },
    ]);
    expect(() => parseBazaTura(sheet, { turn: 2, roster: ROSTER })).toThrow(/mecz 1/);
  });
});
