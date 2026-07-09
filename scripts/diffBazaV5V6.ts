// Diagnostyka: czy "Baza puch v6" zmienia cokolwiek w rundach 1/16+1/8 (mecze 1–24) vs v5.
import { readFileSync } from 'node:fs';
import { openXlsx } from '../ingest/xlsx/workbook';
import { parseBazaPuchar } from '../ingest/k1/parseBazaPuchar';
import type { Participant } from '../ingest/k1/parseGrup1';

const NICK_ALIAS: Record<string, string> = {
  WojtekN: 'Wojtek',
  'Turbo-Ryzu': 'Turbo-Ryżu',
  RafałCz: 'Rafał',
  'Sławek G.': 'Sławek',
  PawełS: 'PawełSt',
};

const roster: Participant[] = JSON.parse(readFileSync('data/k1/roster.json', 'utf8'));

function pred(file: string, from: number, to: number) {
  const sheet = openXlsx(readFileSync(file)).sheet('t2');
  return parseBazaPuchar(sheet, { round: 'x', roster, nickAlias: NICK_ALIAS, matches: { from, to } })
    .predictions;
}

const fmt = (p: any) => `${p.home}:${p.away}${p.pk ? ` (pk:${p.pk})` : ''}`;

for (const [from, to, label] of [[1, 16, '1/16'], [17, 24, '1/8']] as const) {
  const v5 = pred('Baza puch v5 (2026.07.05).xlsx', from, to);
  const v6 = pred('Baza puch v6 2026.07.09.xlsx', from, to);
  console.log(`\n=== ${label} (mecze ${from}–${to}): zmiany v5 → v6 ===`);
  let changes = 0;
  for (const p of roster) {
    const a = v5[p.id] ?? {}, b = v6[p.id] ?? {};
    const matches = [...new Set([...Object.keys(a), ...Object.keys(b)].map(Number))].sort((x, y) => x - y);
    for (const m of matches) {
      const av = (a as any)[m], bv = (b as any)[m];
      if (!av && bv) { console.log(`  ${p.id} + mecz ${m}: ${fmt(bv)} [NOWY]`); changes++; }
      else if (av && !bv) { console.log(`  ${p.id} - mecz ${m}: (był ${fmt(av)}) [ZNIKŁ]`); changes++; }
      else if (av && bv && fmt(av) !== fmt(bv)) { console.log(`  ${p.id} ~ mecz ${m}: ${fmt(av)} → ${fmt(bv)} [ZMIANA]`); changes++; }
    }
  }
  console.log(`  Łącznie zmian: ${changes}`);
}
