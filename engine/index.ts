// Publiczne API silnika punktacji.
export type {
  Score,
  MatchPoints,
  MatchEntry,
  TurnScore,
  RankableRow,
  RankedRow,
  ParticipantSeason,
  GeneralRow,
} from './types';

export { scoreMatchK1 } from './scoreMatch';
export { aggregateTurn } from './aggregate';
export { rankRows } from './ranking';
export { generalTable } from './generalTable';
