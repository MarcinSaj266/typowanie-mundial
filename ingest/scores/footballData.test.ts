import { describe, it, expect } from 'vitest';
import { withRetry, fetchWorldCupMatches } from './footballData';

/** sleep wstrzykiwany w testach — bez realnego czekania. */
const noSleep = async () => {};

describe('withRetry', () => {
  it('zwraca wynik bez ponawiania, gdy pierwsza próba się powiedzie', async () => {
    let calls = 0;
    const out = await withRetry(async () => {
      calls++;
      return 'ok';
    }, { sleep: noSleep });

    expect(out).toBe('ok');
    expect(calls).toBe(1);
  });

  it('ponawia po błędzie przejściowym i zwraca wynik kolejnej próby', async () => {
    let calls = 0;
    const out = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error('fetch failed');
      return 'ok';
    }, { retries: 3, sleep: noSleep });

    expect(out).toBe('ok');
    expect(calls).toBe(3);
  });

  it('rzuca ostatnim błędem po wyczerpaniu prób', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new Error(`blip ${calls}`);
      }, { retries: 2, sleep: noSleep }),
    ).rejects.toThrow('blip 3');
    // 1 próba + 2 ponowienia = 3 wywołania
    expect(calls).toBe(3);
  });

  it('NIE ponawia błędów oznaczonych retryable=false (np. zły token)', async () => {
    let calls = 0;
    const err = Object.assign(new Error('HTTP 403'), { retryable: false });
    await expect(
      withRetry(async () => {
        calls++;
        throw err;
      }, { retries: 3, sleep: noSleep }),
    ).rejects.toThrow('HTTP 403');
    expect(calls).toBe(1);
  });
});

describe('fetchWorldCupMatches', () => {
  const okResponse = () =>
    new Response(
      JSON.stringify({
        matches: [
          {
            homeTeam: { name: 'Mexico' },
            awayTeam: { name: 'South Africa' },
            score: { fullTime: { home: 2, away: 0 } },
            status: 'FINISHED',
            utcDate: '2026-06-11T19:00:00Z',
          },
        ],
      }),
      { status: 200 },
    );

  it('ponawia przejściowy błąd sieci fetch i zwraca mecze z kolejnej próby', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      if (calls < 2) throw new TypeError('fetch failed');
      return okResponse();
    }) as unknown as typeof fetch;

    const matches = await fetchWorldCupMatches('tok', {
      fetchImpl,
      retry: { sleep: noSleep },
    });

    expect(calls).toBe(2);
    expect(matches).toEqual([
      { home: 'Mexico', away: 'South Africa', homeGoals: 2, awayGoals: 0, status: 'FINISHED', utcDate: '2026-06-11T19:00:00Z' },
    ]);
  });

  it('NIE ponawia odpowiedzi 4xx (zły token) — kończy szybko', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response('forbidden', { status: 403, statusText: 'Forbidden' });
    }) as unknown as typeof fetch;

    await expect(
      fetchWorldCupMatches('zly', { fetchImpl, retry: { sleep: noSleep } }),
    ).rejects.toThrow(/HTTP 403/);
    expect(calls).toBe(1);
  });

  it('ponawia odpowiedź 5xx (błąd serwera) jako przejściową', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      if (calls < 2) return new Response('boom', { status: 503, statusText: 'Service Unavailable' });
      return okResponse();
    }) as unknown as typeof fetch;

    const matches = await fetchWorldCupMatches('tok', { fetchImpl, retry: { sleep: noSleep } });
    expect(calls).toBe(2);
    expect(matches).toHaveLength(1);
  });
});
