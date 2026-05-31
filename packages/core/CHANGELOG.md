# @ghostchar/core

## 1.0.0

First stable release.

- `detect` / `hasInvisible` over six categories of invisible / dangerous
  Unicode characters (unicode-tags, bidi-control, zero-width,
  variation-selector, invisible-operator, non-standard-space).
- `encode` / `decode` with three schemes — `tags` (printable ASCII), and
  `variation-selector` / `zero-width` which carry **any Unicode** (e.g.
  Japanese, emoji) via the UTF-8 byte stream.
- `decodeAll` recovers payloads across every scheme in one call.
- Dependency-free; ships ESM with type declarations.
