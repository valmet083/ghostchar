/**
 * Decode text hidden by the encode schemes and strip it from the source.
 * One decoder per scheme, plus a {@link decode} dispatcher.
 */

import { SCHEMES, type EncodeScheme } from "./encode.js";
import {
  TAG_BASE,
  TAG_BLOCK_END,
  TAG_PRINTABLE_START,
  TAG_PRINTABLE_END,
  VS_HIGH_BASE,
  VS_HIGH_END,
  VS_LOW_BASE,
  VS_LOW_END,
  ZW_ONE,
  ZW_ZERO,
} from "./codepoints.js";
import { utf8Decode } from "./utf8.js";

export interface DecodeResult {
  /** The recovered payload. */
  readonly hidden: string;
  /** The input with all of this scheme's carrier characters removed. */
  readonly cleaned: string;
  /** Number of carrier codepoints removed. */
  readonly removed: number;
}

/**
 * Decode any Unicode Tag characters (U+E0000–E007F) embedded in `text`.
 * Printable tags are mapped back to their ASCII value; all tag characters
 * (including non-printable control tags) are stripped from `cleaned`.
 */
export function decodeTags(text: string): DecodeResult {
  let hidden = "";
  let cleaned = "";
  let removed = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= TAG_BASE && cp <= TAG_BLOCK_END) {
      removed += 1;
      if (cp >= TAG_PRINTABLE_START && cp <= TAG_PRINTABLE_END) {
        hidden += String.fromCodePoint(cp - TAG_BASE);
      }
      continue;
    }
    cleaned += ch;
  }
  return { hidden, cleaned, removed };
}

/** Map a variation-selector code point back to its byte, or `undefined`. */
function variationSelectorToByte(cp: number): number | undefined {
  if (cp >= VS_LOW_BASE && cp <= VS_LOW_END) return cp - VS_LOW_BASE;
  if (cp >= VS_HIGH_BASE && cp <= VS_HIGH_END) return cp - VS_HIGH_BASE + 16;
  return undefined;
}

/**
 * Decode a variation-selector payload (see {@link encodeVariationSelectors}):
 * each selector is one UTF-8 byte; the bytes are reassembled and UTF-8 decoded.
 */
export function decodeVariationSelectors(text: string): DecodeResult {
  const bytes: number[] = [];
  let cleaned = "";
  let removed = 0;
  for (const ch of text) {
    const byte = variationSelectorToByte(ch.codePointAt(0)!);
    if (byte !== undefined) {
      bytes.push(byte);
      removed += 1;
      continue;
    }
    cleaned += ch;
  }
  return { hidden: utf8Decode(bytes), cleaned, removed };
}

/**
 * Decode a zero-width bit stream (see {@link encodeZeroWidth}): ZWSP=0 / ZWNJ=1,
 * 8 bits per UTF-8 byte (MSB first). Leftover bits (< 8) are ignored.
 */
export function decodeZeroWidth(text: string): DecodeResult {
  const bits: number[] = [];
  let cleaned = "";
  let removed = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp === ZW_ZERO || cp === ZW_ONE) {
      bits.push(cp === ZW_ONE ? 1 : 0);
      removed += 1;
      continue;
    }
    cleaned += ch;
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k]!;
    bytes.push(b);
  }
  return { hidden: utf8Decode(bytes), cleaned, removed };
}

/** Scheme-dispatching decoder mirroring {@link encode}. */
export function decode(text: string, scheme: EncodeScheme = "tags"): DecodeResult {
  switch (scheme) {
    case "tags":
      return decodeTags(text);
    case "variation-selector":
      return decodeVariationSelectors(text);
    case "zero-width":
      return decodeZeroWidth(text);
    default: {
      const _exhaustive: never = scheme;
      throw new RangeError(`unknown decode scheme: ${String(_exhaustive)}`);
    }
  }
}

export interface SchemeDecodeResult extends DecodeResult {
  readonly scheme: EncodeScheme;
}

/**
 * Try every scheme and return those that recovered a non-empty payload.
 * A single text can legitimately carry more than one scheme's payload.
 */
export function decodeAll(text: string): SchemeDecodeResult[] {
  const found: SchemeDecodeResult[] = [];
  for (const scheme of SCHEMES) {
    const result = decode(text, scheme);
    if (result.removed > 0 && result.hidden.length > 0) {
      found.push({ scheme, ...result });
    }
  }
  return found;
}
