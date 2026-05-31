# ide-ghostchar

## 1.0.1

- **Visible markers** — zero-width characters now get an inline marker so they
  are actually visible in the editor and the hover (decoded payload) is
  reachable. Previously a zero-width highlight rendered as nothing.
- **Theme-aware colors** — highlight/marker colors follow the active theme
  (light / dark / high-contrast) instead of a fixed red.
- Unified terminology on **decode** (the "reveal" command is now
  `ghostchar.decodeDocument`, "Decode hidden payload").
- The **decode quick fix** now appears only when the flagged character's scheme
  actually recovers a payload, so a stray zero-width space no longer offers a
  misleading "Decode hidden payload".

## 1.0.0

First stable release.

- Inline highlights + Problems-panel diagnostics for invisible / dangerous
  Unicode characters; scans on open and on save.
- Hover details (including the **decoded hidden payload** inline), a quick fix
  to **decode hidden payloads**, and a paste guard.
- Encode / decode a selection via the right-click menu; encoding offers three
  schemes (tags / variation-selector / zero-width, the latter two carry any
  Unicode such as Japanese or emoji).
- On-demand and optional periodic background workspace scans.
- Published to both the VS Code Marketplace and Open VSX.
