import { describe, it, expect } from 'vitest';
import {
  assertUniqueIds,
  assertCounts,
  assertBlockMatchesRoster,
  type Participant,
  type Fixture,
  type Group,
} from './parseGrup1';

const GROUPS: Group[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const mkGroup = (n: number, group: Group): Participant[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${group}${i}`, group }));
const fullRoster = (): Participant[] => GROUPS.flatMap((g) => mkGroup(7, g));
const fixtures24: Fixture[] = Array.from({ length: 24 }, (_, i) => ({
  no: i + 1, home: 'x', away: 'y', kickoff: '',
}));

describe('assertUniqueIds', () => {
  it('przepuszcza unikalne', () => {
    expect(() => assertUniqueIds(['a', 'b', 'c'])).not.toThrow();
  });
  it('rzuca przy duplikacie', () => {
    expect(() => assertUniqueIds(['a', 'b', 'a'])).toThrow(/Zduplikowany/);
  });
});

describe('assertCounts', () => {
  it('przepuszcza 56 osob / 8×7 / 24 mecze', () => {
    expect(() => assertCounts(fullRoster(), fixtures24)).not.toThrow();
  });
  it('rzuca przy zlej liczbie uczestnikow', () => {
    expect(() => assertCounts(fullRoster().slice(0, 55), fixtures24)).toThrow(/56/);
  });
  it('rzuca przy zlej liczbie meczow', () => {
    expect(() => assertCounts(fullRoster(), fixtures24.slice(0, 23))).toThrow(/24/);
  });
});

describe('assertBlockMatchesRoster', () => {
  const roster: Participant[] = [
    { id: 'a', group: 'A' },
    { id: 'b', group: 'E' },
  ];
  const r = (name: string) => ({ name, score: null, label: '' });

  it('przepuszcza blok zgodny z rosterem', () => {
    expect(() => assertBlockMatchesRoster(roster, [r('a')], [r('b')], 2)).not.toThrow();
  });
  it('rzuca przy przesunieciu kolejnosci', () => {
    expect(() => assertBlockMatchesRoster(roster, [r('x')], [r('b')], 2)).toThrow(/pozycji 0/);
  });
  it('rzuca przy zlej liczbie osob w bloku', () => {
    expect(() => assertBlockMatchesRoster(roster, [r('a')], [], 2)).toThrow(/oczekiwano 2/);
  });
});

import { readFileSync } from 'node:fs';
import { openXlsx } from '../xlsx/workbook';
import { parseGrup1 } from './parseGrup1';

const MASTER = 'konkurs 2026.06.12.xlsx';
const parsed = parseGrup1(openXlsx(readFileSync(MASTER)).sheet('grup-1'));

describe('parseGrup1 (realny grup-1)', () => {
  it('56 uczestnikow, po 7 w kazdej grupie A–H', () => {
    expect(parsed.participants).toHaveLength(56);
    for (const g of GROUPS) {
      expect(parsed.participants.filter((p) => p.group === g)).toHaveLength(7);
    }
  });

  it('przydzial do grup wg pozycji', () => {
    expect(parsed.participants.find((p) => p.id === 'Dario')?.group).toBe('A');
    expect(parsed.participants.find((p) => p.id === 'Prozped')?.group).toBe('B');
    expect(parsed.participants.find((p) => p.id === 'Talvik')?.group).toBe('E');
  });

  it('24 mecze; pierwszy = Meksyk vs RPA', () => {
    expect(parsed.fixtures).toHaveLength(24);
    expect(parsed.fixtures[0]).toMatchObject({ no: 1, home: 'Meksyk', away: 'RPA' });
    expect(parsed.fixtures[0].kickoff).toContain('11 cze');
  });

  it('typy z meczu 1 zgadzaja sie ze zrodlem', () => {
    expect(parsed.predictions['Dario'][1]).toEqual({ home: 1, away: 0 });
    expect(parsed.predictions['Wojtek'][1]).toEqual({ home: 2, away: 1 });
    expect(parsed.predictions['PiotreG'][1]).toEqual({ home: 0, away: 0 });
    expect(parsed.predictions['Talvik'][1]).toEqual({ home: 2, away: 0 });
    expect(parsed.predictions['MarekS'][1]).toEqual({ home: 2, away: 1 });
  });

  it('typy z meczu 2 (kolejny blok) trafiaja do wlasciwych osob', () => {
    expect(parsed.fixtures[1]).toMatchObject({ no: 2, home: 'Korea Płd.', away: 'Czechy' });
    expect(parsed.predictions['Dario'][2]).toEqual({ home: 1, away: 1 });
    expect(parsed.predictions['Wojtek'][2]).toEqual({ home: 1, away: 1 });
    expect(parsed.predictions['Talvik'][2]).toEqual({ home: 2, away: 1 });
  });
});
