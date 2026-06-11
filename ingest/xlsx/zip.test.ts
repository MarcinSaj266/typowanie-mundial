import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { unzip } from './zip';

const MASTER = 'konkurs 2026.06.11.xlsx';

describe('unzip', () => {
  it('rozpakowuje wpisy realnego xlsx', () => {
    const entries = unzip(readFileSync(MASTER));
    expect(entries.has('xl/workbook.xml')).toBe(true);
    expect(entries.has('xl/sharedStrings.xml')).toBe(true);
  });

  it('zawartosc wpisu to poprawny XML', () => {
    const entries = unzip(readFileSync(MASTER));
    const wb = entries.get('xl/workbook.xml')!.toString('utf8');
    expect(wb.startsWith('<?xml')).toBe(true);
    expect(wb).toContain('grup-1');
  });
});
