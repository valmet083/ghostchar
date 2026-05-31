/**
 * Carrier code points shared by the encode and decode schemes, so the two
 * sides of each round-trip provably agree on the same ranges.
 */

// Unicode Tag block: ASCII `c` (0x20–0x7E) maps to `TAG_BASE + c`.
export const TAG_BASE = 0xe0000;
export const TAG_BLOCK_END = 0xe007f;
export const TAG_PRINTABLE_START = 0xe0020; // tag of ASCII 0x20 (space)
export const TAG_PRINTABLE_END = 0xe007e; // tag of ASCII 0x7E (~)

// Variation selectors: byte 0–15 → U+FE00–FE0F, 16–255 → U+E0100–E01EF.
export const VS_LOW_BASE = 0xfe00;
export const VS_LOW_END = 0xfe0f;
export const VS_HIGH_BASE = 0xe0100;
export const VS_HIGH_END = 0xe01ef;

// Zero-width bits: bit 0 → ZWSP, bit 1 → ZWNJ.
export const ZW_ZERO = 0x200b; // ZERO WIDTH SPACE
export const ZW_ONE = 0x200c; // ZERO WIDTH NON-JOINER
