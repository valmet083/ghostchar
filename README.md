# ghostchar 👻

Detect, encode, and decode **invisible / dangerous Unicode characters** — the
ones used for **ASCII smuggling** (hidden LLM instructions), **Trojan Source**
attacks (CVE-2021-42574), and **zero-width steganography**.

One shared engine, two surfaces:

| Package | What it is |
| --- | --- |
| [`@ghostchar/core`](packages/core) | Dependency-free TypeScript engine: `detect`, `encode`, `decode` (tags / variation-selector / zero-width). |
| [`ghostchar`](packages/cli) | CLI: `detect` invisible characters, `encode` / `decode` Unicode Tag payloads. |
| [`ide-ghostchar`](packages/ide-extension) | Editor extension: inline highlights, diagnostics, hover, quick-fixes, paste guard. Publishable to the VS Code Marketplace and Open VSX. |

> Defensive & research tool. `encode` reproduces known smuggling techniques so
> detectors, tests, and demos have realistic payloads.

## Detected categories

`unicode-tags` · `bidi-control` · `zero-width` · `variation-selector` ·
`invisible-operator` · `non-standard-space`

Every flagged character is treated the same — detected, highlighted, and
warned about. There are no severity tiers.

## Develop

```bash
pnpm install
pnpm build      # builds core, then bundles cli + extension
pnpm test       # runs core unit tests (vitest)
```

### CLI usage

```bash
ghostchar detect "src/**/*.ts"                # exit 1 on any finding (CI gate)
ghostchar detect file.txt --json > out.json   # machine-readable output
ghostchar detect . --sarif --no-fail > ghostchar.sarif   # GitHub code scanning
ghostchar detect "src/**/*.ts" --no-fail      # report only, always exit 0

# encode: --scheme tags (ASCII only, default) | variation-selector | zero-width
ghostchar encode "hidden text"                            # ASCII via Unicode Tags
ghostchar encode "こんにちは" --scheme variation-selector  # any Unicode (Japanese, emoji)
ghostchar encode "秘密" --scheme zero-width                # any Unicode via zero-width bits
echo "secret" | ghostchar encode                          # reads stdin when no arg

# decode tries all schemes by default (or pass --scheme)
ghostchar encode "こんにちは" --scheme zero-width | ghostchar decode -
ghostchar decode file.txt                     # decode any hidden payload in a file
```

### Extension (debug)

Open `packages/ide-extension` and press <kbd>F5</kbd>, or build a `.vsix`:

```bash
pnpm --filter ide-ghostchar package
```

# Educational Purpose

This tool is built for security research and education. Understanding these encoding techniques helps defenders build better detection systems. Use responsibly.
@