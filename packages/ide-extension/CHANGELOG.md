# ide-ghostchar

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
