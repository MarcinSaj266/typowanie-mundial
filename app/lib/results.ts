import { readFileSync } from 'node:fs';
import path from 'node:path';
// Import WYŁĄCZNIE typów — znika w buildzie; app/ nie zna silnika (granica modułów).
import type { ResultsJson } from '../../compute/types';

/** Czyta wygenerowany results.json w czasie builda (komponenty serwerowe). */
export function loadResults(): ResultsJson {
  const p = path.join(process.cwd(), 'public', 'data', 'results.json');
  return JSON.parse(readFileSync(p, 'utf8')) as ResultsJson;
}
