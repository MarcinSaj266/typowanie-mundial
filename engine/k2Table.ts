import type { K2Score } from './types';
import { rankBy } from './ranking';

/**
 * Tabela końcowa Konkursu 2. Tiebreak organizatora (zasady B13–B14):
 * przy równym `total` wyżej ten, kto zdobył więcej punktów w PÓŹNIEJSZEJ fazie
 * — stąd klucze od najpóźniejszej do najwcześniejszej.
 */
export function k2Table(scores: readonly K2Score[]): (K2Score & { position: number })[] {
  return rankBy(scores, ['total', 'champion', 'final', 'sf', 'qf', 'r16', 'r32', 'group']);
}
