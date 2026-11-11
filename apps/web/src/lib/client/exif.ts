/**
 * Removes GPS data from a JPEG in place (same byte length, so the declared size stays valid).
 * Finds the EXIF APP1 segment, follows IFD0's GPSInfo pointer (tag 0x8825), zeroes the GPS IFD
 * entries and any out-of-line values, then neutralises the pointer. Orientation and other tags stay.
 */
export function stripJpegGps(buf: ArrayBuffer): ArrayBuffer {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return buf;
  let off = 2;
  while (off + 4 < v.byteLength) {
    if (v.getUint8(off) !== 0xff) break;
    const marker = v.getUint8(off + 1);
    const len = v.getUint16(off + 2);
    if (marker === 0xda || marker === 0xd9) break; // start of scan: no more metadata
    if (marker === 0xe1 && off + 10 < v.byteLength && v.getUint32(off + 4) === 0x45786966 /* "Exif" */) {
      try {
        stripTiffGps(v, off + 10, off + 2 + len);
      } catch {
        /* malformed EXIF: leave untouched */
      }
    }
    off += 2 + len;
  }
  return buf;
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function stripTiffGps(v: DataView, tiff: number, end: number) {
  const le = v.getUint16(tiff) === 0x4949;
  const u16 = (o: number) => v.getUint16(o, le);
  const u32 = (o: number) => v.getUint32(o, le);
  const ifd0 = tiff + u32(tiff + 4);
  const n = u16(ifd0);
  for (let i = 0; i < n; i++) {
    const e = ifd0 + 2 + i * 12;
    if (u16(e) !== 0x8825) continue;
    const gps = tiff + u32(e + 8);
    if (gps + 2 > end) return;
    const count = u16(gps);
    for (let j = 0; j < count; j++) {
      const ge = gps + 2 + j * 12;
      if (ge + 12 > end) break;
      const size = (TYPE_SIZE[u16(ge + 2)] || 1) * u32(ge + 4);
      if (size > 4) {
        const at = tiff + u32(ge + 8);
        for (let k = 0; k < size && at + k < end; k++) v.setUint8(at + k, 0);
      }
      for (let k = 0; k < 12; k++) v.setUint8(ge + k, 0);
    }
    v.setUint16(gps, 0, le);
    // Turn the pointer into a harmless private tag with value 0.
    v.setUint16(e, 0xc000, le);
    v.setUint32(e + 8, 0, le);
    return;
  }
}
