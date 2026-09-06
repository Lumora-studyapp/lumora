#!/usr/bin/env node
// Lossless image optimisation for Lumora's public assets.
//
//  - PNG: re-encodes with the best per-scanline filter (sum-of-absolute-values
//    heuristic, the same method optipng uses at -o1) and the smallest of five
//    zlib strategies at level 9. Output is verified pixel-identical to the
//    input before it is written.
//  - SVG: strips insignificant whitespace between elements (lossless).
//  - Also renders a 240x240 display copy of the Infant artwork for the
//    milestone bubble (bilinear downscale of the full-quality master).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, 'ascendu');

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

// ── PNG decode (8-bit, non-interlaced: R, RGBA, G, GA) ──────────────────────
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG');
  const chunks = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    chunks.push({ type, data });
    off += 12 + len;
    if (type === 'IEND') break;
  }
  const ihdr = chunks.find(c => c.type === 'IHDR').data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const interlace = ihdr[12];
  if (bitDepth !== 8 || interlace !== 0) throw new Error('Unsupported bit depth/interlace');
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : colorType === 4 ? 2 : (() => { throw new Error('Unsupported color type'); })();

  const raw = zlib.inflateSync(Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data)));
  const stride = width * channels;
  if (raw.length !== stride * height + height) throw new Error(`IDAT length mismatch (${raw.length})`);
  const out = Buffer.alloc(height * stride);
  const prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const ft = raw[p++];
    const row = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = row[x];
      switch (ft) {
        case 0: break;
        case 1: v = (v + a) & 0xff; break;
        case 2: v = (v + b) & 0xff; break;
        case 3: v = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const pae = a + b - c, pa = Math.abs(pae - a), pb = Math.abs(pae - b), pc = Math.abs(pae - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          v = (v + pr) & 0xff;
          break;
        }
        default: throw new Error(`Bad filter ${ft}`);
      }
      cur[x] = v;
    }
    prev.set(cur);
  }
  return { width, height, channels, colorType, bitDepth, raw: out, chunks };
}

// ── PNG encode with optimal per-row filter + best zlib strategy ─────────────
function encodePng(img) {
  const { width, height, channels, colorType, bitDepth } = img;
  const stride = width * channels;
  const filtered = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const cur = img.raw.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? img.raw.subarray((y - 1) * stride, y * stride) : null;
    let best = null;
    let bestScore = Infinity;
    for (let ft = 0; ft <= 4; ft++) {
      const frow = Buffer.alloc(stride + 1);
      frow[0] = ft;
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= channels ? cur[x - channels] : 0;
        const b = prev ? prev[x] : 0;
        const c = prev && x >= channels ? prev[x - channels] : 0;
        let v = cur[x];
        switch (ft) {
          case 0: break;
          case 1: v = cur[x] - a; break;
          case 2: v = cur[x] - b; break;
          case 3: v = cur[x] - ((a + b) >> 1); break;
          case 4: {
            const pae = a + b - c, pa = Math.abs(pae - a), pb = Math.abs(pae - b), pc = Math.abs(pae - c);
            v = cur[x] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
            break;
          }
        }
        frow[x + 1] = v & 0xff;
        score += Math.abs(v);
      }
      if (score < bestScore) { bestScore = score; best = frow; }
    }
    best.copy(filtered, y * (stride + 1));
  }

  const combos = [
    { level: 9, strategy: zlib.constants.Z_DEFAULT_STRATEGY },
    { level: 9, strategy: zlib.constants.Z_FILTERED },
    { level: 9, strategy: zlib.constants.Z_RLE },
    { level: 9, strategy: zlib.constants.Z_HUFFMAN_ONLY },
    { level: 9, strategy: zlib.constants.Z_FIXED },
  ];
  let best = null;
  for (const opts of combos) {
    try {
      const d = zlib.deflateSync(filtered, opts);
      if (!best || d.length < best.length) best = d;
    } catch { /* skip */ }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr)];
  // Preserve ancillary chunks that appear before the first IDAT (e.g. caBX/tEXt).
  for (const c of img.chunks) {
    if (c.type === 'IHDR' || c.type === 'IDAT' || c.type === 'IEND') continue;
    if (img.chunks.findIndex(x => x.type === 'IDAT') > img.chunks.indexOf(c)) parts.push(chunk(c.type, c.data));
  }
  parts.push(chunk('IDAT', best));
  parts.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

