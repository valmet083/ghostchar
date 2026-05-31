/**
 * Encode visible text into invisible characters.
 *
 * Defensive/research use only: this reproduces known smuggling techniques so
 * that detectors, tests, and demos have realistic payloads to work against.
 *
 * Three schemes are provided:
 *  - `tags`               — printable ASCII → Unicode Tag block (ASCII only).
 *  - `variation-selector` — arbitrary UTF-8 bytes → variation selectors.
 *  - `zero-width`          — arbitrary UTF-8 bytes → zero-width bits.
 *
 * The two byte-oriented schemes carry any Unicode text (e.g. Japanese), since
 * they operate on the UTF-8 encoding rather than on code points directly.
 */

import {
  TAG_BASE,
  VS_HIGH_BASE,
  VS_LOW_BASE,
  ZW_ONE,
  ZW_ZERO,
} from "./codepoints.js";
import { utf8Encode } from "./utf8.js";

/** Every encode/decode scheme, in dispatch order. The single source of truth. */
export const SCHEMES = ["tags", "variation-selector", "zero-width"] as const;

export type EncodeScheme = (typeof SCHEMES)[number];

export class EncodeError extends RangeError {}

/**
 * Encode printable ASCII (`0x20`–`0x7E`) into Unicode Tag characters
 * (U+E0020–U+E007E). The result is invisible but fully recoverable with
 * {@link decodeTags}. Throws {@link EncodeError} on non-ASCII input.
 */
export function encodeTags(input: string): string {
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x20 || cp > 0x7e) {
      throw new EncodeError(
        `encodeTags supports printable ASCII (0x20-0x7E) only; got U+${cp
          .toString(16)
          .toUpperCase()}. Use the "variation-selector" or "zero-width" scheme for arbitrary text.`,
      );
    }
    out += String.fromCodePoint(TAG_BASE + cp);
  }
  return out;
}

/** Map one byte (0–255) to its variation-selector code point. */
function byteToVariationSelector(b: number): number {
  return b < 16 ? VS_LOW_BASE + b : VS_HIGH_BASE + (b - 16);
}

/**
 * Encode arbitrary text (any Unicode) into variation selectors by emitting one
 * selector per UTF-8 byte. Recoverable with {@link decodeVariationSelectors}.
 */
export function encodeVariationSelectors(input: string): string {
  let out = "";
  for (const b of utf8Encode(input)) {
    out += String.fromCodePoint(byteToVariationSelector(b));
  }
  return out;
}

/**
 * Encode arbitrary text (any Unicode) into a zero-width bit stream: each UTF-8
 * byte becomes 8 zero-width characters (MSB first), ZWSP=0 / ZWNJ=1.
 * Recoverable with {@link decodeZeroWidth}.
 */
export function encodeZeroWidth(input: string): string {
  let out = "";
  for (const b of utf8Encode(input)) {
    for (let i = 7; i >= 0; i--) {
      out += String.fromCodePoint((b >> i) & 1 ? ZW_ONE : ZW_ZERO);
    }
  }
  return out;
}

/** Scheme-dispatching entry point. */
export function encode(input: string, scheme: EncodeScheme = "tags"): string {
  switch (scheme) {
    case "tags":
      return encodeTags(input);
    case "variation-selector":
      return encodeVariationSelectors(input);
    case "zero-width":
      return encodeZeroWidth(input);
    default: {
      const _exhaustive: never = scheme;
      throw new EncodeError(`unknown encode scheme: ${String(_exhaustive)}`);
    }
  }
}
