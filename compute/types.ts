import type { Score, CardStats } from '../engine/types';
import type { Group, Participant } from '../ingest/k1/parseGrup1';

/** Wyniki meczów: numer tury → numer meczu → wynik. Brak klucza = mecz nierozegrany. */
export type ResultsByTurn = Record<string, Record<string, Score>>;

/** Mecz w turze (kształt fixtures z data/k1/tura-N.json). */
export interface Fixture {
  no: number;
  home: string;
  away: string;
  kickoff: string;
}

/** Dane tury z ingestu (kształt data/k1/tura-N.json). */
export interface TurnData {
  turn: number;
  fixtures: Fixture[];
  predictions: Record<string, Record<string, Score>>;
}

/** Typ uczestnika na mecz w wyjściowym results.json.
 *  pick: null = brak typu; points: null = mecz nierozegrany LUB brak typu. */
export interface PredictionOut {
  pick: Score | null;
  points: number | null;
}

/** Mecz w sekcji turns wyjściowego results.json. */
export interface MatchOut {
  no: number;
  home: string;
  away: string;
  kickoff: string;
  /** null = mecz nierozegrany. */
  result: Score | null;
  /** Klucz = participantId; komplet osób z rosteru. */
  predictions: Record<string, PredictionOut>;
}

/** Tura w sekcji turns wyjściowego results.json. */
export interface TurnOut {
  turn: number;
  matches: MatchOut[];
}

/** Wiersz tabeli (ogólnej lub grupowej) w wyjściowym results.json. */
export interface TableRow {
  participantId: string;
  group: Group;
  /** Pozycja w TEJ tabeli (ogólnej lub grupowej). */
  position: number;
  /** Punkty w TEJ tabeli: ogólna = grI+grII+grIII+bns+puch; grupowa = grI+grII+grIII. */
  points: number;
  grI: number;
  grII: number;
  grIII: number;
  bns: number;
  puch: number;
  /** Ukryty bonus „skuteczności" (top3 etapu, +3/+2/+1; reguła organizatora 2026-06-18).
   *  Policzony i zapamiętany, NIE wliczany do punktów; tiebreaker aktywny od fazy pucharowej. */
  skutBonus: number;
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
  turns: TurnOut[];
  /** Statystyki karty zawodnika per uczestnik (nick → komplet stat). */
  cards: Record<string, CardStats>;
}

export const ALL_GROUPS: Group[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export type { Group, Participant, Score, CardStats };