// ── Bilinear resize ──────────────────────────────────────────────────────────
function resize(img, tw, th) {
  const { width, height, channels } = img;
  const out = Buffer.alloc(tw * th * channels);
  const sx = width / tw, sy = height / th;
  for (let y = 0; y < th; y++) {
    const fy = (y + 0.5) * sy - 0.5;
    const y0 = Math.max(0, Math.floor(fy));
    const y1 = Math.min(height - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < tw; x++) {
      const fx = (x + 0.5) * sx - 0.5;
      const x0 = Math.max(0, Math.floor(fx));
      const x1 = Math.min(width - 1, x0 + 1);
      const wx = fx - x0;
      for (let c = 0; c < channels; c++) {
        const i0 = (y0 * width + x0) * channels + c;
        const i1 = (y0 * width + x1) * channels + c;
        const i2 = (y1 * width + x0) * channels + c;
        const i3 = (y1 * width + x1) * channels + c;
        const top = img.raw[i0] + (img.raw[i1] - img.raw[i0]) * wx;
        const bottom = img.raw[i2] + (img.raw[i3] - img.raw[i2]) * wx;
        out[(y * tw + x) * channels + c] = Math.round(top + (bottom - top) * wy) & 0xff;
      }
    }
  }
  return { width: tw, height: th, channels, colorType: img.colorType, bitDepth: img.bitDepth, raw: out, chunks: [] };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function losslessPng(file) {
  const before = fs.statSync(file).size;
  const orig = fs.readFileSync(file);
  const img = decodePng(orig);
  const re = encodePng(img);
  const verify = decodePng(re);
  if (!verify.raw.equals(img.raw)) throw new Error(`Pixel mismatch after re-encode: ${file}`);
  fs.writeFileSync(file, re);
  const after = fs.statSync(file).size;
  const pct = before ? (((before - after) / before) * 100).toFixed(1) : '0.0';
  console.log(`PNG  ${path.relative(ROOT, file)}  ${fmt(before)} → ${fmt(after)}  (−${pct}%)  ${img.width}×${img.height}  verified pixel-identical`);
  return after;
}

function minifySvg(file) {
  const before = fs.statSync(file).size;
  const svg = fs.readFileSync(file, 'utf8').trim();
  const min = svg.replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ');
  fs.writeFileSync(file, min + '\n');
  const after = fs.statSync(file).size;
  console.log(`SVG  ${path.relative(ROOT, file)}  ${fmt(before)} → ${fmt(after)}`);
}

function fmt(n) { return n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`; }

// ── Run ──────────────────────────────────────────────────────────────────────
console.log('Compressing Lumora images…\n');

// 1. Lossless PNG re-encode of the source assets.
const MASTER_IMAGES = [
  'Infant.png',
  'Primary school student.png',
  'High school student.png',
  'Uni student.png',
  'School teacher.png',
  'Researcher.png',
  'Professor.png',
  'Scholar.png',
  'Philosopher.png',
  'Sage.png',
];
for (const name of MASTER_IMAGES) {
  losslessPng(path.join(ROOT, 'public', 'Images', name));
}
losslessPng(path.join(ROOT, 'public', 'icon-192.png'));
losslessPng(path.join(ROOT, 'public', 'icon-512.png'));

// 2. Lossless SVG minify.
minifySvg(path.join(ROOT, 'public', 'icon.svg'));

// 3. 240×240 display copies of the stage artwork for the milestone bubbles.
//    Every bubble image follows the same standard (240×240, bilinear downscale
//    of the full-quality master, best-strategy PNG encoding) so every stage
//    bubble stays visually constant with the Infant standard.
function makeDisplayCopy(srcFile, outFile) {
  const smallBuf = encodePng(resize(decodePng(fs.readFileSync(srcFile)), 240, 240));
  fs.writeFileSync(outFile, smallBuf);
  const check = decodePng(smallBuf);
  if (check.width !== 240 || check.height !== 240) throw new Error('Resize produced wrong dimensions');
  console.log(`PNG  ${path.relative(ROOT, outFile)}  created ${fmt(smallBuf.length)}  240×240 (bilinear)`);
}

// Every stage in the progress-level milestone path, in order. The first two
// were already compressed/rendered above — the list below covers ALL stages so
// the 240×240 display standard is applied uniformly across the whole path.
const STAGE_DISPLAY_COPIES = [
  { src:"Infant.png",                  out:"Infant-240.png" },
  { src:"Primary school student.png",  out:"Primary-School-Student-240.png" },
  { src:"High school student.png",     out:"High-School-Student-240.png" },
  { src:"Uni student.png",             out:"Uni-Student-240.png" },
  { src:"School teacher.png",          out:"School-Teacher-240.png" },
  { src:"Researcher.png",              out:"Researcher-240.png" },
  { src:"Professor.png",               out:"Professor-240.png" },
  { src:"Scholar.png",                 out:"Scholar-240.png" },
  { src:"Philosopher.png",             out:"Philosopher-240.png" },
  { src:"Sage.png",                    out:"Sage-240.png" },
];
for (const { src, out } of STAGE_DISPLAY_COPIES) {
  makeDisplayCopy(
    path.join(ROOT, 'public', 'Images', src),
    path.join(ROOT, 'public', 'Images', out)
  );
}

console.log('\nDone.');