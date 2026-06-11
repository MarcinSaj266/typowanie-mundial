import { describe, it, expect } from 'vitest';
import { buildResults } from './buildResults';
import { ALL_GROUPS } from './types';
import type { Participant, ResultsByTurn, TurnData } from './types';

const roster: Participant[] = [
  { id: 'a1', group: 'A' },
  { id: 'a2', group: 'A' },
  { id: 'b1', group: 'B' },
  { id: 'b2', group: 'B' },
];

const turn1: TurnData = {
  turn: 1,
  fixtures: [{ no: 1 }, { no: 2 }, { no: 3 }],
  predictions: {
    a1: { '1': { home: 2, away: 1 }, '2': { home: 1, away: 1 }, '3': { home: 1, away: 0 } },
    a2: { '1': { home: 1, away: 0 }, '2': { home: 1, away: 0 } },
    b1: { '1': { home: 5, away: 0 } },
    b2: {},
  },
};

// Mecz 3 bez wyniku = nierozegrany (typ a1 na mecz 3 nie może nic dać).
const results: ResultsByTurn = {
  '1': { '1': { home: 2, away: 1 }, '2': { home: 0, away: 0 } },
};

const out = buildResults(roster, [turn1], results, '2026-06-12T00:00:00Z');

describe('buildResults (syntetycznie)', () => {
  it('liczy punkty wg scoreMatchK1 i rankuje tabele ogolna', () => {
    // a1: 5 (dokladny 2:1) + 4 (remis z trafiona roznica) = 9
    // a2: 4 (wygrana z trafiona roznica) + 0 (typ wygranej, byl remis) = 4
    // b1: 3 (wygrana, zla roznica) + 0 (brak typu na rozegranym meczu) = 3
    // b2: 0 (brak typow) = 0
    expect(out.general.map((r) => [r.participantId, r.points, r.position])).toEqual([
      ['a1', 9, 1],
      ['a2', 4, 2],
      ['b1', 3, 3],
      ['b2', 0, 4],
    ]);
  });

  it('kategorie, played i hitRate; mecz bez wyniku pominiety', () => {
    expect(out.general[0]).toMatchObject({ count5: 1, count4: 1, count3: 0, played: 2, hitRate: 1 });
    expect(out.general[2]).toMatchObject({ count3: 1, played: 2, hitRate: 0.5 });
  });

  it('brak tur II/III daje grII=grIII=0 (bns/puch tez 0)', () => {
    expect(out.general[0]).toMatchObject({ grI: 9, grII: 0, grIII: 0, bns: 0, puch: 0 });
  });

  it('tabele grupowe: tylko swoi, wlasne pozycje, te same punkty co w ogolnej', () => {
    expect(out.groups.A.map((r) => [r.participantId, r.position])).toEqual([['a1', 1], ['a2', 2]]);
    expect(out.groups.B.map((r) => [r.participantId, r.position])).toEqual([['b1', 1], ['b2', 2]]);
    expect(out.groups.C).toEqual([]);
    const a2General = out.general.find((r) => r.participantId === 'a2')!;
    const a2Group = out.groups.A.find((r) => r.participantId === 'a2')!;
    expect(a2Group.points).toBe(a2General.points);
  });

  it('generatedAt przechodzi z parametru', () => {
    expect(out.generatedAt).toBe('2026-06-12T00:00:00Z');
  });
});

import { readFileSync } from 'node:fs';

describe('buildResults (realne dane + atrapy)', () => {
  const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
  const real = buildResults(
    read('data/k1/roster.json'),
    [read('data/k1/tura-1.json')],
    read('data/k1/results.json'),
    'test',
  );

  it('56 osob w ogolnej, kazda grupa A-H po 7', () => {
    expect(real.general).toHaveLength(56);
    for (const g of ALL_GROUPS) expect(real.groups[g]).toHaveLength(7);
  });

  it('pozycje 1..56 bez dziur; lider ma maksymalne punkty', () => {
    expect(real.general.map((r) => r.position)).toEqual(
      Array.from({ length: 56 }, (_, i) => i + 1),
    );
    const max = Math.max(...real.general.map((r) => r.points));
    expect(real.general[0].points).toBe(max);
  });

  it('kazdy rozegral co najwyzej 24 mecze', () => {
    for (const r of real.general) expect(r.played).toBeLessThanOrEqual(24);
  });
});
