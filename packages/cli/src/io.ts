import { readFile, stat } from "node:fs/promises";
import fg from "fast-glob";

/**
 * Largest file ghostchar will read into memory. Detection needs the whole text
 * at once, so this caps memory use and prevents a single huge (or runaway)
 * file from OOM-ing the process. Override with GHOSTCHAR_MAX_BYTES.
 */
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024; // 64 MiB

function maxBytes(): number {
  const raw = process.env.GHOSTCHAR_MAX_BYTES;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_BYTES;
}

/** Read all of stdin as UTF-8 text. */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Expand glob patterns / paths into a sorted list of files. */
export async function expandPaths(patterns: string[]): Promise<string[]> {
  if (patterns.length === 0) return [];
  // fast-glob only understands forward slashes and treats `\` as an escape
  // character, so normalize Windows-style separators before globbing.
  const normalized = patterns.map((p) => p.replace(/\\/g, "/"));
  const matches = await fg(normalized, {
    dot: true,
    onlyFiles: true,
    absolute: false,
    suppressErrors: true,
    // Follow symlinks (fast-glob's default): a detection tool must not silently
    // skip a symlinked source file — a missed file is a scan-gate bypass. This
    // is a read-only reporter, so following a link out of the tree only ever
    // reports findings about a file the caller already pointed us at.
    followSymbolicLinks: true,
  });
  return matches.sort();
}

export async function readFileUtf8(path: string): Promise<string> {
  const limit = maxBytes();
  const { size } = await stat(path);
  if (size > limit) {
    throw new Error(
      `${path} is ${size} bytes, over the ${limit}-byte limit ` +
        `(set GHOSTCHAR_MAX_BYTES to raise it)`,
    );
  }
  return readFile(path, "utf8");
}

/**
 * Build a 1-based offset→{line,column} resolver for `text`. Newline offsets are
 * precomputed once so a caller can resolve many findings without rescanning the
 * file from the start each time (avoids O(findings × filesize)).
 */
export function lineColumnIndex(
  text: string,
): (offset: number) => { line: number; column: number } {
  const newlines: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0x0a) newlines.push(i);
  }
  return (offset) => {
    // Count newlines strictly before `offset` via binary search.
    let lo = 0;
    let hi = newlines.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (newlines[mid]! < offset) lo = mid + 1;
      else hi = mid;
    }
    const lastNewline = lo > 0 ? newlines[lo - 1]! : -1;
    return { line: lo + 1, column: offset - lastNewline };
  };
}
