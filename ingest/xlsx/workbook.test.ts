import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { openXlsx } from './workbook';

const MASTER = 'konkurs 2026.06.11.xlsx';

describe('openXlsx', () => {
  it('wymienia arkusze mastera', () => {
    const wb = openXlsx(readFileSync(MASTER));
    expect(wb.sheetNames).toContain('grup-1');
    expect(wb.sheetNames).toContain('tab grup');
  });

  it('czyta stringi i liczby z grup-1', () => {
    const s = openXlsx(readFileSync(MASTER)).sheet('grup-1');
    expect(s.cell('E6')).toBe('Dario');   // string (sharedString)
    expect(s.cell('F6')).toBe(1);          // liczba
    expect(s.cell('G6')).toBe(0);
    expect(s.cell('K6')).toBe('Talvik');
    expect(s.cell('C6')).toBe('Grupa A');  // etykieta grupy
  });

  it('puste komorki to undefined; maxRow sensowny', () => {
    const s = openXlsx(readFileSync(MASTER)).sheet('grup-1');
    expect(s.cell('A1')).toBeUndefined();
    expect(s.maxRow).toBeGreaterThanOrEqual(718);
  });

  it('rzuca przy nieznanym arkuszu', () => {
    const wb = openXlsx(readFileSync(MASTER));
    expect(() => wb.sheet('nie ma takiego')).toThrow();
  });
});
