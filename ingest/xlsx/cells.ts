/** Numer kolumny (1-based) z liter, np. "A"→1, "AK"→37. */
export function colToIndex(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    n = n * 26 + (col.charCodeAt(i) - 64); // 'A'=65 → 1
  }
  return n;
}

/** Litery kolumny z numeru (1-based), np. 37→"AK". */
export function indexToCol(index: number): string {
  let s = '';
  let n = index;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Rozbija adres A1 na kolumnę i wiersz; rzuca przy złym formacie. */
export function parseRef(ref: string): { col: string; row: number } {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) throw new Error(`Niepoprawny adres komórki: ${ref}`);
  return { col: m[1], row: parseInt(m[2], 10) };
}
