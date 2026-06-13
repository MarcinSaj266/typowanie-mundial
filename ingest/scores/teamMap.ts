// Mapowanie nazw drużyn z naszych fixture'ów (polskie) na nazwy z football-data.org
// (angielskie). Wszystkie 48 drużyn MŚ 2026 — potwierdzone zrzutem z API (Krok 0 / spike).
// Brak mapowania = twardy błąd (patrz toApiName), żeby nigdy po cichu nie pominąć meczu.

export const PL_TO_API: Record<string, string> = {
  Meksyk: 'Mexico',
  RPA: 'South Africa',
  'Korea Płd.': 'South Korea',
  Czechy: 'Czechia',
  Kanada: 'Canada',
  'Bośnia i Hercegowina': 'Bosnia-Herzegovina',
  USA: 'United States',
  Paragwaj: 'Paraguay',
  Katar: 'Qatar',
  Szwajcaria: 'Switzerland',
  Brazylia: 'Brazil',
  Maroko: 'Morocco',
  Haiti: 'Haiti',
  Szkocja: 'Scotland',
  Australia: 'Australia',
  Turcja: 'Turkey',
  Niemcy: 'Germany',
  Curacao: 'Curaçao',
  Holandia: 'Netherlands',
  Japonia: 'Japan',
  'Wybrzeże Koś. Słon.': 'Ivory Coast',
  Ekwador: 'Ecuador',
  Szwecja: 'Sweden',
  Tunezja: 'Tunisia',
  Hiszpania: 'Spain',
  'Rep. Ziel. Przylądka': 'Cape Verde Islands',
  Belgia: 'Belgium',
  Egipt: 'Egypt',
  'Arabia Saudyjska': 'Saudi Arabia',
  Urugwaj: 'Uruguay',
  Iran: 'Iran',
  'Nowa Zelandia': 'New Zealand',
  Francja: 'France',
  Senegal: 'Senegal',
  Irak: 'Iraq',
  Norwegia: 'Norway',
  Argentyna: 'Argentina',
  Algieria: 'Algeria',
  Austria: 'Austria',
  Jordania: 'Jordan',
  Portugalia: 'Portugal',
  'DR Konga': 'Congo DR',
  Anglia: 'England',
  Chorwacja: 'Croatia',
  Ghana: 'Ghana',
  Panama: 'Panama',
  Uzbekistan: 'Uzbekistan',
  Kolumbia: 'Colombia',
};

/** Nazwa drużyny w API dla polskiej nazwy z fixture'a. Brak mapowania = błąd. */
export function toApiName(pl: string): string {
  const api = PL_TO_API[pl];
  if (!api) {
    throw new Error(`Brak mapowania drużyny na nazwę API: "${pl}" (uzupełnij ingest/scores/teamMap.ts)`);
  }
  return api;
}
