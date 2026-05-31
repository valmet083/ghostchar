# @ghostchar/core 👻

Pure, **dependency-free** TypeScript engine to **detect**, **encode**, and
**decode** invisible / dangerous Unicode characters — the ones used for
**ASCII smuggling** (hidden LLM instructions), **Trojan Source** attacks
([CVE-2021-42574](https://nvd.nist.gov/vuln/detail/CVE-2021-42574)), and
**zero-width steganography**.

This is the shared core behind the [`ghostchar`](https://www.npmjs.com/package/ghostchar)
CLI and the ghostchar editor extension.

## Install

```bash
npm install @ghostchar/core
```

## Detect

```ts
import { detect, hasInvisible } from "@ghostchar/core";

const text = "ab" + "\u200B" + "cd"; // a hidden zero-width space at index 2

hasInvisible(text); // true

detect(text);
// [{ index: 2, codePoint: 0x200b, label: "U+200B", char: "\u200B",
//    categoryId: "zero-width", categoryName: "Zero-width character" }]
```

Categories: `unicode-tags`, `bidi-control`, `zero-width`, `variation-selector`,
`invisible-operator`, `non-standard-space`.

## Encode / decode

Three schemes. `tags` is printable-ASCII only; the byte-oriented schemes carry
**any Unicode** (e.g. Japanese, emoji) by operating on the UTF-8 encoding.

```ts
import { encode, decode } from "@ghostchar/core";

const hidden = encode("こんにちは", "variation-selector");
decode(hidden, "variation-selector").hidden; // "こんにちは"

encode("secret", "zero-width");          // ZWSP/ZWNJ bit stream
encode("ascii only", "tags");            // Unicode Tag block (throws on non-ASCII)
```

Direct helpers are also exported: `encodeTags` / `decodeTags`,
`encodeVariationSelectors` / `decodeVariationSelectors`,
`encodeZeroWidth` / `decodeZeroWidth`.

> Defensive & research tool. `encode` reproduces known smuggling techniques so
> detectors, tests, and demos have realistic payloads to work against.
