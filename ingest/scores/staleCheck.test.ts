import { describe, it, expect } from 'vitest';
import { findStaleMatches } from './staleCheck';
import type { TurnFixtures, ApiMatch } from './matchScores';

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
