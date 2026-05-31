import { describe, expect, it } from "vitest";
import { detect, hasInvisible } from "../src/detect.js";

// Use \u escapes (never literal invisible characters) so this repo's own
// source scans clean against the ghostchar detector.
const ZWSP = "\u200B";
const RLO = "\u202E"; // RIGHT-TO-LEFT OVERRIDE (Trojan Source)
const NBSP = "\u00A0";
const IDEOGRAPHIC_SPACE = "\u3000";
const TAG_A = "\u{E0041}"; // Unicode Tag for ASCII 'A'

describe("detect", () => {
  it("returns nothing for plain ASCII", () => {
    expect(detect("hello world")).toEqual([]);
    expect(hasInvisible("hello world")).toBe(false);
  });

  it("flags a zero-width space with correct offset and category", () => {
    const text = `ab${ZWSP}cd`;
    const findings = detect(text);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      index: 2,
      codePoint: 0x200b,
      label: "U+200B",
      categoryId: "zero-width",
    });
  });

  it("flags bidi control characters (Trojan Source)", () => {
    const findings = detect(`x${RLO}y`);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.categoryId).toBe("bidi-control");
  });

  it("uses UTF-16 offsets across astral tag characters", () => {
    // A tag character is a surrogate pair (2 UTF-16 units).
    const text = `a${TAG_A}b${ZWSP}c`;
    const findings = detect(text);
    expect(findings.map((f) => f.index)).toEqual([1, 4]);
    expect(findings[0]?.categoryId).toBe("unicode-tags");
    expect(findings[1]?.categoryId).toBe("zero-width");
  });

  it("flags non-standard spaces but not the regular space", () => {
    expect(detect(" ")).toEqual([]);
    const findings = detect(`a${NBSP}b${IDEOGRAPHIC_SPACE}c`);
    expect(findings.map((f) => f.categoryId)).toEqual([
      "non-standard-space",
      "non-standard-space",
    ]);
  });

});
