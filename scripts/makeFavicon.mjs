// node scripts/makeFavicon.mjs — generuje favicon z pikselowej piłki ze strony głównej
// (dokładnie ten sam sprite 8×8 co .pixel-ball w app/globals.css, tło = czerń ekranu tytułowego).
// Wyjście: app/icon.png (32×32, favicon) + app/apple-icon.png (180×180) — konwencja metadanych
// Next App Router (linki <link rel="icon">/apple-touch-icon dokleja Next). Uruchamiać ręcznie
// po zmianie sprite'a, PNG commitujemy.
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

// Sprite .pixel-ball: '#' = biały, 'B' = czarny (łata), '.' = tło.
const SPRITE = [
  '..####..',
  '.######.',
  '###BB###',
  '##BBBB##',
  '###BB###',
  '########',
  '.######.',
  '..####..',
];
const BIALY = '#fff';
const CZERN = '#000';

function ballSvg(size, scale) {
  const grid = SPRITE.length * scale;
  const off = (size - grid) / 2;
  const rects = [];
  SPRITE.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === '.') return;
      const fill = c === 'B' ? CZERN : BIALY;
      rects.push(
        `<rect x="${off + x * scale}" y="${off + y * scale}" width="${scale}" height="${scale}" fill="${fill}"/>`,
      );
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<rect width="${size}" height="${size}" fill="${CZERN}"/>${rects.join('')}</svg>`;
}

for (const { file, size, scale } of [
  { file: 'app/icon.png', size: 32, scale: 4 },
  { file: 'app/apple-icon.png', size: 180, scale: 20 },
]) {
  const png = await sharp(Buffer.from(ballSvg(size, scale))).png().toBuffer();
  writeFileSync(file, png);
  console.log(`OK: ${file} (${size}×${size})`);
}
