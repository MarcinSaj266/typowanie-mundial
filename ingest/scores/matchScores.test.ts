import { describe, it, expect } from 'vitest';
import { mergeScores, type TurnFixtures, type ApiMatch } from './matchScores';

/** Skrót: jedna tura z podanymi fixture'ami (nazwy PL jak w naszych danych). */
const tura = (turn: number, fixtures: TurnFixtures['fixtures']): TurnFixtures => ({
  turn,
  fixtures,
});

/** Skrót: mecz z API (nazwy EN jak z football-data.org). */
const api = (
  home: string,
  away: string,
  homeGoals: number | null,
  awayGoals: number | null,
  status = 'FINISHED',
): ApiMatch => ({ home, away, homeGoals, awayGoals, status });

describe('mergeScores', () => {
  it('dopasowuje rozegrany mecz po parze i wpisuje wynik w orientacji fixture’a', () => {
    const turns = [tura(1, [{ no: 1, home: 'Meksyk', away: 'RPA' }])];
    const out = mergeScores(turns, {}, [api('Mexico', 'South Africa', 2, 0)]);

    expect(out.results['1']['1']).toEqual({ home: 2, away: 0 });
    expect(out.added).toHaveLength(1);
    expect(out.added[0]).toMatchObject({ turn: 1, no: 1, home: 2, away: 0 });
  });

  it('odwraca wynik, gdy API ma odwrotną orientację gospodarz/gość', () => {
    const turns = [tura(1, [{ no: 1, home: 'Meksyk', away: 'RPA' }])];
    // API: South Africa (dom) 0 : 2 Mexico  → u nas Meksyk(dom) 2 : 0 RPA
    const out = mergeScores(turns, {}, [api('South Africa', 'Mexico', 0, 2)]);

    expect(out.results['1']['1']).toEqual({ home: 2, away: 0 });
  });

  it('pomija mecze, które nie są FINISHED', () => {
    const turns = [tura(1, [{ no: 5, home: 'Katar', away: 'Szwajcaria' }])];
    const out = mergeScores(turns, {}, [api('Qatar', 'Switzerland', null, null, 'TIMED')]);

    expect(out.results['1']).toBeUndefined();
    expect(out.added).toHaveLength(0);
  });

  it('nie nadpisuje istniejącego wyniku (ręczna nadpiska wygrywa)', () => {
    const turns = [tura(1, [{ no: 4, home: 'USA', away: 'Paragwaj' }])];
    const existing = { '1': { '4': { home: 4, away: 1 } } };
    // API podaje inny (błędny) wynik — nie wolno go ruszyć
    const out = mergeScores(turns, existing, [api('United States', 'Paraguay', 0, 0)]);

    expect(out.results['1']['4']).toEqual({ home: 4, away: 1 });
    expect(out.added).toHaveLength(0);
  });

  it('rzuca twardym błędem przy nieznanej drużynie w fixture’ach', () => {
    const turns = [tura(1, [{ no: 1, home: 'Atlantyda', away: 'RPA' }])];
    expect(() => mergeScores(turns, {}, [api('Mexico', 'South Africa', 2, 0)])).toThrow(
      /Atlantyda/,
    );
  });

  it('dokleja tylko brakujące, zostawiając już wpisane', () => {
    const turns = [
      tura(1, [
        { no: 1, home: 'Meksyk', away: 'RPA' },
        { no: 2, home: 'Korea Płd.', away: 'Czechy' },
      ]),
    ];
    const existing = { '1': { '1': { home: 2, away: 0 } } };
    const out = mergeScores(turns, existing, [
      api('Mexico', 'South Africa', 9, 9), // istnieje → nietykalne
      api('South Korea', 'Czechia', 2, 1), // nowe → doklejone
    ]);

    expect(out.results['1']['1']).toEqual({ home: 2, away: 0 });
    expect(out.results['1']['2']).toEqual({ home: 2, away: 1 });
    expect(out.added).toHaveLength(1);
    expect(out.added[0]).toMatchObject({ turn: 1, no: 2 });
  });

  it('ignoruje mecze z API, których nie ma wśród naszych fixture’ów', () => {
    const turns = [tura(1, [{ no: 1, home: 'Meksyk', away: 'RPA' }])];
    const out = mergeScores(turns, {}, [
      api('Mexico', 'South Africa', 2, 0),
      api('Brazil', 'Morocco', 3, 1), // nie ma takiego fixture’a
    ]);

    expect(Object.keys(out.results['1'])).toEqual(['1']);
    expect(out.added).toHaveLength(1);
  });
});
