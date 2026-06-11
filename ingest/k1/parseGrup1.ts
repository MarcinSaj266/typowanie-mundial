import type { Score } from '../../engine/types';
import type { Sheet } from '../xlsx/workbook';

export type Group = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export interface Participant {
  id: string;
  group: Group;
}

export interface Fixture {
  no: number;
  home: string;
  away: string;
  kickoff: string;
}

export interface ParsedTurn {
  participants: Participant[];
  fixtures: Fixture[];
  /** id uczestnika → (numer meczu → typ). Brak typu = brak klucza. */
  predictions: Record<string, Record<number, Score>>;
}

const LEFT_GROUPS: Group[] = ['A', 'B', 'C', 'D'];
const RIGHT_GROUPS: Group[] = ['E', 'F', 'G', 'H'];
const PER_GROUP = 7;
const BLOCK_ROWS = LEFT_GROUPS.length * PER_GROUP; // 28

/** Rzuca, gdy w liście id powtarza się jakikolwiek wpis. */
export function assertUniqueIds(ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Zduplikowany uczestnik: ${id}`);
    seen.add(id);
  }
}

/** Rzuca, gdy nie jest dokładnie 56 osób / 8 grup po 7 / 24 mecze. */
export function assertCounts(participants: Participant[], fixtures: Fixture[]): void {
  if (participants.length !== 56) {
    throw new Error(`Oczekiwano 56 uczestnikow, jest ${participants.length}`);
  }
  if (fixtures.length !== 24) {
    throw new Error(`Oczekiwano 24 meczow, jest ${fixtures.length}`);
  }
  for (const g of [...LEFT_GROUPS, ...RIGHT_GROUPS]) {
    const n = participants.filter((p) => p.group === g).length;
    if (n !== PER_GROUP) throw new Error(`Grupa ${g}: oczekiwano ${PER_GROUP} osob, jest ${n}`);
  }
}
