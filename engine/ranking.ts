import type { RankableRow, RankedRow } from './types';

/**
 * Rankuje wiersze malejąco wg: punkty → „%" → liczba dokładnych (5) → liczba „4".
 * Wspólne dla tabel grup konkursowych i tabeli ogólnej (sekcja 2.2 specyfikacji).
 * Nie mutuje wejścia; przypisuje pozycje 1..n w kolejności sortowania.
 */
export function rankRows(rows: RankableRow[]): RankedRow[] {
  const sorted = [...rows].sort((a, b) =>
    b.points - a.points ||
    b.hitRate - a.hitRate ||
    b.exactCount - a.exactCount ||
    b.fourCount - a.fourCount
  );
  return sorted.map((r, i) => ({ ...r, position: i + 1 }));
}
