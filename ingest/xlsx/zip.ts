import { inflateRawSync } from 'node:zlib';

/**
 * Rozpakowuje archiwum ZIP (np. .xlsx) → mapa: nazwa wpisu → zawartość (Buffer).
 * Idzie przez central directory, więc poprawnie obsługuje wpisy z data-descriptor.
 */
export function unzip(buf: Buffer): Map<string, Buffer> {
  const EOCD_SIG = 0x06054b50;
  const CEN_SIG = 0x02014b50;

  // EOCD szukamy od końca (komentarz archiwum zwykle pusty).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Nieprawidłowy ZIP: brak EOCD');

  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16); // offset central directory

  const entries = new Map<string, Buffer>();
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(off) !== CEN_SIG) {
      throw new Error('Nieprawidłowy wpis central directory');
    }
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);

    // Realne długości nazwy/extra czytamy z nagłówka lokalnego (mogą się różnić).
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    entries.set(name, method === 0 ? Buffer.from(raw) : inflateRawSync(raw));

    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
