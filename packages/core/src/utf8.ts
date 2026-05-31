/**
 * Minimal, dependency-free UTF-8 codec. Used by the byte-oriented encode
 * schemes (variation-selector, zero-width) so the core stays free of the
 * `TextEncoder`/`TextDecoder` web globals and any extra lib in tsconfig.
 */

/** Encode a string to its UTF-8 byte sequence. */
export function utf8Encode(input: string): number[] {
  const bytes: number[] = [];
  for (const ch of input) {
    let cp = ch.codePointAt(0)!;
    // Lone UTF-16 surrogates are not valid scalar values. Map them to U+FFFD
    // (as TextEncoder does) so the encoder never emits a surrogate sequence the
    // strict decoder would later reject — keeping encode/decode in agreement.
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
    if (cp <= 0x7f) {
      bytes.push(cp);
    } else if (cp <= 0x7ff) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp <= 0xffff) {
      bytes.push(
        0xe0 | (cp >> 12),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return bytes;
}

/**
 * Decode a UTF-8 byte sequence back to a string. Malformed sequences are
 * skipped rather than throwing, so partial/garbage input degrades gracefully.
 */
export function utf8Decode(bytes: readonly number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b0 = bytes[i]!;
    let cp: number;
    let len: number;
    // Smallest code point each length is allowed to encode; anything below is an
    // overlong form and must be rejected (rather than silently decoded).
    let min: number;
    if (b0 <= 0x7f) {
      cp = b0;
      len = 1;
      min = 0x00;
    } else if ((b0 & 0xe0) === 0xc0) {
      cp = b0 & 0x1f;
      len = 2;
      min = 0x80;
    } else if ((b0 & 0xf0) === 0xe0) {
      cp = b0 & 0x0f;
      len = 3;
      min = 0x800;
    } else if ((b0 & 0xf8) === 0xf0) {
      cp = b0 & 0x07;
      len = 4;
      min = 0x10000;
    } else {
      i += 1; // stray continuation / invalid leading byte
      continue;
    }
    if (i + len > bytes.length) break;
    let ok = true;
    for (let k = 1; k < len; k++) {
      const bk = bytes[i + k]!;
      if ((bk & 0xc0) !== 0x80) {
        ok = false;
        break;
      }
      cp = (cp << 6) | (bk & 0x3f);
    }
    // Reject malformed continuations, overlong encodings, UTF-16 surrogates
    // (U+D800–DFFF), and out-of-range code points so a lenient decoder can't be
    // used to smuggle bytes past the reveal.
    if (
      !ok ||
      cp < min ||
      (cp >= 0xd800 && cp <= 0xdfff) ||
      cp > 0x10ffff
    ) {
      i += 1;
      continue;
    }
    out += String.fromCodePoint(cp);
    i += len;
  }
  return out;
}
