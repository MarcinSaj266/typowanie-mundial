import { describe, it, expect } from 'vitest';
import { mergePucharScores, type PucharRoundFixtures } from './matchPucharScores';
import type { ApiMatch } from './matchScores';

/** Skrót: runda pucharowa z fixture'ami (nazwy PL, numery GLOBALNE). */
const runda = (round: string, fixtures: PucharRoundFixtures['fixtures']): PucharRoundFixtures => ({
  round,
  fixtures,
});

/** Skrót: mecz pucharowy z API (nazwy EN; pola score jak z v4 — patrz spikePuchar). */
const api = (over: Partial<ApiMatch> & Pick<ApiMatch, 'home' | 'away'>): ApiMatch => ({
  homeGoals: null,
  awayGoals: null,
  status: 'FINISHED',
  stage: 'LAST_32',
  duration: 'REGULAR',
  ...over,
});

describe('mergePucharScores', () => {
  it('dopasowuje mecz po stage+parze i wpisuje zwykły wynik (REGULAR)', () => {
    const rounds = [runda('1/16', [{ no: 1, home: 'Kanada', away: 'RPA' }])];
    const out = mergePucharScores(rounds, {}, [
      api({ home: 'South Africa', away: 'Canada', homeGoals: 0, awayGoals: 1, winner: 'AWAY_TEAM' }),
    ]);

    // API ma odwrotną orientację → u nas Kanada(dom) 1 : 0 RPA
    expect(out.puch['1']).toEqual({ home: 1, away: 0 });
    expect(out.added).toHaveLength(1);
    expect(out.added[0]).toMatchObject({ round: '1/16', no: 1 });
    expect(out.warnings).toHaveLength(0);
  });

  it('dogrywka (EXTRA_TIME): fullTime liczy się jak wynik z 90 minut', () => {
    // Belgia 3:2 Senegal po dogrywce (regularTime 2:2) — zapisujemy 3:2, bez pk.
    const rounds = [runda('1/16', [{ no: 9, home: 'Belgia', away: 'Senegal' }])];
    const out = mergePucharScores(rounds, {}, [
      api({
        home: 'Belgium',
        away: 'Senegal',
        homeGoals: 3,
        awayGoals: 2,
        duration: 'EXTRA_TIME',
        winner: 'HOME_TEAM',
        regularTime: { home: 2, away: 2 },
        extraTime: { home: 1, away: 0 },
      }),
    ]);

    expect(out.puch['9']).toEqual({ home: 3, away: 2 });
  });

  it('karne: wynik po 120 min = regularTime+extraTime (fullTime zawiera bramki karnych) + pk', () => {
    // Niemcy–Paragwaj: fullTime 4:5 (z karnymi!), regularTime 1:1, extraTime 0:0, winner AWAY_TEAM.
    const rounds = [runda('1/16', [{ no: 3, home: 'Niemcy', away: 'Paragwaj' }])];
    const out = mergePucharScores(rounds, {}, [
      api({
        home: 'Germany',
        away: 'Paraguay',
        homeGoals: 4,
        awayGoals: 5,
        duration: 'PENALTY_SHOOTOUT',
        winner: 'AWAY_TEAM',
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 0, away: 0 },
        penalties: { home: 3, away: 4 },
      }),
    ]);

    expect(out.puch['3']).toEqual({ home: 1, away: 1, pk: 'away' });
  });

  it('karne przy odwróconej orientacji: wynik I pk przetłumaczone na naszego gospodarza', () => {
    // U nas: Maroko(dom) — Holandia; API: Netherlands(dom) — Morocco, winner AWAY_TEAM (Maroko).
    const rounds = [runda('1/16', [{ no: 4, home: 'Maroko', away: 'Holandia' }])];
    const out = mergePucharScores(rounds, {}, [
      api({
        home: 'Netherlands',
        away: 'Morocco',
        homeGoals: 3,
        awayGoals: 4,
        duration: 'PENALTY_SHOOTOUT',
        winner: 'AWAY_TEAM',
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 0, away: 0 },
        penalties: { home: 2, away: 3 },
      }),
    ]);

    // Zwycięzca karnych = Maroko = NASZ gospodarz → pk: 'home'.
    expect(out.puch['4']).toEqual({ home: 1, away: 1, pk: 'home' });
  });

  it('ta sama para z fazy grupowej (GROUP_STAGE) NIE łapie się do pucharu', () => {
    const rounds = [runda('1/16', [{ no: 1, home: 'Kanada', away: 'RPA' }])];
    const out = mergePucharScores(rounds, {}, [
      api({ home: 'Canada', away: 'South Africa', homeGoals: 5, awayGoals: 5, stage: 'GROUP_STAGE' }),
    ]);

    expect(out.puch['1']).toBeUndefined();
    expect(out.added).toHaveLength(0);
  });

  it('nie nadpisuje istniejącego wpisu (ręczna nadpiska wygrywa)', () => {
    const rounds = [runda('1/16', [{ no: 1, home: 'Kanada', away: 'RPA' }])];
    const existing = { '1': { home: 1, away: 0 } };
    const out = mergePucharScores(rounds, existing, [
      api({ home: 'Canada', away: 'South Africa', homeGoals: 9, awayGoals: 9 }),
    ]);

    expect(out.puch['1']).toEqual({ home: 1, away: 0 });
    expect(out.added).toHaveLength(0);
  });

  it('FINISHED z remisem bez duration=PENALTY_SHOOTOUT → pomija + warning (niespójność API)', () => {
    const rounds = [runda('1/16', [{ no: 2, home: 'Brazylia', away: 'Japonia' }])];
    const out = mergePucharScores(rounds, {}, [
      api({ home: 'Brazil', away: 'Japan', homeGoals: 1, awayGoals: 1, duration: 'REGULAR' }),
    ]);

    expect(out.puch['2']).toBeUndefined();
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toMatch(/2/);
  });

  it('karne bez winner albo bez regularTime → pomija + warning', () => {
    const rounds = [runda('1/16', [{ no: 3, home: 'Niemcy', away: 'Paragwaj' }])];
    const out = mergePucharScores(rounds, {}, [
      api({
        home: 'Germany',
        away: 'Paraguay',
        homeGoals: 4,
        awayGoals: 5,
        duration: 'PENALTY_SHOOTOUT',
        // brak winner i regularTime/extraTime
      }),
    ]);

    expect(out.puch['3']).toBeUndefined();
    expect(out.warnings).toHaveLength(1);
  });

  it('pomija mecze, które nie są FINISHED', () => {
    const rounds = [runda('1/8', [{ no: 19, home: 'Brazylia', away: 'Norwegia' }])];
    const out = mergePucharScores(rounds, {}, [
      api({ home: 'Brazil', away: 'Norway', status: 'TIMED', stage: 'LAST_16' }),
    ]);

    expect(out.puch['19']).toBeUndefined();
    expect(out.added).toHaveLength(0);
    expect(out.warnings).toHaveLength(0);
  });

  it('runda 1/8 dopasowuje się do stage LAST_16', () => {
    const rounds = [runda('1/8', [{ no: 17, home: 'Kanada', away: 'Maroko' }])];
    const out = mergePucharScores(rounds, {}, [
      api({ home: 'Canada', away: 'Morocco', homeGoals: 0, awayGoals: 3, stage: 'LAST_16', winner: 'AWAY_TEAM' }),
      // Ten sam mecz „wisi" też w LAST_32 (nie powinien się łapać do 1/8):
      api({ home: 'Canada', away: 'Morocco', homeGoals: 9, awayGoals: 9, stage: 'LAST_32' }),
    ]);

    expect(out.puch['17']).toEqual({ home: 0, away: 3 });
  });

  it('rzuca twardym błędem przy nieznanej etykiecie rundy', () => {
    const rounds = [runda('1/128', [{ no: 1, home: 'Kanada', away: 'RPA' }])];
    expect(() => mergePucharScores(rounds, {}, [])).toThrow(/1\/128/);
  });

  it('rzuca twardym błędem przy nieznanej drużynie w fixture’ach', () => {
    const rounds = [runda('1/16', [{ no: 1, home: 'Atlantyda', away: 'RPA' }])];
    expect(() => mergePucharScores(rounds, {}, [])).toThrow(/Atlantyda/);
  });

  it('nie mutuje wejściowego existing', () => {
    const rounds = [runda('1/16', [{ no: 1, home: 'Kanada', away: 'RPA' }])];
    const existing = {};
    const out = mergePucharScores(rounds, existing, [
      api({ home: 'Canada', away: 'South Africa', homeGoals: 1, awayGoals: 0 }),
    ]);

    expect(existing).toEqual({});
    expect(out.puch['1']).toEqual({ home: 1, away: 0 });
  });
});
