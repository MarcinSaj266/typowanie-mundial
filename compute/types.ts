import type { Score } from '../engine/types';
import type { Group, Participant } from '../ingest/k1/parseGrup1';

/** Wyniki meczów: numer tury → numer meczu → wynik. Brak klucza = mecz nierozegrany. */
export type ResultsByTurn = Record<string, Record<string, Score>>;

/** Dane tury z ingestu (kształt data/k1/tura-N.json; z fixtures potrzebny tylko numer). */
export interface TurnData {
  turn: number;
  fixtures: { no: number }[];
  predictions: Record<string, Record<string, Score>>;
}

/** Wiersz tabeli (ogólnej lub grupowej) w wyjściowym results.json. */
export interface TableRow {
  participantId: string;
  group: Group;
  /** Pozycja w TEJ tabeli (ogólnej lub grupowej). */
  position: number;
  /** Suma sezonu = grI + grII + grIII + bns + puch. */
  points: number;
  grI: number;
  grII: number;
  grIII: number;
  bns: number;
  puch: number;
  /** Sezonowe „%" (sumarycznie: łączne trafienia / łączne rozegrane). */
  hitRate: number;
  count3: number;
  count4: number;
  count5: number;
  played: number;
}

/** Wyjście dla UI: public/data/results.json. */
export interface ResultsJson {
  generatedAt: string;
  general: TableRow[];
  groups: Record<Group, TableRow[]>;
}

export const ALL_GROUPS: Group[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export type { Group, Participant, Score };
