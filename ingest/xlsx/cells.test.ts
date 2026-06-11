import { describe, it, expect } from 'vitest';
import { colToIndex, indexToCol, parseRef } from './cells';

describe('cells', () => {
  it('colToIndex liczy 1-based kolumny', () => {
    expect(colToIndex('A')).toBe(1);
    expect(colToIndex('Z')).toBe(26);
    expect(colToIndex('AA')).toBe(27);
    expect(colToIndex('AK')).toBe(37);
  });

  it('indexToCol jest odwrotnoscia colToIndex', () => {
    expect(indexToCol(1)).toBe('A');
    expect(indexToCol(26)).toBe('Z');
    expect(indexToCol(27)).toBe('AA');
    expect(indexToCol(37)).toBe('AK');
  });

  it('parseRef rozbija adres na kolumne i wiersz', () => {
    expect(parseRef('E6')).toEqual({ col: 'E', row: 6 });
    expect(parseRef('AK747')).toEqual({ col: 'AK', row: 747 });
  });

  it('parseRef rzuca przy zlym adresie', () => {
    expect(() => parseRef('6E')).toThrow();
  });
});
