import { Command } from "commander";
import {
  decode,
  decodeAll,
  detect,
  encode,
  EncodeError,
  SCHEMES,
  type EncodeScheme,
} from "@ghostchar/core";
import { expandPaths, readFileUtf8, readStdin } from "./io.js";
import { VERSION } from "./pkg.js";
import {
  formatJson,
  formatSarif,
  formatText,
  hasFindings,
  type FileResult,
} from "./report.js";

const program = new Command();

program
  .name("ghostchar")
  .description(
    "Detect, encode, and decode invisible/dangerous Unicode characters.",
  )
  .version(VERSION)
  // On a usage error (unknown command/option, bad argument), print a hint.
  .showHelpAfterError("(run 'ghostchar --help' for usage)");

program
  .command("detect")
  .description("Detect invisible/dangerous Unicode characters in files or stdin")
  .argument("[paths...]", "files or globs; omit or use '-' to read stdin")
  .option("--json", "output machine-readable JSON")
  .option("--sarif", "output SARIF 2.1.0 (for GitHub/Azure code scanning)")
  .option("--no-fail", "exit 0 even when findings exist")
  .action(async (paths: string[], opts) => {
    const results: FileResult[] = (await collect(paths)).map(
      ({ path, text }) => ({ path, text, findings: detect(text) }),
    );

    const format = opts.sarif ? formatSarif : opts.json ? formatJson : formatText;
    process.stdout.write(format(results) + "\n");

    process.exitCode = opts.fail && hasFindings(results) ? 1 : 0;
  });

function parseScheme(value: string): EncodeScheme {
  if ((SCHEMES as readonly string[]).includes(value)) {
    return value as EncodeScheme;
  }
  process.stderr.write(
    `error: invalid --scheme '${value}'. Use one of: ${SCHEMES.join(", ")}\n`,
  );
  process.exit(2);
}

program
  .command("encode")
  .description("Encode text into invisible characters")
  .argument("[text]", "text to encode; omit or use '-' to read stdin")
  .option(
    "--scheme <scheme>",
    `encoding scheme (${SCHEMES.join("|")}); "tags" is ASCII-only, the others carry any Unicode`,
    "tags",
  )
  .option("--verify", "print the round-tripped decode to stderr")
  .action(async (text: string | undefined, opts) => {
    const scheme = parseScheme(opts.scheme);
    const input =
      text !== undefined && text !== "-"
        ? text
        : (await readStdin()).replace(/\r?\n$/, "");
    try {
      const encoded = encode(input, scheme);
      process.stdout.write(encoded + "\n");
      if (opts.verify) {
        process.stderr.write(`decoded: ${decode(encoded, scheme).hidden}\n`);
      }
    } catch (err) {
      if (err instanceof EncodeError) {
        process.stderr.write(`error: ${err.message}\n`);
        process.exitCode = 2;
        return;
      }
      throw err;
    }
  });

program
  .command("decode")
  .description("Decode text hidden by any encode scheme")
  .argument("[paths...]", "files or globs; omit or use '-' to read stdin")
  .option(
    "--scheme <scheme>",
    `decode only this scheme (${SCHEMES.join("|")}); default tries all`,
  )
  .action(async (paths: string[], opts) => {
    const only = opts.scheme ? parseScheme(opts.scheme) : undefined;
    const results = await collect(paths);
    let any = false;
    for (const { path, text } of results) {
      const hits = only
        ? [{ scheme: only, ...decode(text, only) }].filter(
            (h) => h.removed > 0 && h.hidden.length > 0,
          )
        : decodeAll(text);
      for (const { scheme, hidden, removed } of hits) {
        any = true;
        process.stdout.write(
          `${path} [${scheme}]: (${removed} carrier chars)\n${hidden}\n`,
        );
      }
    }
    if (!any) {
      process.stdout.write("✓ No hidden payload found.\n");
    }
  });

async function collect(
  paths: string[],
): Promise<{ path: string; text: string }[]> {
  const useStdin =
    paths.length === 0 || (paths.length === 1 && paths[0] === "-");
  if (useStdin) {
    return [{ path: "<stdin>", text: await readStdin() }];
  }
  const files = await expandPaths(paths);
  if (files.length === 0) {
    process.stderr.write(`error: no files matched: ${paths.join(", ")}\n`);
    process.exit(2);
  }
  const results: { path: string; text: string }[] = [];
  for (const path of files) {
    try {
      results.push({ path, text: await readFileUtf8(path) });
    } catch (err) {
      // One unreadable or over-limit file must not abort the whole batch:
      // warn and keep scanning the rest (mirrors the editor's scanWorkspace).
      process.stderr.write(
        `warning: skipped ${path}: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }
  return results;
}

// With no command at all, show help instead of doing nothing.
if (process.argv.slice(2).length === 0) {
  program.outputHelp();
  process.exit(0);
}

program.parseAsync().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
