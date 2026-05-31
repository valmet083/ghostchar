import * as vscode from "vscode";
import {
  CATEGORIES,
  decode,
  decodeAll,
  detect,
  encode,
  hasInvisible,
  type CharCategory,
  type EncodeScheme,
  type Finding,
} from "@ghostchar/core";

/** Max decoded payload length shown inline in a hover before truncating. */
const HOVER_PAYLOAD_LIMIT = 500;

const SOURCE = "ghostchar";

/** Category lookup by id, built once. */
const CATEGORY_BY_ID = new Map<string, CharCategory>(
  CATEGORIES.map((c) => [c.id, c]),
);

/** Decode `text` across all schemes and show results in the output channel. */
function decodeAndShow(scope: string, text: string): void {
  const found = decodeAll(text);
  if (found.length === 0) {
    void vscode.window.showInformationMessage(
      `ghostchar: no hidden payload found ${scope}.`,
    );
    return;
  }
  output.clear();
  for (const { scheme, hidden, removed } of found) {
    output.appendLine(`[${scheme}] decoded ${removed} carrier character(s):`);
    output.appendLine(hidden);
    output.appendLine("");
  }
  output.show(true);
}

/** Cache of findings per document, used by the code-action provider. */
const findingsByDoc = new Map<string, Finding[]>();

let decorationType: vscode.TextEditorDecorationType;
let diagnostics: vscode.DiagnosticCollection;
let statusBar: vscode.StatusBarItem;
let output: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext): void {
  decorationType = vscode.window.createTextEditorDecorationType({
    // Theme-aware (adapts to light / dark / high-contrast) via built-in tokens.
    backgroundColor: new vscode.ThemeColor("editorWarning.background"),
    border: "1px solid",
    borderColor: new vscode.ThemeColor("editorWarning.foreground"),
    borderRadius: "2px",
    overviewRulerColor: new vscode.ThemeColor(
      "editorOverviewRuler.warningForeground",
    ),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    // Most flagged characters are zero-width, so a background alone is
    // invisible (and impossible to hover). Render a themed marker before each
    // so it is actually visible and the hover target is reachable.
    before: {
      contentText: "•",
      color: new vscode.ThemeColor("editorWarning.foreground"),
      margin: "0 1px 0 0",
      fontWeight: "bold",
    },
  });
  diagnostics = vscode.languages.createDiagnosticCollection(SOURCE);
  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBar.command = "ghostchar.decodeDocument";
  output = vscode.window.createOutputChannel("ghostchar");

  context.subscriptions.push(
    decorationType,
    diagnostics,
    statusBar,
    output,
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) refresh(editor.document);
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (readConfig(doc.uri).scanOnSave) refresh(doc);
    }),
    vscode.workspace.onDidChangeTextDocument(runPasteGuard),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("ghostchar.automaticWorkspaceScan")) {
        restartAutoScan();
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnostics.delete(doc.uri);
      findingsByDoc.delete(doc.uri.toString());
    }),
    vscode.languages.registerCodeActionsProvider(
      "*",
      new GhostcharCodeActions(),
      { providedCodeActionKinds: GhostcharCodeActions.kinds },
    ),
    vscode.commands.registerCommand("ghostchar.scanWorkspace", scanWorkspace),
    vscode.commands.registerCommand("ghostchar.decodeDocument", decodeDocument),
    vscode.commands.registerCommand(
      "ghostchar.encodeSelection",
      encodeSelection,
    ),
    vscode.commands.registerCommand(
      "ghostchar.decodeSelection",
      decodeSelection,
    ),
  );

  if (vscode.window.activeTextEditor) {
    refresh(vscode.window.activeTextEditor.document);
  }
  restartAutoScan();
}

export function deactivate(): void {
  if (autoScanTimer) clearInterval(autoScanTimer);
  autoScanTimer = undefined;
  findingsByDoc.clear();
}

let autoScanTimer: ReturnType<typeof setInterval> | undefined;

