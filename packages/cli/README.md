# ghostchar (CLI) 👻

Command-line tool to **detect**, **encode**, and **decode** invisible /
dangerous Unicode characters — the ones used for **ASCII smuggling** (hidden
LLM instructions), **Trojan Source** attacks
([CVE-2021-42574](https://nvd.nist.gov/vuln/detail/CVE-2021-42574)), and
**zero-width steganography**.

## Install

```bash
npm install -g ghostchar
# or run without installing:
npx ghostchar detect "src/**/*.ts"
```

## detect

Scan files (or stdin) and report invisible/dangerous characters. Exits non-zero
when any are found (handy as a CI gate); exits `2` when no files match.

```bash
ghostchar detect "src/**/*.ts"            # exit 1 on any finding
ghostchar detect file.txt --json          # machine-readable output
ghostchar detect . --sarif --no-fail      # SARIF 2.1.0 for code scanning
ghostchar detect "src/**/*.ts" --no-fail  # report only, always exit 0
cat file.txt | ghostchar detect -         # read stdin
```

### GitHub code scanning

`--sarif` emits a SARIF 2.1.0 log; every finding is reported at a fixed
**high** severity. Upload it so findings appear in the repo's Security tab:

```yaml
- run: npx ghostchar detect . --sarif --no-fail > ghostchar.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: ghostchar.sarif
```

## encode / decode

`--scheme tags` (default) is printable-ASCII only; `variation-selector` and
`zero-width` carry **any Unicode** (e.g. Japanese, emoji).

```bash
ghostchar encode "hidden text"                            # ASCII via Unicode Tags
ghostchar encode "こんにちは" --scheme variation-selector  # any Unicode
ghostchar encode "秘密" --scheme zero-width                # any Unicode
echo "secret" | ghostchar encode                          # read stdin

# decode tries all schemes by default (or pass --scheme)
ghostchar encode "こんにちは" --scheme zero-width | ghostchar decode -
ghostchar decode file.txt
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | success / no findings (or `--no-fail`) |
| `1` | `detect` found invisible characters |
| `2` | usage error (bad `--scheme`, no files matched, non-ASCII for `tags`) |

> Defensive & research tool. `encode` reproduces known smuggling techniques so
> detectors, tests, and demos have realistic payloads to work against.
