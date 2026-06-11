import { describe, it, expect } from 'vitest';
import { assertUniqueIds, assertCounts, type Participant, type Fixture, type Group } from './parseGrup1';

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
