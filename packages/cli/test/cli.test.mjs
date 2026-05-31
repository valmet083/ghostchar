// Integration tests: spawn the built CLI (dist/index.js) as a subprocess and
// assert on stdout/stderr/exit code. `pretest` builds the CLI first.
//
// Invisible characters are written via \u escapes (never literal) so this
// repo's own source scans clean against the ghostchar detector.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");
const ZWSP = "\u200B";

/** Run the CLI; resolves with { code, stdout, stderr }. */
function run(args, input) {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [CLI, ...args],
      { encoding: "utf8" },
      (err, stdout, stderr) =>
        resolve({ code: err?.code ?? 0, stdout, stderr }),
    );
    if (input !== undefined) {
      child.stdin.end(input);
    }
  });
}

/** Create a temp dir with a clean and a dirty fixture file. */
function fixtures() {
  const dir = mkdtempSync(join(tmpdir(), "ghostchar-cli-"));
  const clean = join(dir, "clean.txt");
  const dirty = join(dir, "dirty.txt");
  writeFileSync(clean, "totally normal text\n", "utf8");
  writeFileSync(dirty, `ab${ZWSP}cd\n`, "utf8");
  return { dir, clean, dirty, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("detect: clean file exits 0 with no findings", async () => {
  const fx = fixtures();
  try {
    const { code, stdout } = await run(["detect", fx.clean]);
    assert.equal(code, 0);
    assert.match(stdout, /No invisible/);
  } finally {
    fx.cleanup();
  }
});

test("detect: dirty file exits 1 and reports the codepoint", async () => {
  const fx = fixtures();
  try {
    const { code, stdout } = await run(["detect", fx.dirty]);
    assert.equal(code, 1);
    assert.match(stdout, /U\+200B/);
    assert.match(stdout, /Zero-width/);
  } finally {
    fx.cleanup();
  }
});

test("detect: --no-fail keeps exit 0 on a dirty file", async () => {
  const fx = fixtures();
  try {
    const { code, stdout } = await run(["detect", fx.dirty, "--no-fail"]);
    assert.equal(code, 0);
    assert.match(stdout, /U\+200B/);
  } finally {
    fx.cleanup();
  }
});

test("detect: --json emits parseable structured output", async () => {
  const fx = fixtures();
  try {
    const { code, stdout } = await run(["detect", fx.dirty, "--json"]);
    assert.equal(code, 1);
    const parsed = JSON.parse(stdout);
    const finding = parsed.results[0].findings[0];
    assert.equal(finding.codePoint, "U+200B");
    assert.equal(finding.category, "zero-width");
    assert.equal(typeof finding.line, "number");
    assert.equal(typeof finding.column, "number");
  } finally {
    fx.cleanup();
  }
});

test("detect: --sarif emits a valid SARIF log with fixed high severity", async () => {
  const fx = fixtures();
  try {
    const { stdout } = await run(["detect", fx.dirty, "--sarif", "--no-fail"]);
    const sarif = JSON.parse(stdout);
    assert.equal(sarif.version, "2.1.0");
    const run0 = sarif.runs[0];
    assert.equal(run0.tool.driver.name, "ghostchar");
    const result = run0.results[0];
    assert.equal(result.ruleId, "zero-width");
    assert.equal(result.level, "error");
    assert.equal(result.locations[0].physicalLocation.region.startLine, 1);
    const rule = run0.tool.driver.rules.find((r) => r.id === "zero-width");
    assert.equal(rule.properties["security-severity"], "8.0");
  } finally {
    fx.cleanup();
  }
});

test("detect: nonexistent path exits 2 with an error", async () => {
  const { code, stderr } = await run(["detect", "does-not-exist-12345.xyz"]);
  assert.equal(code, 2);
  assert.match(stderr, /no files matched/);
});

test(
  "detect: Windows backslash path is normalized and matched",
  { skip: process.platform !== "win32" },
  async () => {
    const fx = fixtures();
    try {
      const backslashPath = fx.dirty.replace(/\//g, "\\");
      const { code, stdout } = await run(["detect", backslashPath]);
      assert.equal(code, 1);
      assert.match(stdout, /U\+200B/);
    } finally {
      fx.cleanup();
    }
  },
);

test("detect: reads stdin via '-'", async () => {
  const { code, stdout } = await run(["detect", "-"], `xy${ZWSP}z`);
  assert.equal(code, 1);
  assert.match(stdout, /U\+200B/);
});

test("encode|decode: round-trips ASCII via stdin", async () => {
  const enc = await run(["encode", "hello"]);
  assert.equal(enc.code, 0);
  const dec = await run(["decode", "-"], enc.stdout.replace(/\n$/, ""));
  assert.equal(dec.code, 0);
  assert.match(dec.stdout, /hello/);
});

test("encode: variation-selector scheme carries Japanese", async () => {
  const enc = await run(["encode", "こんにちは", "--scheme", "variation-selector"]);
  assert.equal(enc.code, 0);
  const dec = await run(["decode", "-"], enc.stdout.replace(/\n$/, ""));
  assert.match(dec.stdout, /こんにちは/);
});

test("encode: tags scheme rejects non-ASCII with exit 2", async () => {
  const { code, stderr } = await run(["encode", "日本語"]);
  assert.equal(code, 2);
  assert.match(stderr, /ASCII/);
});

test("no arguments prints help and exits 0", async () => {
  const { code, stdout } = await run([]);
  assert.equal(code, 0);
  assert.match(stdout, /Usage: ghostchar/);
  assert.match(stdout, /detect|encode|decode/);
});

test("unknown command errors with a help hint", async () => {
  const { code, stderr } = await run(["bogus"]);
  assert.notEqual(code, 0);
  assert.match(stderr, /unknown command/);
  assert.match(stderr, /--help/);
});
