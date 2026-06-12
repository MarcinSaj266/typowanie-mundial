/** Klucze pól liczbowych typu T — dozwolone klucze sortowania w `rankBy`. */
export type NumericKey<T> = {
  [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

/**
 * Rankuje wiersze malejąco wg listy kluczy liczbowych podanych w kolejności
 * ważności — odwzorowanie `SORTBY` z Excela: pierwszy klucz jest główny,
 * kolejne to tiebreakery rozstrzygane po remisie. Nie mutuje wejścia;
 * dopisuje pozycje 1..n w kolejności sortowania.
 *
 * Tabele K1 mają różne porządki tiebreakerów (grupowa: pkt → % → grI → grII → grIII;
 * ogólna: pkt → % → puch → grI → grII → grIII), dlatego klucze podaje wywołujący.
 */
export function rankBy<T extends { participantId: string }>(
  rows: readonly T[],
  keys: readonly NumericKey<T>[],
): (T & { position: number })[] {
  const sorted = [...rows].sort((a, b) => {
    for (const k of keys) {
      const diff = (b[k] as number) - (a[k] as number);
      if (diff !== 0) {
        return diff;
      }
    }
    return 0;
  });
  return sorted.map((r, i) => ({ ...r, position: i + 1 }));
}
