// Smoke po `npm run build`: HTML tabeli zawiera lidera z results.json (spec renderu, sekcja 5).
import { readFileSync } from 'node:fs';

const results = JSON.parse(readFileSync('public/data/results.json', 'utf8'));
const lider: string = results.general[0].participantId;
const html = readFileSync('out/tabela/index.html', 'utf8');

if (!html.includes(lider)) {
  console.error(`SMOKE FAIL: brak lidera "${lider}" w out/tabela/index.html`);
  process.exit(1);
}
const matches = (readFileSync('out/mecze/index.html', 'utf8').match(/<details/g) ?? []).length;
if (matches !== results.turns[0].matches.length) {
  console.error(`SMOKE FAIL: ${matches} meczy w HTML, oczekiwano ${results.turns[0].matches.length}`);
  process.exit(1);
}
console.log(`SMOKE OK: lider "${lider}" w tabeli, ${matches} meczy w widoku meczow`);