/** (Re)arm the periodic workspace scan from current configuration. */
function restartAutoScan(): void {
  if (autoScanTimer) {
    clearInterval(autoScanTimer);
    autoScanTimer = undefined;
  }
  const cfg = vscode.workspace.getConfiguration("ghostchar");
  if (!cfg.get<boolean>("automaticWorkspaceScan.enabled", false)) return;
  const minutes = Math.max(
    1,
    cfg.get<number>("automaticWorkspaceScan.intervalMinutes", 60),
  );
  autoScanTimer = setInterval(
    () => void scanWorkspace(),
    minutes * 60 * 1000,
  );
}

interface Config {
  enabledCategories: Set<string>;
  pasteGuard: boolean;
  scanOnSave: boolean;
}

function readConfig(scope?: vscode.Uri): Config {
  const cfg = vscode.workspace.getConfiguration("ghostchar", scope);
  const enabled = cfg.get<string[]>(
    "enabledCategories",
    CATEGORIES.map((c) => c.id),
  );
  return {
    enabledCategories: new Set(enabled),
    pasteGuard: cfg.get<boolean>("pasteGuard", true),
    scanOnSave: cfg.get<boolean>("scanOnSave", true),
  };
}

function filteredFindings(text: string, cfg: Config): Finding[] {
  return detect(text).filter((f) => cfg.enabledCategories.has(f.categoryId));
}

/** Build a ghostchar diagnostic for a finding in `document`. */
function toDiagnostic(
  document: vscode.TextDocument,
  f: Finding,
): vscode.Diagnostic {
  const range = new vscode.Range(
    document.positionAt(f.index),
    document.positionAt(f.index + f.char.length),
  );
  const diag = new vscode.Diagnostic(
    range,
    `${f.categoryName} (${f.label})`,
    vscode.DiagnosticSeverity.Warning,
  );
  diag.source = SOURCE;
  diag.code = f.categoryId;
  return diag;
}

function refresh(document: vscode.TextDocument): void {
  if (document.uri.scheme === "output") return;
  const cfg = readConfig(document.uri);
  const text = document.getText();
  const findings = filteredFindings(text, cfg);
  findingsByDoc.set(document.uri.toString(), findings);

  // Decode each decodable scheme present once, so the hover can show the
  // hidden payload inline (the key differentiator) without re-decoding per char.
  const decodedByScheme = new Map<EncodeScheme, string>();
  for (const f of findings) {
    const scheme = CATEGORY_BY_ID.get(f.categoryId)?.scheme;
    if (scheme && !decodedByScheme.has(scheme)) {
      decodedByScheme.set(scheme, decode(text, scheme).hidden);
    }
  }

  const decorations: vscode.DecorationOptions[] = [];
  const diags: vscode.Diagnostic[] = [];

  for (const f of findings) {
    const diag = toDiagnostic(document, f);
    const cat = CATEGORY_BY_ID.get(f.categoryId);
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**ghostchar** · ${f.categoryName} \`${f.label}\``);
    if (cat?.description) md.appendMarkdown(`\n\n${cat.description}`);
    const hidden = cat?.scheme ? decodedByScheme.get(cat.scheme) : undefined;
    if (hidden) {
      md.appendMarkdown(`\n\n**Decoded ${cat!.scheme} payload:**`);
      md.appendCodeblock(
        hidden.length > HOVER_PAYLOAD_LIMIT
          ? hidden.slice(0, HOVER_PAYLOAD_LIMIT) + "…"
          : hidden,
      );
    }
    decorations.push({ range: diag.range, hoverMessage: md });
    diags.push(diag);
  }

  diagnostics.set(document.uri, diags);
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document === document) {
      editor.setDecorations(decorationType, decorations);
    }
  }
  updateStatusBar(document, findings.length);
}

function updateStatusBar(document: vscode.TextDocument, count: number): void {
  const active = vscode.window.activeTextEditor?.document;
  if (active !== document) return;
  if (count === 0) {
    statusBar.hide();
    return;
  }
  statusBar.text = `$(eye-closed) ${count}`;
  statusBar.tooltip = `ghostchar: ${count} invisible/dangerous character(s)`;
  statusBar.show();
}

