import * as vscode from "vscode";
import {
  BUILT_IN_PATTERNS,
  buildPatternList,
  type CompiledPattern,
  MAX_CLIPBOARD_SIZE_BYTES,
  type PatternDefinition,
} from "./patternRegistry";
import { loadRepoConfig } from "./repoConfig";
import { assessRisk } from "./riskEngine";
import { sanitize } from "./sanitizer";

const POLL_INTERVAL_MS = 200;
const ignoredFiles = new Set<string>();
let lastClipboard = "";
let suppressCount = 0;

export function suppressNextClipboardEvent(): void {
  suppressCount += 1;
}

/** Set of warning message IDs already shown (to avoid repeating on every poll tick). */
const shownWarnings = new Set<string>();

function warnOnce(id: string, message: string): void {
  if (!shownWarnings.has(id)) {
    shownWarnings.add(id);
    vscode.window.showWarningMessage(message);
  }
}

/** Loads all custom pattern definitions from VS Code settings and repo config files. */
function loadCustomPatternDefs(): PatternDefinition[] {
  try {
    const config = vscode.workspace.getConfiguration("safeSend");
    const settingsDefs: PatternDefinition[] =
      config.get<PatternDefinition[]>("customPatterns") ?? [];

    const repoEnabled: boolean = config.get<boolean>("repoConfig.enabled") ?? true;
    const repoFilename: string = config.get<string>("repoConfig.filename") ?? ".safe-send.json";

    const repoDefs: PatternDefinition[] = [];
    if (repoEnabled) {
      const folders = vscode.workspace.workspaceFolders;
      if (folders && folders.length > 0) {
        for (const folder of folders) {
          repoDefs.push(...loadRepoConfig(folder.uri.fsPath, repoFilename));
        }
      }
    }

    return [...repoDefs, ...settingsDefs];
  } catch {
    return [];
  }
}

/** Builds (or refreshes) the active pattern list, with once-only warnings for invalid patterns. */
function buildActivePatterns(): CompiledPattern[] {
  try {
    const customDefs = loadCustomPatternDefs();
    return buildPatternList(customDefs, (msg) => warnOnce(msg, msg));
  } catch {
    return Array.from(BUILT_IN_PATTERNS);
  }
}

export function registerEventManager(context: vscode.ExtensionContext): void {
  let activePatterns = buildActivePatterns();

  // Refresh patterns when VS Code settings change.
  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("safeSend")) {
      activePatterns = buildActivePatterns();
    }
  });
  context.subscriptions.push(configWatcher);

  const interval = setInterval(async () => {
    try {
      const current = await vscode.env.clipboard.readText();

      if (suppressCount > 0) {
        suppressCount -= 1;
        lastClipboard = current;
        return;
      }

      if (!current || current === lastClipboard) {
        return;
      }
      lastClipboard = current;

      // Skip scanning if the clipboard content exceeds the size cap.
      if (Buffer.byteLength(current, "utf8") > MAX_CLIPBOARD_SIZE_BYTES) {
        return;
      }

      const filePath = vscode.window.activeTextEditor?.document.fileName;
      if (filePath && ignoredFiles.has(filePath)) {
        return;
      }

      const result = assessRisk(current, filePath, activePatterns);
      if (result.level === "LOW") {
        return;
      }

      const choice = await vscode.window.showWarningMessage(
        `⚠️ Safe Send: Risk ${result.score}/100 (${result.level}) — ${result.findings.join(", ")}`,
        "Sanitize Clipboard",
        "Allow Copy",
        "Ignore for this file",
      );

      if (choice === "Sanitize Clipboard") {
        const sanitized = sanitize(current, activePatterns);
        suppressNextClipboardEvent();
        await vscode.env.clipboard.writeText(sanitized);
        lastClipboard = sanitized;
        await vscode.window.showInformationMessage("Clipboard sanitized by Safe Send");
        return;
      }

      if (choice === "Ignore for this file" && filePath) {
        ignoredFiles.add(filePath);
      }
    } catch {
      // Never block clipboard flow.
    }
  }, POLL_INTERVAL_MS);

  context.subscriptions.push({
    dispose: () => {
      clearInterval(interval);
    },
  });
}
