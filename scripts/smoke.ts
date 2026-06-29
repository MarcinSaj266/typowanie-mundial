// Smoke po `npm run build`: HTML tabeli zawiera lidera z results.json (spec renderu, sekcja 5).
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const results = JSON.parse(readFileSync('public/data/results.json', 'utf8'));
const lider: string = results.general[0].participantId;
const html = readFileSync('out/tabela/index.html', 'utf8');

if (!html.includes(lider)) {
  console.error(`SMOKE FAIL: brak lidera "${lider}" w out/tabela/index.html`);
  process.exit(1);
}
// Liczymy karty meczów po klasie (tury są też w <details>, więc nie liczymy gołego <details).
const matches = (readFileSync('out/mecze/index.html', 'utf8').match(/class="match-card"/g) ?? []).length;
// /mecze renderuje WSZYSTKIE tury — oczekujemy sumy meczów ze wszystkich tur.
const expectedMatches = results.turns.reduce((acc: number, t: { matches: unknown[] }) => acc + t.matches.length, 0);
if (matches !== expectedMatches) {
  console.error(`SMOKE FAIL: ${matches} meczy w HTML, oczekiwano ${expectedMatches}`);
  process.exit(1);
}
// Tabela ogólna: kolumny pucharowe (×6, PUCH) widoczne po starcie 1/16.
if (results.puchar.rounds.length > 0) {
  for (const marker of ['×6', 'PUCH']) {
    if (!html.includes(marker)) {
      console.error(`SMOKE FAIL: brak kolumny "${marker}" w out/tabela/index.html`);
      process.exit(1);
    }
  }
}
// /puchar: liczba kart meczów pucharowych == suma meczów ze wszystkich rund.
const puchHtml = readFileSync('out/puchar/index.html', 'utf8');
const puchMatches = (puchHtml.match(/class="match-card puch-match-card"/g) ?? []).length;
const expectedPuch = results.puchar.rounds.reduce((acc: number, r: { matches: unknown[] }) => acc + r.matches.length, 0);
if (puchMatches !== expectedPuch) {
  console.error(`SMOKE FAIL: ${puchMatches} meczów puch w HTML, oczekiwano ${expectedPuch}`);
  process.exit(1);
}
// Intro + muzyka (spec intro, sekcja "Testy").
const menu = readFileSync('out/index.html', 'utf8');
for (const marker of ['pixel-ball', 'music-toggle', 'press-start', 'Designed by MarcinS', 'FAZA PUCHAROWA']) {
  if (!menu.includes(marker)) {
    console.error(`SMOKE FAIL: brak "${marker}" w out/index.html`);
    process.exit(1);
  }
}
if (!existsSync('out/audio/full-time-glory.mp3')) {
  console.error('SMOKE FAIL: brak out/audio/full-time-glory.mp3');
  process.exit(1);
}
// Karta zawodnika: PNG per gracz, przycisk na profilu, og:image + legenda na podstronie karty.
const kartyCount = existsSync('out/karty')
  ? readdirSync('out/karty').filter((f) => f.endsWith('.png')).length
  : 0;
if (kartyCount !== results.general.length) {
  console.error(`SMOKE FAIL: ${kartyCount} kart w out/karty, oczekiwano ${results.general.length}`);
  process.exit(1);
}
const graczDir = readdirSync('out/gracz')[0];
const profilHtml = readFileSync(`out/gracz/${graczDir}/index.html`, 'utf8');
if (!profilHtml.includes('KARTA ZAWODNIKA')) {
  console.error(`SMOKE FAIL: brak przycisku „KARTA ZAWODNIKA" w out/gracz/${graczDir}/index.html`);
  process.exit(1);
}
// Profil pokazuje fazę pucharową, gdy istnieje (sekcja „PUCHAR …").
if (results.puchar.rounds.length > 0 && !profilHtml.includes('PUCHAR')) {
  console.error(`SMOKE FAIL: brak sekcji „PUCHAR" w out/gracz/${graczDir}/index.html`);
  process.exit(1);
}
const kartaHtml = readFileSync(`out/gracz/${graczDir}/karta/index.html`, 'utf8');
for (const marker of ['og:image', '/karty/', 'summary_large_image', 'JAK TO LICZYMY']) {
  if (!kartaHtml.includes(marker)) {
    console.error(`SMOKE FAIL: brak "${marker}" w out/gracz/${graczDir}/karta/index.html`);
    process.exit(1);
  }
}
console.log(`SMOKE OK: lider "${lider}" w tabeli, ${matches} meczy, ${kartyCount} kart, przycisk + podstrona karty (og:image, legenda), intro + muzyka`);
