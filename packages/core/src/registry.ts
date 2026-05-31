/**
 * Registry of invisible / dangerous Unicode character categories.
 *
 * This is the single source of truth shared by the CLI and the editor
 * extension. Each category is defined by one or more inclusive codepoint
 * ranges plus metadata used for reporting.
 */

import type { EncodeScheme } from "./encode.js";

/** Inclusive codepoint range `[start, end]`. */
export type CodePointRange = readonly [start: number, end: number];

export interface CharCategory {
  /** Stable machine id, e.g. `"unicode-tags"`. */
  readonly id: string;
  /** Human-readable category name. */
  readonly name: string;
  /** Why this category is risky. */
  readonly description: string;
  readonly ranges: ReadonlyArray<CodePointRange>;
  /** The encode scheme that can recover a hidden payload from this category. */
  readonly scheme?: EncodeScheme;
}

/** Ordered worst-to-least so the first match also reflects priority. */
export const CATEGORIES: ReadonlyArray<CharCategory> = [
  {
    id: "unicode-tags",
    name: "Unicode Tag character",
    description:
      "Tag block (U+E0000–E007F). Invisible; used for ASCII smuggling — hiding instructions to LLMs or exfiltrating data.",
    ranges: [[0xe0000, 0xe007f]],
    scheme: "tags",
  },
  {
    id: "bidi-control",
    name: "Bidirectional control character",
    description:
      "Bidi overrides/embeddings/isolates (U+202A–202E, U+2066–2069). Enables Trojan Source attacks (CVE-2021-42574) where code reads differently than it executes.",
    ranges: [
      [0x202a, 0x202e],
      [0x2066, 0x2069],
    ],
  },
  {
    id: "zero-width",
    name: "Zero-width character",
    description:
      "ZWSP/ZWNJ/ZWJ/BOM/Word-Joiner (U+200B–200D, U+FEFF, U+2060). Invisible; used for steganography, watermarking, and token splitting.",
    ranges: [
      [0x200b, 0x200d],
      [0x2060, 0x2060],
      [0xfeff, 0xfeff],
    ],
    scheme: "zero-width",
  },
  {
    id: "variation-selector",
    name: "Variation selector",
    description:
      "Variation selectors (U+FE00–FE0F, U+E0100–E01EF). Normally modify glyph rendering but can carry hidden steganographic payloads.",
    ranges: [
      [0xfe00, 0xfe0f],
      [0xe0100, 0xe01ef],
    ],
    scheme: "variation-selector",
  },
  {
    id: "invisible-operator",
    name: "Invisible operator / soft hyphen",
    description:
      "Invisible math operators (U+2061–2064) and soft hyphen (U+00AD). Invisible in most contexts; used for obfuscation.",
    ranges: [
      [0x00ad, 0x00ad],
      [0x2061, 0x2064],
    ],
  },
  {
    id: "non-standard-space",
    name: "Non-standard space",
    description:
      "Whitespace that looks like a normal space but is not U+0020 (NBSP, en/em spaces, ideographic space, etc.). Can defeat naive string comparisons.",
    ranges: [
      [0x00a0, 0x00a0],
      [0x1680, 0x1680],
      [0x2000, 0x200a],
      [0x202f, 0x202f],
      [0x205f, 0x205f],
      [0x3000, 0x3000],
    ],
  },
];

/** Return the category a codepoint belongs to, or `undefined` if benign. */
export function classify(codePoint: number): CharCategory | undefined {
  for (const category of CATEGORIES) {
    for (const [start, end] of category.ranges) {
      if (codePoint >= start && codePoint <= end) return category;
    }
  }
  return undefined;
}

/** Format a codepoint as the conventional `U+XXXX` notation. */
export function formatCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}
