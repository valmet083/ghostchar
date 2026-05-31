import { classify, formatCodePoint } from "./registry.js";

export interface Finding {
  /** UTF-16 offset into the source string (matches editor positions). */
  readonly index: number;
  /** Unicode codepoint value. */
  readonly codePoint: number;
  /** `U+XXXX` notation. */
  readonly label: string;
  /** The matched character itself (1 or 2 UTF-16 code units). */
  readonly char: string;
  readonly categoryId: string;
  readonly categoryName: string;
}

/**
 * Scan `text` and return every invisible/dangerous character found, in
 * source order. Offsets are UTF-16 based so they map directly onto editor
 * positions and `String.prototype.slice`.
 */
export function detect(text: string): Finding[] {
  const findings: Finding[] = [];
  for (let i = 0; i < text.length; ) {
    const codePoint = text.codePointAt(i)!;
    const char = String.fromCodePoint(codePoint);
    const category = classify(codePoint);
    if (category) {
      findings.push({
        index: i,
        codePoint,
        label: formatCodePoint(codePoint),
        char,
        categoryId: category.id,
        categoryName: category.name,
      });
    }
    i += char.length;
  }
  return findings;
}

/** True if `text` contains at least one flagged character. */
export function hasInvisible(text: string): boolean {
  for (let i = 0; i < text.length; ) {
    const codePoint = text.codePointAt(i)!;
    if (classify(codePoint)) return true;
    i += codePoint > 0xffff ? 2 : 1;
  }
  return false;
}
