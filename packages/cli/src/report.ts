import { CATEGORIES, type Finding } from "@ghostchar/core";
import { lineColumnIndex } from "./io.js";
import { REPO_URL } from "./pkg.js";

// ghostchar has no severity tiers; for SARIF we report every finding at a
// fixed "high" severity (level "error" + GitHub security-severity 8.0).
const SARIF_LEVEL = "error";
const SARIF_SECURITY_SEVERITY = "8.0";

export interface FileResult {
  /** Display path, or `<stdin>`. */
  readonly path: string;
  readonly text: string;
  readonly findings: Finding[];
}

/** Human-readable report. Returns the formatted string. */
export function formatText(results: FileResult[]): string {
  const lines: string[] = [];
  let total = 0;
  for (const { path, text, findings } of results) {
    if (findings.length === 0) continue;
    const at = lineColumnIndex(text);
    lines.push(`\n${path}`);
    for (const f of findings) {
      total += 1;
      const { line, column } = at(f.index);
      lines.push(`  ${line}:${column}  ${f.label.padEnd(8)} ${f.categoryName}`);
    }
  }
  if (total === 0) return "✓ No invisible or dangerous characters found.";
  const fileCount = results.filter((r) => r.findings.length > 0).length;
  lines.push(`\n${total} finding(s) across ${fileCount} file(s).`);
  return lines.join("\n").replace(/^\n/, "");
}

/** Machine-readable JSON report. */
export function formatJson(results: FileResult[]): string {
  const payload = {
    results: results.map(({ path, text, findings }) => {
      const at = lineColumnIndex(text);
      return {
        path,
        findings: findings.map((f) => ({
          ...at(f.index),
          offset: f.index,
          codePoint: f.label,
          category: f.categoryId,
          categoryName: f.categoryName,
        })),
      };
    }),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * SARIF 2.1.0 log for GitHub / Azure code scanning. Every finding is reported
 * at a fixed "high" severity (see {@link SARIF_LEVEL}).
 */
export function formatSarif(results: FileResult[]): string {
  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "ghostchar",
            informationUri: REPO_URL,
            rules: CATEGORIES.map((c) => ({
              id: c.id,
              name: c.name,
              shortDescription: { text: c.name },
              fullDescription: { text: c.description },
              defaultConfiguration: { level: SARIF_LEVEL },
              properties: { "security-severity": SARIF_SECURITY_SEVERITY },
            })),
          },
        },
        results: results.flatMap(({ path, text, findings }) => {
          const at = lineColumnIndex(text);
          return findings.map((f) => {
            const { line, column } = at(f.index);
            return {
              ruleId: f.categoryId,
              level: SARIF_LEVEL,
              message: { text: `${f.categoryName} (${f.label}) detected.` },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: { uri: path },
                    region: {
                      startLine: line,
                      startColumn: column,
                      endColumn: column + f.char.length,
                    },
                  },
                },
              ],
            };
          });
        }),
      },
    ],
  };
  return JSON.stringify(sarif, null, 2);
}

/** True if any file has at least one finding. */
export function hasFindings(results: FileResult[]): boolean {
  return results.some((r) => r.findings.length > 0);
}
