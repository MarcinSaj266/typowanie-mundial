/** Stan jednego etapu na potrzeby bonusu skuteczności. */
export interface PhaseStanding {
  /** Czy etap kompletny (wszystkie mecze rozegrane). Niekompletny = bez bonusu. */
  complete: boolean;
  /** participantId w kolejności miejsc (indeks 0 = miejsce 1). */
  standings: readonly string[];
}

/** Bonus za miejsca 1–3 etapu. */
const PLACE = [3, 2, 1];

/**
 * Bonus „skuteczności" (reguła organizatora, 2026-06-18): top 3 KAŻDEGO zamkniętego
 * etapu (tura 1/2/3 fazy grupowej oraz cała faza pucharowa) dostaje +3/+2/+1.
 * Bonusy kumulują się między etapami. Etap niekompletny nie przyznaje nic.
 *
 * NIE są to zwykłe punkty — służą jako ukryty tiebreaker tabeli końcowej, który
 * (decyzja organizatora) zacznie funkcjonować dopiero od fazy pucharowej. Tu liczony
 * i zapamiętywany; wpięcie w sortowanie poza zakresem.
 *
 * Wejście: etapy (każdy z flagą kompletności i listą miejsc).
 * Wyjście: participantId → skumulowany bonus (tylko nagrodzeni).
 */
export function efficiencyBonus(phases: readonly PhaseStanding[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const phase of phases) {
    if (!phase.complete) continue;
    phase.standings.slice(0, PLACE.length).forEach((id, i) => {
      out[id] = (out[id] ?? 0) + PLACE[i];
    });
  }
  return out;
}
