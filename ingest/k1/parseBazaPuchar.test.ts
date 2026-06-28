import { describe, it, expect, vi } from 'vitest';
import { parseBazaPuchar } from './parseBazaPuchar';
import type { Sheet } from '../xlsx/workbook';
import type { Participant } from './parseGrup1';

/** Buduje atrapę Sheet z mapy "A1" → wartość. */
function fakeSheet(cells: Record<string, string | number>): Sheet {
  const maxRow = Math.max(
    ...Object.keys(cells).map((k) => Number(k.replace(/^[A-Z]+/, ''))),
    1,
  );
  return { maxRow, cell: (ref: string) => cells[ref] } as unknown as Sheet;
}

const roster: Participant[] = [
  { id: 'AndrzejO', group: 'A' },
  { id: 'Borys', group: 'C' },
];

/** Jeden wiersz danych bazy: nick, mecz, drużyny, wynik, krzyżyki. */
function row(
  r: number,
  nick: string,
  m: number,
  home: string,
  away: string,
  w1?: number,
  w2?: number,
  h?: string,
  i?: string,
): Record<string, string | number> {
  const out: Record<string, string | number> = { [`B${r}`]: nick, [`C${r}`]: m, [`D${r}`]: home, [`E${r}`]: away };
  if (w1 !== undefined) out[`F${r}`] = w1;
  if (w2 !== undefined) out[`G${r}`] = w2;
  if (h !== undefined) out[`H${r}`] = h;
  if (i !== undefined) out[`I${r}`] = i;
  return out;
}

describe('parseBazaPuchar', () => {
  it('czyta wynik i fixtures; pomija typy częściowe (brak G)', () => {
    const sheet = fakeSheet({
      ...row(2, 'AndrzejO', 1, 'Kanada', 'RPA', 2, 1),
      ...row(3, 'AndrzejO', 2, 'Brazylia', 'Japonia', 3), // brak G → brak typu
      ...row(4, 'Borys', 1, 'Kanada', 'RPA', 0, 0, 'x'), // remis, krzyżyk home
    });
    const out = parseBazaPuchar(sheet, { round: '1/16', roster });
    expect(out.round).toBe('1/16');
    expect(out.fixtures).toEqual([
      { no: 1, home: 'Kanada', away: 'RPA', kickoff: '' },
      { no: 2, home: 'Brazylia', away: 'Japonia', kickoff: '' },
    ]);
    expect(out.predictions.AndrzejO[1]).toEqual({ home: 2, away: 1 });
    expect(out.predictions.AndrzejO[2]).toBeUndefined();
    expect(out.predictions.Borys[1]).toEqual({ home: 0, away: 0, pk: 'home' });
  });

  it('krzyżyk case-insensitive (X) na kraj2 → pk:away', () => {
    const sheet = fakeSheet(row(2, 'AndrzejO', 1, 'Kanada', 'RPA', 1, 1, undefined, 'X'));
    const out = parseBazaPuchar(sheet, { round: '1/16', roster });
    expect(out.predictions.AndrzejO[1]).toEqual({ home: 1, away: 1, pk: 'away' });
  });

  it('krzyżyk przy nie-remisie jest ignorowany (z ostrzeżeniem)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sheet = fakeSheet(row(2, 'AndrzejO', 1, 'Kanada', 'RPA', 2, 1, 'x'));
    const out = parseBazaPuchar(sheet, { round: '1/16', roster });
    expect(out.predictions.AndrzejO[1]).toEqual({ home: 2, away: 1 });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('toleruje brak typów u uczestnika (nieobecny w predictions, bez błędu)', () => {
    const sheet = fakeSheet(row(2, 'AndrzejO', 1, 'Kanada', 'RPA', 2, 1));
    const out = parseBazaPuchar(sheet, { round: '1/16', roster });
    expect(out.predictions.Borys).toBeUndefined();
  });

  it('aliasuje nick z bazy do rosteru', () => {
    const sheet = fakeSheet(row(2, 'WojtekN', 1, 'Kanada', 'RPA', 2, 1));
    const out = parseBazaPuchar(sheet, {
      round: '1/16',
      roster: [{ id: 'Wojtek', group: 'A' }],
      nickAlias: { WojtekN: 'Wojtek' },
    });
    expect(out.predictions.Wojtek[1]).toEqual({ home: 2, away: 1 });
  });

  it('rzuca dla nicka spoza rosteru', () => {
    const sheet = fakeSheet(row(2, 'Obcy', 1, 'Kanada', 'RPA', 2, 1));
    expect(() => parseBazaPuchar(sheet, { round: '1/16', roster })).toThrow(/spoza rosteru/);
  });

  it('rzuca przy niespójnej parze drużyn dla tego samego meczu', () => {
    const sheet = fakeSheet({
      ...row(2, 'AndrzejO', 1, 'Kanada', 'RPA', 2, 1),
      ...row(3, 'Borys', 1, 'Kanada', 'Meksyk', 1, 0),
    });
    expect(() => parseBazaPuchar(sheet, { round: '1/16', roster })).toThrow(/Niespójne/);
  });
});
