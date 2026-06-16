import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildResults } from './buildResults';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

// UWAGA: ten test to ground-truth ze spec §9 — liczby zostały ręcznie zweryfikowane
// na stanie danych z 8 rozegranych meczów tury 1. Dlatego czyta ZAMROŻONE fixture'y
// (compute/fixtures/spec9/), a NIE żywe data/k1/*, które rosną z każdym meczem turnieju.
// NIE „naprawiać" tego przez podmianę oczekiwanych liczb pod aktualny output produkcji —
// to zerwałoby weryfikację poprawności silnika. Jeśli zmieni się LOGIKA silnika, zaktualizuj
// liczby ręcznie i opisz dlaczego.
describe('buildResults — sekcja cards (ground truth z tury 1)', () => {
  const out = buildResults(
    read('compute/fixtures/spec9/roster.json'),
    [read('compute/fixtures/spec9/tura-1.json')],
    read('compute/fixtures/spec9/results.json'),
  );

  it('zawiera kartę każdego uczestnika', () => {
    expect(Object.keys(out.cards).length).toBe(out.general.length);
  });

  it('hero wpięty z tabel: generalPos i points = wiersz general', () => {
    const g = out.general.find((r) => r.participantId === 'Talvik')!;
    const c = out.cards.Talvik;
    expect(c.generalPos).toBe(g.position);
    expect(c.points).toBe(g.points); // w niekompletnej fazie grupowej = grI+grII+grIII
  });

  it('Talvik — ręcznie zweryfikowane liczby (spec §9)', () => {
    const c = out.cards.Talvik;
    expect(c.group).toBe('E');
    expect(c.groupPos).toBe(4);
    expect(c.points).toBe(13); // bns=puch=0 → total = dorobek grupowy
    expect(c.celnoscPct).toBe(38);
    expect(c.dokladne).toBe(2);
    expect(c.srPktMecz).toBeCloseTo(1.6, 5);
    expect(c.odwagaPct).toBe(63);
    expect(c.nosRemisowPct).toBe(0);
    expect(c.nosRemisowNd).toBe(false);
    expect(c.seria).toBe(2);
    expect(c.ofensywa).toBeCloseTo(2.0, 5);
    expect(c.pewniak).toBeCloseTo(4.3, 5);
    expect(c.pewniakNd).toBe(false);
    expect(c.ulubionyWynik).toBe('0:2');
    expect(c.zgodnoscPct).toBe(60); // zgoda na REZULTAT 1/X/2 (po zmianie miary; <65 → indywidualista)
    expect(c.osobowosc).toBe('INDYWIDUALISTA');
    expect(c.poTurze2Aktywne).toBe(false);
    expect(c.forma).toBeNull();
    expect(c.najlepszaTura).toBeNull();
  });

  it('DarekJell — ręcznie zweryfikowane liczby (spec §9)', () => {
    const c = out.cards.DarekJell;
    expect(c.points).toBe(21);
    expect(c.celnoscPct).toBe(63);
    expect(c.dokladne).toBe(3);
    expect(c.srPktMecz).toBeCloseTo(2.6, 5);
    expect(c.nosRemisowPct).toBe(100);
    expect(c.nosRemisowNd).toBe(false);
  });
});
