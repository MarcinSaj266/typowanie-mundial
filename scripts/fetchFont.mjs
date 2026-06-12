// Jednorazowe pobranie Press Start 2P (latin + latin-ext) do public/fonts/.
// Uruchom: node scripts/fetchFont.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const css = await (
  await fetch('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap', {
    headers: { 'user-agent': UA },
  })
).text();

mkdirSync('public/fonts', { recursive: true });
const blocks = [...css.matchAll(/\/\* ([\w-]+) \*\/[^}]*?url\((\S+?\.woff2)\)/g)];
for (const [, subset, url] of blocks) {
  if (subset !== 'latin' && subset !== 'latin-ext') continue;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(`public/fonts/press-start-2p-${subset}.woff2`, buf);
  console.log(`OK ${subset} <- ${url}`);
}
