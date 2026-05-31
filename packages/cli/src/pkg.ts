// Single source of truth for the CLI's version and repo URL: read from the
// shipped package.json at startup so they never drift from the manifest that
// `changeset version` bumps. The bundled binary lives at dist/index.js, so
// package.json is one directory up at runtime.
import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string; repository?: { url?: string } };

export const VERSION = manifest.version;

/** Plain https repo URL (strips the `git+` prefix / `.git` suffix). */
export const REPO_URL = (manifest.repository?.url ?? "")
  .replace(/^git\+/, "")
  .replace(/\.git$/, "");
