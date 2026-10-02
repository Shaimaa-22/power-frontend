// Bounded container validation, not pixel decoding. Input is already capped at 5 MiB.
// No Node APIs, decompression, filesystem or dependencies. See tests/fixtures/README.md.
const ascii = (b, p, n) => String.fromCharCode(...b.subarray(p, p + n));
const be16 = (b, p) => (b[p] << 8) | b[p + 1];
const le16 = (b, p) => b[p] | (b[p + 1] << 8);
const be32 = (b, p) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(p);
const le32 = (b, p) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(p, true);

function jpeg(b) {
  if (b.length < 4 || b[0] !== 255 || b[1] !== 216) return false;
  let p = 2, frame = false, scans = 0, entropy = 0, components = 0;
  const sof = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  while (p < b.length) {
    if (b[p++] !== 255) return false;
    while (b[p] === 255) p++;
    if (p >= b.length) return false;
    const marker = b[p++];
    if (marker === 0xd9) return frame && scans > 0 && entropy > 0 && p === b.length;
    if (marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) return false;
    if (marker === 1) continue; // TEM has no length field.
    if (p + 2 > b.length) return false;
    const length = be16(b, p), end = p + length;
    if (length < 2 || end > b.length) return false;
    if (sof.has(marker)) {
      if (frame || length < 11 || ![8,12,16].includes(b[p + 2]) || !be16(b,p + 3) || !be16(b,p + 5)) return false;
      components = b[p + 7];
      if (!components || length !== 8 + 3 * components) return false;
      frame = true;
    }
    if (marker === 0xda) {
      const count = b[p + 2];
      if (!frame || !count || count > components || length !== 6 + 2 * count) return false;
      scans++;
      p = end;
      let scanBytes = 0;
      while (p < b.length) {
        if (b[p] !== 255) { p++; scanBytes++; continue; }
        const start = p++;
        while (b[p] === 255) p++;
        if (p >= b.length) return false;
        if (b[p] === 0) { p++; scanBytes++; continue; } // byte stuffing
        if (b[p] >= 0xd0 && b[p] <= 0xd7) { p++; continue; }
        p = start; // EOI, another progressive scan, or a table segment
        break;
      }
      if (!scanBytes) return false;
      entropy += scanBytes;
    } else p = end;
  }
  return false;
}

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(b, start, end) {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) crc = crcTable[(crc ^ b[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function png(b) {
  if (b.length < 45 || ![137,80,78,71,13,10,26,10].every((v,i) => b[i] === v)) return false;
  let p = 8, header = false, palette = false, color, idat = false, idatEnded = false, dataBytes = 0;
  while (p + 12 <= b.length) {
    const length = be32(b,p), type = ascii(b,p + 4,4), end = p + 12 + length;
    if (end > b.length || !/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type) || crc32(b,p + 4,end - 4) !== be32(b,end - 4)) return false;
    const d = p + 8;
    if (!header && type !== 'IHDR') return false;
    if (type === 'IHDR') {
      if (header || length !== 13 || !be32(b,d) || !be32(b,d + 4) || be32(b,d) > 0x7fffffff || be32(b,d + 4) > 0x7fffffff) return false;
      color = b[d + 9];
      const depths = { 0:[1,2,4,8,16], 2:[8,16], 3:[1,2,4,8], 4:[8,16], 6:[8,16] };
      if (!depths[color]?.includes(b[d + 8]) || b[d + 10] || b[d + 11] || b[d + 12] > 1) return false;
      header = true;
    } else if (type === 'PLTE') {
      if (palette || idat || !length || length > 768 || length % 3 || [0,4].includes(color)) return false;
      palette = true;
    } else if (type === 'IDAT') {
      if (idatEnded || (color === 3 && !palette)) return false;
      idat = true; dataBytes += length;
    } else if (type === 'IEND') {
      return header && idat && dataBytes >= 6 && length === 0 && end === b.length;
    } else if (!(b[p + 4] & 32)) return false; // unknown critical chunk
    if (idat && type !== 'IDAT') idatEnded = true;
    p = end;
  }
  return false;
}

function gif(b) {
  if (b.length < 14 || !['GIF87a','GIF89a'].includes(ascii(b,0,6)) || !le16(b,6) || !le16(b,8)) return false;
  let p = 13, frames = 0;
  if (b[10] & 128) p += 3 * (1 << ((b[10] & 7) + 1));
  const subBlocks = () => {
    let bytes = 0;
    while (p < b.length) {
      const size = b[p++];
      if (!size) return bytes;
      if (p + size > b.length) return -1;
      p += size; bytes += size;
    }
    return -1;
  };
  while (p < b.length) {
    const type = b[p++];
    if (type === 0x3b) return frames > 0 && p === b.length;
    if (type === 0x21) {
      if (p >= b.length) return false;
      const label = b[p++];
      if (label === 0xf9) {
        if (p + 6 > b.length || b[p] !== 4 || b[p + 5] !== 0) return false;
        p += 6;
      } else if (subBlocks() < 0) return false;
    } else if (type === 0x2c) {
      if (p + 9 > b.length || !le16(b,p + 4) || !le16(b,p + 6)) return false;
      const flags = b[p + 8]; p += 9;
      if (flags & 128) p += 3 * (1 << ((flags & 7) + 1));
      else if (!(b[10] & 128)) return false;
      if (p >= b.length || b[p] < 2 || b[p] > 8) return false;
      p++;
      if (subBlocks() < 2) return false;
      frames++;
    } else return false;
  }
  return false;
}

function webp(b) {
  if (b.length < 20 || ascii(b,0,4) !== 'RIFF' || ascii(b,8,4) !== 'WEBP' || le32(b,4) + 8 !== b.length) return false;
  function chunks(start, end, frame = false) {
    let p = start, images = 0, frames = 0, extended = false, animated = false, animationHeader = false;
    while (p + 8 <= end) {
      const type = ascii(b,p,4), n = le32(b,p + 4), d = p + 8, next = d + n + (n & 1);
      if (next > end || ((n & 1) && b[d + n] !== 0)) return false;
      if (type === 'VP8 ') {
        if (n < 11 || (b[d] & 1) || ascii(b,d + 3,3) !== '\x9d\x01\x2a' || !(le16(b,d + 6) & 0x3fff) || !(le16(b,d + 8) & 0x3fff)) return false;
        const partition = ((b[d] | b[d + 1] << 8 | b[d + 2] << 16) >>> 5);
        if (!partition || partition > n - 10) return false;
        images++;
      } else if (type === 'VP8L') {
        if (n < 6 || b[d] !== 0x2f || (b[d + 4] & 0xe0)) return false;
        images++;
      } else if (type === 'VP8X') {
        if (frame || extended || p !== start || n !== 10 || (b[d] & 0xc1) || b[d + 1] || b[d + 2] || b[d + 3]) return false;
        extended = true; animated = !!(b[d] & 2);
      } else if (type === 'ANIM') {
        if (frame || !animated || animationHeader || n !== 6 || frames || images) return false;
        animationHeader = true;
      } else if (type === 'ANMF') {
        if (frame || !animationHeader || n <= 16 || (b[d + 15] & 0xfc) || !chunks(d + 16,d + n,true)) return false;
        frames++;
      } else if (type === 'ALPH') {
        if (n < 2 || images || (b[d] & 0xc0)) return false;
      } else if (frame) return false;
      p = next;
    }
    return p === end && (animated ? animationHeader && frames > 0 && images === 0 : images === 1 && frames === 0);
  }
  return chunks(12,b.length);
}

// AVIF: validate BMFF boundaries and required image containers/properties.
// Does NOT decode AV1, resolve iloc extents/item references, or validate every HEIF rule.
function avif(b) {
  function boxes(start, end) {
    const result = [];
    let p = start;
    while (p < end) {
      if (result.length >= 4096) return null; // Bound metadata allocations as well as bytes.
      if (p + 8 > end) return null;
      let size = be32(b,p), header = 8;
      if (size === 1) {
        if (p + 16 > end) return null;
        size = be32(b,p + 8) * 4294967296 + be32(b,p + 12); header = 16;
      } else if (size === 0) size = end - p;
      if (!Number.isSafeInteger(size) || size < header || size > end - p) return null;
      result.push({ type:ascii(b,p + 4,4), start:p + header, end:p + size });
      p += size;
    }
    return result;
  }
  const top = boxes(0,b.length);
  if (!top?.length || top[0].type !== 'ftyp') return false;
  const f = top[0], length = f.end - f.start;
  if (length < 8 || length % 4) return false;
  const brands = [ascii(b,f.start,4)];
  for (let p = f.start + 8; p < f.end; p += 4) brands.push(ascii(b,p,4));
  if (!brands.some(x => x === 'avif' || x === 'avis')) return false;
  const mdat = top.some(x => x.type === 'mdat' && x.end > x.start);
  const meta = top.find(x => x.type === 'meta');
  if (meta) {
    if (meta.end - meta.start < 4 || be32(b,meta.start) !== 0) return false;
    const children = boxes(meta.start + 4,meta.end);
    if (!children || !['pitm','iloc','iinf','iprp'].every(t => children.some(x => x.type === t && x.end - x.start >= 4))) return false;
    const iprp = children.find(x => x.type === 'iprp');
    const properties = boxes(iprp.start,iprp.end)?.find(x => x.type === 'ipco');
    const ipco = properties && boxes(properties.start,properties.end);
    const ispe = ipco?.find(x => x.type === 'ispe');
    const av1c = ipco?.find(x => x.type === 'av1C');
    if (!ispe || ispe.end - ispe.start !== 12 || !be32(b,ispe.start + 4) || !be32(b,ispe.start + 8) ||
        !av1c || av1c.end - av1c.start < 4 || b[av1c.start] !== 0x81) return false;
    return mdat || children.some(x => x.type === 'idat' && x.end > x.start);
  }
  const moov = top.find(x => x.type === 'moov');
  const movie = moov && boxes(moov.start,moov.end);
  return brands.includes('avis') && mdat && !!movie?.some(x => x.type === 'trak') && movie.some(x => x.type === 'mvhd');
}

export function hasImageStructure(bytes, mime) {
  const check = { 'image/jpeg':jpeg, 'image/png':png, 'image/gif':gif, 'image/webp':webp, 'image/avif':avif }[mime];
  try { return !!check?.(bytes); } catch { return false; }
}
