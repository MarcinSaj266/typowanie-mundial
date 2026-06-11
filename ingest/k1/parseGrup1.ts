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

function asStr(v: string | number | undefined): string {
  return v === undefined ? '' : String(v);
}

function asNum(v: string | number | undefined): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function readScore(sheet: Sheet, homeRef: string, awayRef: string): Score | null {
  const h = asNum(sheet.cell(homeRef));
  const a = asNum(sheet.cell(awayRef));
  if (h === undefined || a === undefined) return null;
  return { home: h, away: a };
}

interface Row {
  name: string;
  score: Score | null;
  label: string;
}

/** Czyta do 28 wierszy uczestników od `start`; zwraca [lewa[], prawa[]]. */
function readBlock(sheet: Sheet, start: number): [Row[], Row[]] {
  const left: Row[] = [];
  const right: Row[] = [];
  let r = start;
  while (left.length < BLOCK_ROWS && r <= sheet.maxRow) {
    const eName = asStr(sheet.cell(`E${r}`));
    const kName = asStr(sheet.cell(`K${r}`));
    if (eName === '' && kName === '') { r++; continue; } // wiersz pod-etykiet itp.
    left.push({ name: eName, score: readScore(sheet, `F${r}`, `G${r}`), label: asStr(sheet.cell(`C${r}`)) });
    right.push({ name: kName, score: readScore(sheet, `L${r}`, `M${r}`), label: asStr(sheet.cell(`P${r}`)) });
    r++;
  }
  return [left, right];
}

/**
 * Parsuje arkusz `grup-1` (tura 1) do kanonicznego modelu: roster + grupy A–H,
 * terminarz 24 meczów oraz typy K1. Rzuca, gdy struktura nie spełnia walidacji.
 */
export function parseGrup1(sheet: Sheet): ParsedTurn {
  const fixtures: Fixture[] = [];
  const predictions: Record<string, Record<number, Score>> = {};
  let participants: Participant[] | null = null;

  const setPred = (id: string, no: number, score: Score | null) => {
    if (score === null) return;
    (predictions[id] ??= {})[no] = score;
  };

  let matchNo = 0;
  for (let row = 1; row <= sheet.maxRow; row++) {
    // Nagłówek meczu: B (data) + E (gospodarz) + K (gość) niepuste.
    if (asStr(sheet.cell(`B${row}`)) === '') continue;
    const home = asStr(sheet.cell(`E${row}`));
    const away = asStr(sheet.cell(`K${row}`));
    if (home === '' || away === '') continue;
    matchNo++;
    fixtures.push({ no: matchNo, home, away, kickoff: asStr(sheet.cell(`B${row}`)) });

    const [left, right] = readBlock(sheet, row + 1);

    if (participants === null) {
      participants = [];
      const build = (rows: Row[], groups: Group[]) => {
        rows.forEach((p, i) => {
          const group = groups[Math.floor(i / PER_GROUP)];
          if (i % PER_GROUP === 0 && p.label !== `Grupa ${group}`) {
            throw new Error(`Mecz ${matchNo}: etykieta "${p.label}" != "Grupa ${group}"`);
          }
          participants!.push({ id: p.name, group });
        });
      };
      build(left, LEFT_GROUPS);
      build(right, RIGHT_GROUPS);
      assertUniqueIds(participants.map((p) => p.id));
    }

    for (const p of left) setPred(p.name, matchNo, p.score);
    for (const p of right) setPred(p.name, matchNo, p.score);
  }

  if (participants === null) throw new Error('Nie znaleziono żadnego meczu w arkuszu');
  assertCounts(participants, fixtures);
  return { participants, fixtures, predictions };
}
