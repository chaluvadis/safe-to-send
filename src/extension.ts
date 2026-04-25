import * as vscode from "vscode";
import { registerEventManager, suppressNextClipboardEvent } from "./eventManager";
import {
  BUILT_IN_PATTERNS,
  buildPatternList,
  type CompiledPattern,
  type PatternDefinition,
} from "./patternRegistry";
import { loadRepoConfig } from "./repoConfig";
import { detectSensitiveData, sanitizeSensitiveData } from "./sensitive";

/** Loads all custom pattern definitions from VS Code settings and the repo config file. */
function loadCustomPatternDefs(filePath?: string): PatternDefinition[] {
  const config = vscode.workspace.getConfiguration("safeSend");
  const settingsDefs: PatternDefinition[] = config.get<PatternDefinition[]>("customPatterns") ?? [];

  const repoEnabled: boolean = config.get<boolean>("repoConfig.enabled") ?? true;
  const repoFilename: string = config.get<string>("repoConfig.filename") ?? ".safe-send.json";

  const repoDefs: PatternDefinition[] = [];
  if (repoEnabled) {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      if (filePath) {
        const normalizedFile = filePath.replaceAll("\\", "/");
        const matchingFolder = folders.find((f) =>
          normalizedFile.startsWith(f.uri.fsPath.replaceAll("\\", "/")),
        );
        if (matchingFolder) {
          repoDefs.push(...loadRepoConfig(matchingFolder.uri.fsPath, repoFilename));
        } else {
          for (const folder of folders) {
            repoDefs.push(...loadRepoConfig(folder.uri.fsPath, repoFilename));
          }
        }
      } else {
        for (const folder of folders) {
          repoDefs.push(...loadRepoConfig(folder.uri.fsPath, repoFilename));
        }
      }
    }
  }

  return [...repoDefs, ...settingsDefs];
}

/** Builds the active pattern list for a given file path. */
function getPatterns(filePath?: string): CompiledPattern[] {
  try {
    const customDefs = loadCustomPatternDefs(filePath);
    return buildPatternList(customDefs);
  } catch {
    // Fall back to built-ins so detection still works even if config loading fails.
    return Array.from(BUILT_IN_PATTERNS);
  }
}

/**
 * Executes the Safe Send scan and copy command.
 * Can be invoked from command palette or context menu.
 */
async function executeScanAndCopyForAI(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    await vscode.window.showInformationMessage("No active editor found");
    return;
  }

  const text = editor.selection.isEmpty
    ? editor.document.getText()
    : editor.document.getText(editor.selection);

  if (!text) {
    await vscode.window.showInformationMessage("No text available to scan");
    return;
  }

  const filePath = editor.document.fileName;
  const patterns = getPatterns(filePath);
  const detectedTypes = detectSensitiveData(text, patterns);

  if (detectedTypes.length === 0) {
    suppressNextClipboardEvent();
    await vscode.env.clipboard.writeText(text);
    await vscode.window.showInformationMessage("No sensitive data detected");
    return;
  }

  const choice = await vscode.window.showWarningMessage(
    `Sensitive data detected: ${detectedTypes.join(", ")}`,
    "Sanitize & Copy",
    "Copy Anyway",
    "Cancel",
  );

  if (choice === "Sanitize & Copy") {
    suppressNextClipboardEvent();
    await vscode.env.clipboard.writeText(sanitizeSensitiveData(text, patterns));
    await vscode.window.showInformationMessage("Sanitized text copied to clipboard");
    return;
  }

  if (choice === "Copy Anyway") {
    suppressNextClipboardEvent();
    await vscode.env.clipboard.writeText(text);
    await vscode.window.showWarningMessage("Original text copied to clipboard");
  }
}

export function activate(context: vscode.ExtensionContext): void {
  // Register command for command palette and context menu
  const command = vscode.commands.registerCommand(
    "safeSend.scanAndCopyForAI",
    executeScanAndCopyForAI,
  );

  context.subscriptions.push(command);
  registerEventManager(context);
}

export function deactivate(): void {}
