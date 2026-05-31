# ghostchar — invisible character guard 👻

Detect and decode **invisible / dangerous Unicode characters** right in
your editor — the ones used for **ASCII smuggling** (hidden LLM instructions),
**Trojan Source** attacks ([CVE-2021-42574](https://nvd.nist.gov/vuln/detail/CVE-2021-42574)),
and **zero-width steganography**.

## Features

- **Highlights & diagnostics** — flagged characters are decorated in the editor
  and reported as warnings in the Problems panel. Files are scanned when opened
  and on save.
- **Hover details** — hover a flagged character to see its category, label,
  why it's dangerous, and — for tag / variation-selector / zero-width carriers —
  the **decoded hidden payload** inline.
- **Quick fix** — *decode the hidden payload* when a decodable character
  (tag / variation-selector / zero-width) is flagged.
- **Paste guard** — warns when pasted/inserted text contains invisible
  characters, with one-click *Decode*.
- **Decode hidden payloads** — recover a hidden payload from the document or a
  selection; all schemes (tags / variation-selector / zero-width) are tried.
- **Encode / decode** — round-trip text to and from invisible characters (for
  building detector tests and demos). Select text and right-click to *Encode
  selection* / *Decode selection*. Encoding offers three schemes: **tags**
  (printable ASCII only), **variation-selector** and **zero-width** (both carry
  any Unicode, e.g. Japanese or emoji).
- **Workspace scan** — sweep the whole workspace on demand, or periodically in
  the background (off by default; configurable interval).

## Detected categories

- `unicode-tags` — Unicode Tag block (ASCII smuggling)
- `bidi-control` — bidirectional overrides (Trojan Source)
- `zero-width` — zero-width spaces / joiners / BOM
- `variation-selector` — variation selectors (steganography)
- `invisible-operator` — invisible math operators / soft hyphen
- `non-standard-space` — look-alike whitespace

Every flagged character is highlighted in the editor and reported as a warning
in the Problems panel — no severity tiers to configure.

## Commands

Open the Command Palette and search for **ghostchar**:

- **Scan workspace for invisible characters**
- **Decode hidden payload (all schemes)**
- **Encode selection to invisible characters** (choose scheme)
- **Decode selection**

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `ghostchar.enabledCategories` | all | Character categories to flag. |
| `ghostchar.pasteGuard` | `true` | Warn when pasted/inserted text contains invisible characters. |
| `ghostchar.scanOnSave` | `true` | Scan a file for invisible/dangerous characters when it is saved. |
| `ghostchar.automaticWorkspaceScan.enabled` | `false` | Periodically scan the whole workspace in the background. |
| `ghostchar.automaticWorkspaceScan.intervalMinutes` | `60` | Minutes between automatic workspace scans (when enabled). |

> Defensive & research tool. `encode` reproduces known smuggling techniques so
> detectors, tests, and demos have realistic payloads.

# Educational Purpose

This tool is built for security research and education. Understanding these encoding techniques helps defenders build better detection systems. Use responsibly.
