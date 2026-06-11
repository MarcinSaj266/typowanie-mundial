// Publiczne API silnika punktacji.
export type {
  Score,
  MatchPoints,
  MatchEntry,
  TurnScore,
  ParticipantSeason,
  GeneralRow,
} from './types';
export type { NumericKey } from './ranking';
export type { SeasonExtras } from './buildSeason';

export { scoreMatchK1 } from './scoreMatch';
export { aggregateTurn } from './aggregate';
export { rankBy } from './ranking';
export { buildSeason } from './buildSeason';
export { generalTable } from './generalTable';
