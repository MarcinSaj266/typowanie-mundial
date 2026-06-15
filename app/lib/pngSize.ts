import { closeSync, openSync, readSync } from 'node:fs';

/** Czyta szer./wys. z nagłówka IHDR pliku PNG (bajty 16–23, big-endian). Build-time. */
export function pngSize(absPath: string): { width: number; height: number } {
  const fd = openSync(absPath, 'r');
  try {
    const buf = Buffer.alloc(24);
    readSync(fd, buf, 0, 24, 0);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } finally {
    closeSync(fd);
  }
}
