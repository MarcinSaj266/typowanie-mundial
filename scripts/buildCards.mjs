// npm run build:cards — renderuje kartę każdego gracza do public/karty/<id>.png
// (Satori → SVG → sharp → PNG). Layout karty zdefiniowany TU (jedyne źródło wyglądu).
// Czyta gotowe staty z public/data/results.json (sekcja cards). Uruchamiać PO build:results.
import { mkdirSync, readFileSync } from 'node:fs';
import satori from 'satori';
import sharp from 'sharp';

const data = JSON.parse(readFileSync('public/data/results.json', 'utf8'));
const font = readFileSync('assets/fonts/PressStart2P.ttf');
const OUT = 'public/karty';
mkdirSync(OUT, { recursive: true });

const S = 2; // skala 2× dla ostrości (wektory, bez rozmycia)
const px = (v) => v * S;
const FONT = 'PSP';

const h = (style, children) => ({ type: 'div', props: { style, children } });
const txt = (style, t) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children: t } });
const dash = (nd, v) => (nd ? '—' : v);
const formaGlyph = (f) => (f === 'UP' ? '^' : f === 'DOWN' ? 'v' : '=');

const attrRow = (label, value, opts = {}) =>
  h(
    {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: `${px(8)}px 0`, borderBottom: `${px(2)}px solid #143d16`,
    },
    [
      txt({ fontSize: px(9), color: opts.dim ? '#6e8c66' : '#fff' }, label),
      txt({ fontSize: px(12), color: opts.dim ? '#6e8c66' : '#ffd600' }, String(value)),
    ],
  );

const sec = (t, dim) =>
  txt(
    { fontSize: px(8), color: dim ? '#5c7556' : '#76ff03', padding: `${px(12)}px ${px(16)}px ${px(4)}px`, letterSpacing: px(1) },
    t,
  );

function buildCard(nick, c) {
  const najl = c.poTurze2Aktywne && c.najlepszaTura ? `T${c.najlepszaTura.turn} (${c.najlepszaTura.points})` : '—';
  const forma = c.poTurze2Aktywne && c.forma ? formaGlyph(c.forma) : '—';
  return h(
    {
      display: 'flex', flexDirection: 'column', width: px(360), backgroundColor: '#1b5e20',
      border: `${px(4)}px solid #ffd600`, borderRadius: px(6), fontFamily: FONT, color: '#fff',
    },
    [
      // nagłówek
      h(
        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#143d16', padding: `${px(13)}px ${px(16)}px`, borderBottom: `${px(4)}px solid #ffd600` },
        [txt({ fontSize: px(17), color: '#ffd600' }, nick), txt({ fontSize: px(9), color: '#76ff03' }, `GRUPA ${c.group} ★`)],
      ),
      // hero EVERGREEN: miejsce w tabeli ogólnej + punkty całkowite
      h(
        { display: 'flex', borderBottom: `${px(3)}px solid #2e7d32` },
        [
          h({ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: `${px(14)}px 0` },
            [txt({ fontSize: px(26), color: '#ffd600' }, '#' + c.generalPos), txt({ fontSize: px(7), color: '#cde8c0', marginTop: px(8) }, 'MIEJSCE OGÓLNE')]),
          h({ display: 'flex', width: px(3), backgroundColor: '#2e7d32' }, []),
          h({ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: `${px(14)}px 0` },
            [txt({ fontSize: px(26), color: '#76ff03' }, String(c.points)), txt({ fontSize: px(7), color: '#cde8c0', marginTop: px(8) }, 'PUNKTY')]),
        ],
      ),
      // WYNIKI (faza grupowa)
      sec('> WYNIKI'),
      h({ display: 'flex', flexDirection: 'column', padding: `0 ${px(16)}px` },
        [
          attrRow('MIEJSCE W GRUPIE', '#' + c.groupPos),
          attrRow('CELNOŚĆ', c.celnoscPct + '%'),
          attrRow('DOKŁADNE WYNIKI', c.dokladne),
          attrRow('ŚR. PKT / MECZ', c.srPktMecz.toFixed(1)),
        ]),
      // STYL GRY
      sec('> STYL GRY'),
      h({ display: 'flex', flexDirection: 'column', padding: `0 ${px(16)}px` },
        [
          attrRow('ODWAGA', c.odwagaPct + '%'),
          attrRow('NOS DO REMISÓW', dash(c.nosRemisowNd, c.nosRemisowPct + '%')),
          attrRow('NAJDŁUŻSZA SERIA', c.seria),
          attrRow('OFENSYWA', c.ofensywa.toFixed(1)),
          attrRow('PEWNIAK', dash(c.pewniakNd, c.pewniak.toFixed(1))),
          attrRow('ULUBIONY WYNIK', c.ulubionyWynik),
        ]),
      // plakietka osobowości
      h({ display: 'flex', justifyContent: 'center', padding: `${px(10)}px ${px(16)}px ${px(2)}px` },
        [txt({ fontSize: px(9), color: '#143d16', backgroundColor: '#76ff03', padding: `${px(7)}px ${px(10)}px`, borderRadius: px(3) }, `★ ${c.osobowosc} · ZGODNOŚĆ ${c.zgodnoscPct}%`)]),
      // PO TURZE 2
      sec('> PO TURZE 2', !c.poTurze2Aktywne),
      h({ display: 'flex', flexDirection: 'column', padding: `0 ${px(16)}px` },
        [attrRow('FORMA', forma, { dim: !c.poTurze2Aktywne }), attrRow('NAJLEPSZA TURA', najl, { dim: !c.poTurze2Aktywne })]),
      // branding
      h({ display: 'flex', justifyContent: 'center', backgroundColor: '#143d16', padding: `${px(12)}px 0`, borderTop: `${px(3)}px solid #ffd600`, marginTop: px(10) },
        [txt({ fontSize: px(7), color: '#cde8c0' }, 'typowaniemundial.vercel.app')]),
    ],
  );
}

let count = 0;
for (const [nick, c] of Object.entries(data.cards)) {
  const svg = await satori(buildCard(nick, c), {
    width: px(360),
    fonts: [{ name: FONT, data: font, weight: 400, style: 'normal' }],
  });
  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${nick}.png`);
  count += 1;
}
console.log(`OK: ${count} kart → ${OUT}/`);
