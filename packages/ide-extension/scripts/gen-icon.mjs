// Generates the Marketplace icon (a ghost on a rounded indigo tile) as a PNG,
// with no external dependencies. Rendering is supersampled for antialiasing
// and encoded straight to PNG using Node's built-in zlib.
//
// Usage: node scripts/gen-icon.mjs [size]   (default 256)
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SIZE = Number(process.argv[2]) || 256;
const SS = 4; // supersampling factor per axis
const W = SIZE * SS;
const H = SIZE * SS;

// ---- helpers -------------------------------------------------------------
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [
  lerp(c1[0], c2[0], t),
  lerp(c1[1], c2[1], t),
  lerp(c1[2], c2[2], t),
];

// Palette
const BG_TOP = [0x1e, 0x3a, 0x8a]; // blue-900
const BG_BOT = [0x25, 0x63, 0xeb]; // blue-600
const GHOST = [0x0b, 0x0f, 0x19]; // near-black
const EYE = [0x1e, 0x3a, 0x8a]; // matches bg so eyes "see through"

// Geometry (in supersampled px)
const corner = 0.18 * W; // tile corner radius
const cx = W / 2;
const halfW = 0.255 * W; // ghost half-width
const headTop = 0.20 * H;
const headCy = headTop + halfW; // head circle center y
const bottomBase = 0.74 * H; // where the wavy hem sits
const scallops = 4;
const scallopHW = halfW / scallops; // half-width of one bump
const amp = scallopHW; // bump depth == semicircle

// distance to nearest scallop center along x within [cx-halfW, cx+halfW]
function hemEdge(x) {
  const left = cx - halfW;
  const local = x - left;
  const idx = Math.floor(local / (2 * scallopHW));
  const center = left + (idx * 2 + 1) * scallopHW;
  const d = Math.abs(x - center);
  if (d > scallopHW) return bottomBase;
  return bottomBase + Math.sqrt(scallopHW * scallopHW - d * d) * (amp / scallopHW);
}

function insideGhost(x, y) {
  if (Math.abs(x - cx) > halfW) return false;
  if (y < headCy) {
    const dx = x - cx;
    const dy = y - headCy;
    return dx * dx + dy * dy <= halfW * halfW;
  }
  return y <= hemEdge(x);
}

// eyes
const eyeRx = 0.052 * W;
const eyeRy = 0.072 * H;
const eyeY = headCy - 0.01 * H;
const eyeDx = 0.10 * W;
function insideEye(x, y) {
  for (const sx of [cx - eyeDx, cx + eyeDx]) {
    const nx = (x - sx) / eyeRx;
    const ny = (y - eyeY) / eyeRy;
    if (nx * nx + ny * ny <= 1) return true;
  }
  return false;
}

function insideTile(x, y) {
  const x0 = Math.max(corner - x, x - (W - corner), 0);
  const y0 = Math.max(corner - y, y - (H - corner), 0);
  if (x0 === 0 || y0 === 0) return true;
  return x0 * x0 + y0 * y0 <= corner * corner;
}

// ---- render (supersampled, then box-downsample) --------------------------
const out = Buffer.alloc(SIZE * SIZE * 4);

for (let py = 0; py < SIZE; py++) {
  for (let px = 0; px < SIZE; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const x = px * SS + sx + 0.5;
        const y = py * SS + sy + 0.5;
        let cr = 0, cg = 0, cb = 0, ca = 0;
        if (insideTile(x, y)) {
          const tile = mix(BG_TOP, BG_BOT, clamp01(y / H));
          let col = tile;
          if (insideGhost(x, y)) {
            col = insideEye(x, y) ? EYE : GHOST;
          }
          [cr, cg, cb] = col;
          ca = 255;
        }
        r += cr; g += cg; b += cb; a += ca;
      }
    }
    const n = SS * SS;
    const i = (py * SIZE + px) * 4;
    out[i] = Math.round(r / n);
    out[i + 1] = Math.round(g / n);
    out[i + 2] = Math.round(b / n);
    out[i + 3] = Math.round(a / n);
  }
}

// ---- PNG encode ----------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

// raw scanlines with filter byte 0
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  const ro = y * (SIZE * 4 + 1);
  raw[ro] = 0;
  out.copy(raw, ro + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const idat = deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

const dir = dirname(fileURLToPath(import.meta.url));
const outPath = join(dir, "..", "images", "icon.png");
writeFileSync(outPath, png);
console.log(`wrote ${outPath} (${SIZE}x${SIZE}, ${png.length} bytes)`);
