import type { Score } from './types';

/** Deterministyczny PRNG mulberry32 — powtarzalne atrapy przy stałym ziarnie. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generuje wyniki-atrapy meczów 1..matchCount (bramki 0–4), deterministycznie. */
export function seedTurnResults(matchCount: number, seed: number): Record<string, Score> {
  const rnd = mulberry32(seed);
  const out: Record<string, Score> = {};
  for (let no = 1; no <= matchCount; no++) {
    out[String(no)] = {
      home: Math.floor(rnd() * 5),
      away: Math.floor(rnd() * 5),
    };
  }
  return out;
}
