import { describe, it, expect } from 'vitest';
import { findStaleMatches, findStalePucharMatches } from './staleCheck';
import type { TurnFixtures, ApiMatch } from './matchScores';
import type { PucharRoundFixtures } from './matchPucharScores';

/** Skrót: jedna tura z fixture'ami (nazwy PL jak w naszych danych). */
const tura = (turn: number, fixtures: TurnFixtures['fixtures']): TurnFixtures => ({
  turn,
  fixtures,
});

/** Skrót: mecz z API (nazwy EN jak z football-data.org), z datą rozpoczęcia. */
const api = (
  home: string,
  away: string,
  opts: { status?: string; goals?: [number, number] | null; utcDate?: string } = {},
): ApiMatch => ({
  home,
  away,
  homeGoals: opts.goals ? opts.goals[0] : null,
  awayGoals: opts.goals ? opts.goals[1] : null,
  status: opts.status ?? 'TIMED',
  utcDate: opts.utcDate,
});

const NOW = Date.parse('2026-06-14T20:00:00Z');
const GRACE = 3.5 * 60 * 60 * 1000; // 3,5h

describe('findStaleMatches', () => {
  it('zgłasza mecz FINISHED w API, którego brak w wynikach (luka mergera)', () => {
    const turns = [tura(1, [{ no: 9, home: 'Niemcy', away: 'Curacao' }])];
    const matches = [api('Germany', 'Curaçao', { status: 'FINISHED', goals: [3, 0] })];

    const stale = findStaleMatches(turns, {}, matches, NOW, GRACE);

    expect(stale).toHaveLength(1);
    expect(stale[0]).toMatchObject({ turn: 1, no: 9, reason: 'finished-missing' });
  });

  it('zgłasza mecz dawno po gwizdku (utcDate + grace minęło), bez wyniku', () => {
    const turns = [tura(1, [{ no: 9, home: 'Niemcy', away: 'Curacao' }])];
    // start 4h temu, wciąż nie FINISHED w API → API się spóźnia
    const matches = [api('Germany', 'Curaçao', { utcDate: '2026-06-14T16:00:00Z' })];

    const stale = findStaleMatches(turns, {}, matches, NOW, GRACE);

    expect(stale).toHaveLength(1);
    expect(stale[0]).toMatchObject({ turn: 1, no: 9, reason: 'overdue' });
  });

  it('NIE zgłasza meczu świeżo rozpoczętego (w oknie grace)', () => {
    const turns = [tura(1, [{ no: 9, home: 'Niemcy', away: 'Curacao' }])];
    // start 1,5h temu — mecz może jeszcze trwać
    const matches = [api('Germany', 'Curaçao', { utcDate: '2026-06-14T18:30:00Z' })];

    expect(findStaleMatches(turns, {}, matches, NOW, GRACE)).toHaveLength(0);
  });

  it('NIE zgłasza meczu, który ma już wynik (nawet gdyby był stary)', () => {
    const turns = [tura(1, [{ no: 9, home: 'Niemcy', away: 'Curacao' }])];
    const results = { '1': { '9': { home: 3, away: 0 } } };
    const matches = [api('Germany', 'Curaçao', { status: 'FINISHED', goals: [3, 0] })];

    expect(findStaleMatches(turns, results, matches, NOW, GRACE)).toHaveLength(0);
  });

  it('NIE zgłasza fixture’a, którego API w ogóle nie zwróciło (nie da się ocenić)', () => {
    const turns = [tura(1, [{ no: 9, home: 'Niemcy', away: 'Curacao' }])];

    expect(findStaleMatches(turns, {}, [], NOW, GRACE)).toHaveLength(0);
  });
});

describe('findStalePucharMatches', () => {
  const rundy: PucharRoundFixtures[] = [
    { round: '1/8', fixtures: [{ no: 19, home: 'Brazylia', away: 'Norwegia' }] },
  ];

  it('zgłasza mecz pucharowy FINISHED w API, którego brak w results["puch"]', () => {
    const stale = findStalePucharMatches(
      rundy,
      {},
      [{ ...api('Brazil', 'Norway', { status: 'FINISHED', goals: [2, 1] }), stage: 'LAST_16' }],
      NOW,
      GRACE,
    );

    expect(stale).toHaveLength(1);
    expect(stale[0]).toMatchObject({ no: 19, reason: 'finished-missing' });
  });

  it('nie zgłasza, gdy wynik pucharowy już wpisany', () => {
    const stale = findStalePucharMatches(
      rundy,
      { '19': { home: 2, away: 1 } },
      [{ ...api('Brazil', 'Norway', { status: 'FINISHED', goals: [2, 1] }), stage: 'LAST_16' }],
      NOW,
      GRACE,
    );

    expect(stale).toHaveLength(0);
  });

  it('ignoruje tę samą parę z innego stage (np. GROUP_STAGE)', () => {
    const stale = findStalePucharMatches(
      rundy,
      {},
      [{ ...api('Brazil', 'Norway', { status: 'FINISHED', goals: [2, 1] }), stage: 'GROUP_STAGE' }],
      NOW,
      GRACE,
    );

    expect(stale).toHaveLength(0);
  });

  it('zgłasza overdue, gdy dawno po starcie a wynik nie FINISHED', () => {
    const start = new Date(NOW - GRACE - 60_000).toISOString();
    const stale = findStalePucharMatches(
      rundy,
      {},
      [{ ...api('Brazil', 'Norway', { status: 'IN_PLAY', utcDate: start }), stage: 'LAST_16' }],
      NOW,
      GRACE,
    );

    expect(stale).toHaveLength(1);
    expect(stale[0]).toMatchObject({ no: 19, reason: 'overdue' });
  });
});
