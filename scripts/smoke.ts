// Smoke po `npm run build`: HTML tabeli zawiera lidera z results.json (spec renderu, sekcja 5).
import { existsSync, readFileSync } from 'node:fs';

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
// Intro + muzyka (spec intro, sekcja "Testy").
const menu = readFileSync('out/index.html', 'utf8');
for (const marker of ['pixel-ball', 'music-toggle', 'press-start']) {
  if (!menu.includes(marker)) {
    console.error(`SMOKE FAIL: brak "${marker}" w out/index.html`);
    process.exit(1);
  }
}
if (!existsSync('out/audio/full-time-glory.mp3')) {
  console.error('SMOKE FAIL: brak out/audio/full-time-glory.mp3');
  process.exit(1);
}
console.log(`SMOKE OK: lider "${lider}" w tabeli, ${matches} meczy w widoku meczow, intro + muzyka na miejscu`);
