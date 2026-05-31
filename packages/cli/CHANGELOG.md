# ghostchar

## 1.0.0

First stable release.

- `detect` scans files/stdin and reports invisible/dangerous characters as
  text, `--json`, or **`--sarif`** (SARIF 2.1.0 for GitHub/Azure code
  scanning; every finding reported at a fixed "high" severity).
- Exit `1` on any finding (CI gate), `--no-fail` to always exit `0`, exit `2`
  on usage errors / no files matched.
- `encode` / `decode` with `--scheme tags|variation-selector|zero-width`;
  `decode` tries every scheme by default. Byte-oriented schemes carry any
  Unicode (e.g. Japanese).
- Windows-style paths are normalized for globbing.