class GhostcharCodeActions implements vscode.CodeActionProvider {
  static readonly kinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    // Only offer "Decode hidden payload" when the flagged character's scheme
    // actually recovers something from this document. A stray zero-width space
    // (or a ZWJ/BOM that isn't a scheme carrier) decodes to nothing, so the
    // action would be misleading there.
    const text = document.getText();
    const hasPayload = new Map<EncodeScheme, boolean>();
    const relevant: vscode.Diagnostic[] = [];
    for (const diag of context.diagnostics) {
      if (diag.source !== SOURCE || typeof diag.code !== "string") continue;
      const scheme = CATEGORY_BY_ID.get(diag.code)?.scheme;
      if (!scheme) continue;
      let payload = hasPayload.get(scheme);
      if (payload === undefined) {
        payload = decode(text, scheme).hidden.length > 0;
        hasPayload.set(scheme, payload);
      }
      if (payload) relevant.push(diag);
    }
    if (relevant.length === 0) return [];
    const decodeAction = new vscode.CodeAction(
      "Decode hidden payload",
      vscode.CodeActionKind.QuickFix,
    );
    decodeAction.diagnostics = relevant;
    decodeAction.command = {
      command: "ghostchar.decodeDocument",
      title: "Decode hidden payload",
    };
    return [decodeAction];
  }
}

function decodeDocument(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  decodeAndShow("in document", editor.document.getText());
}

async function encodeSelection(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) return;
  const pick = await vscode.window.showQuickPick(
    [
      { label: "tags", description: "Unicode Tag block — printable ASCII only" },
      {
        label: "variation-selector",
        description: "variation selectors — any Unicode (e.g. Japanese, emoji)",
      },
      {
        label: "zero-width",
        description: "zero-width bit stream — any Unicode (e.g. Japanese, emoji)",
      },
    ],
    { placeHolder: "ghostchar: choose an encoding scheme" },
  );
  if (!pick) return;
  const text = editor.document.getText(editor.selection);
  try {
    const encoded = encode(text, pick.label as EncodeScheme);
    await editor.edit((b) => b.replace(editor.selection, encoded));
    void vscode.window.showInformationMessage(
      `ghostchar: selection encoded (${pick.label}).`,
    );
  } catch (err) {
    void vscode.window.showErrorMessage(
      `ghostchar: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function decodeSelection(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) return;
  decodeAndShow("in selection", editor.document.getText(editor.selection));
}

async function scanWorkspace(): Promise<void> {
  const files = await vscode.workspace.findFiles(
    "**/*",
    "**/{node_modules,.git,dist,out}/**",
    5000,
  );
  const cfg = readConfig();
  let total = 0;
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "ghostchar: scanning workspace" },
    async () => {
      for (const uri of files) {
        let doc: vscode.TextDocument;
        try {
          doc = await vscode.workspace.openTextDocument(uri);
        } catch {
          continue; // binary / unreadable
        }
        const findings = filteredFindings(doc.getText(), cfg);
        if (findings.length === 0) {
          diagnostics.delete(uri);
          continue;
        }
        total += findings.length;
        diagnostics.set(
          uri,
          findings.map((f) => toDiagnostic(doc, f)),
        );
      }
    },
  );
  void vscode.window.showInformationMessage(
    `ghostchar: found ${total} flagged character(s) across the workspace.`,
  );
}

function runPasteGuard(event: vscode.TextDocumentChangeEvent): void {
  // Cheap heuristic first (this fires on every keystroke): a paste inserts a
  // multi-character chunk in one change. Only read config once it looks real.
  const suspicious = event.contentChanges.some(
    (c) => c.text.length > 1 && hasInvisible(c.text),
  );
  if (!suspicious) return;
  if (!readConfig(event.document.uri).pasteGuard) return;
  void vscode.window
    .showWarningMessage(
      "ghostchar: inserted text contains invisible/dangerous characters.",
      "Decode",
    )
    .then((choice) => {
      if (choice === "Decode") decodeDocument();
    });
}
