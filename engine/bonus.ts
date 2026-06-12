/** Wiersz tabeli grupowej na potrzeby bonusu: uczestnik + suma punktów tur. */
export interface BonusRow {
  participantId: string;
  points: number;
}

/** Bonus za miejsca 1–3 w każdej grupie. */
const PLACE_BONUS = [15, 10, 5];
/** Bonus za miejsca 4–7 w grupie o najlepszej łącznej sumie punktów. */
const BEST_GROUP_BONUS = [4, 3, 2, 1];

/**
 * Bonus grupowy `bns` przyznawany na zakończenie fazy grupowej (reguła
 * organizatora, 2026-06-12; zalążek w arkuszu „tab grup", kolumna M):
 * miejsca 1–3 w każdej grupie → 15/10/5; w grupie o najlepszej łącznej
 * sumie punktów siedmiu graczy miejsca 4–7 → 4/3/2/1. Przy remisie
 * najlepszej sumy bonus 4–7 dostają wszystkie zremisowane grupy
 * (odwzorowanie `IF(suma=$D$44,...)` z arkusza).
 *
 * Wejście: tabele grupowe w kolejności miejsc (indeks 0 = miejsce 1).
 * Wyjście: participantId → bonus (tylko nagrodzeni).
 */
export function groupBonus(groups: readonly (readonly BonusRow[])[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (groups.length === 0) return out;
  const sums = groups.map((g) => g.reduce((acc, r) => acc + r.points, 0));
  const best = Math.max(...sums);
  groups.forEach((g, gi) => {
    g.forEach((row, i) => {
      if (i < PLACE_BONUS.length) {
        out[row.participantId] = PLACE_BONUS[i];
      } else if (sums[gi] === best && i - PLACE_BONUS.length < BEST_GROUP_BONUS.length) {
        out[row.participantId] = BEST_GROUP_BONUS[i - PLACE_BONUS.length];
      }
    });
  });
  return out;
}
