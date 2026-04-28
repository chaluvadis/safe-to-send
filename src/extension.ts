import * as vscode from "vscode";
import { registerEventManager } from "./eventManager";
import { BUILT_IN_PATTERNS, compilePattern, type CompiledPattern } from "./patternRegistry";
import { loadRepoConfig } from "./repoConfig";
import { assessRisk } from "./riskEngine";
import { sanitize } from "./sanitizer";
import { detectSensitiveData, detectSensitiveDataWithRanges } from "./sensitive";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Checks if a file path matches any of the user-configured exclude glob patterns.
 */
function isFileExcluded(filePath: string): boolean {
  const config = vscode.workspace.getConfiguration("safeSend");
  const excludeGlobs: string[] = config.get("excludeGlobs", []);
  if (excludeGlobs.length === 0) return false;

  const normalized = filePath.replaceAll("\\", "/");

  for (const pattern of excludeGlobs) {
    // Convert glob pattern to a RegExp
    // Escape regex special chars, then handle * and **
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    const regexStr =
      "^" +
      escaped
        .replace(/\\\*\\\*/g, ".*") // ** matches any number of path segments
        .replace(/\\\*/g, "[^/]*") // * matches within a segment
        .replace(/\\\?/g, ".") +
      "$";
    try {
      const regex = new RegExp(regexStr);
      if (regex.test(normalized)) {
        return true;
      }
    } catch {
      // Invalid pattern, skip
      continue;
    }
  }
  return false;
}

export function activate(context: vscode.ExtensionContext) {
  console.log("Safe Send extension is now active!");

  // Create status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = "safeSend.scanAndCopyForAI";
  context.subscriptions.push(statusBarItem);

  // Create diagnostic collection for inline warnings
  const diagnostics = vscode.languages.createDiagnosticCollection("safeSend");
  context.subscriptions.push(diagnostics);

  // Register main command
  context.subscriptions.push(
    vscode.commands.registerCommand("safeSend.scanAndCopyForAI", async () => {
      await handleScanAndCopy(context);
    }),
  );

  // Register sanitize commands
  context.subscriptions.push(
    vscode.commands.registerCommand("safeSend.sanitizeSelection", async () => {
      await handleSanitizeSelection(context);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("safeSend.sanitizeFile", async () => {
      await handleSanitizeFile(context);
    }),
  );

  // Register pre-commit hook installer
  context.subscriptions.push(
    vscode.commands.registerCommand("safeSend.installPreCommitHook", async () => {
      await installPreCommitHook(context);
    }),
  );

  // Register sanitize match command (used by code actions)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "safeSend.sanitizeMatch",
      async (uri: vscode.Uri, range: vscode.Range, patternId: string) => {
        await handleSanitizeMatch(uri, range, patternId);
      },
    ),
  );

  // Register code action provider
  const codeActionProvider = new SafeSendCodeActionProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { scheme: "file", language: "*" },
      codeActionProvider,
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
  );

  // Set up clipboard monitoring
  registerEventManager(context);

  // Event listeners for diagnostics and status bar
  const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(() => {
    updateStatusBar(context, statusBarItem);
    updateDiagnosticsForActiveEditor(diagnostics);
  });
  context.subscriptions.push(onDidChangeActiveTextEditor);

  const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document === vscode.window.activeTextEditor?.document) {
      updateDiagnostics(diagnostics, event.document);
    }
  });
  context.subscriptions.push(onDidChangeTextDocument);

  const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument((doc) => {
    updateDiagnosticsForDocument(diagnostics, doc);
  });
  context.subscriptions.push(onDidOpenTextDocument);

  const onDidCloseTextDocument = vscode.workspace.onDidCloseTextDocument((doc) => {
    diagnostics.delete(doc.uri);
  });
  context.subscriptions.push(onDidCloseTextDocument);

  // Initial updates
  updateStatusBar(context, statusBarItem);
  updateDiagnosticsForActiveEditor(diagnostics);

  console.log("Safe Send: All components initialized");
}

export function deactivate() {
  console.log("Safe Send extension deactivated");
}

// ==================== STATUS BAR ====================

async function updateStatusBar(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem,
) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    statusBarItem.hide();
    return;
  }

  const filePath = editor.document.fileName;

  // Skip excluded files
  if (isFileExcluded(filePath)) {
    statusBarItem.hide();
    return;
  }

  const text = editor.document.getText();
  const MAX_SIZE = 200 * 1024;
  if (Buffer.byteLength(text, "utf8") > MAX_SIZE) {
    statusBarItem.text = "$(warning) Safe Send: File too large";
    statusBarItem.tooltip = "File exceeds 200KB scanning limit";
    statusBarItem.color = undefined;
    statusBarItem.show();
    return;
  }

  try {
    const customPatternDefs = loadRepoConfig(
      vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath || "",
    );
    const { compilePattern } = await import("./patternRegistry");
    const customPatterns = customPatternDefs
      .map((def) => compilePattern(def))
      .filter((p): p is CompiledPattern => p !== null);
    const allPatterns = [...BUILT_IN_PATTERNS, ...customPatterns];
    const riskResult = assessRisk(text, filePath, allPatterns);
    const { score, level, findings } = riskResult;

    let color: string;
    switch (level) {
      case "HIGH":
        color = "#f14c4c";
        break;
      case "MEDIUM":
        color = "#cca700";
        break;
      case "LOW":
        color = "#8dc891";
        break;
      default:
        color = "#8dc891";
    }

    const findingCount = findings.length;
    statusBarItem.text = `$(shield) Safe Send: ${level} (${score})`;
    statusBarItem.tooltip = `Sensitive data risk: ${level}. ${findingCount} finding(s). Click to scan and copy.`;
    statusBarItem.color = new vscode.ThemeColor(color);
    statusBarItem.show();
  } catch (error) {
    console.error("Error updating status bar:", error);
    statusBarItem.hide();
  }
}

// ==================== DIAGNOSTICS ====================

function updateDiagnosticsForActiveEditor(diagnostics: vscode.DiagnosticCollection) {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    updateDiagnostics(diagnostics, editor.document);
  } else {
    diagnostics.clear();
  }
}

async function updateDiagnosticsForDocument(diagnostics: vscode.DiagnosticCollection, document: vscode.TextDocument) {
  await updateDiagnostics(diagnostics, document);
}

async function updateDiagnostics(
  diagnostics: vscode.DiagnosticCollection,
  document: vscode.TextDocument,
) {
  const text = document.getText();
  const MAX_SIZE = 200 * 1024;
  if (Buffer.byteLength(text, "utf8") > MAX_SIZE) {
    diagnostics.set(document.uri, []);
    return;
  }

  // Skip excluded files
  if (isFileExcluded(document.fileName)) {
    diagnostics.set(document.uri, []);
    return;
  }

  try {
    const workspacePath = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || "";
    const customPatternDefs = loadRepoConfig(workspacePath);
    const customPatterns = customPatternDefs
      .map((def) => compilePattern(def))
      .filter((p): p is CompiledPattern => p !== null);
    const allPatterns = [...BUILT_IN_PATTERNS, ...customPatterns];

    const sensitiveMatches = detectSensitiveDataWithRanges(text, allPatterns);

    const diags: vscode.Diagnostic[] = sensitiveMatches.map((match) => {
      const range = new vscode.Range(
        document.positionAt(match.start),
        document.positionAt(match.end),
      );
      const diagnostic = new vscode.Diagnostic(
        range,
        `Sensitive data detected: ${match.label}`,
        vscode.DiagnosticSeverity.Warning,
      );
      diagnostic.code = match.patternId;
      diagnostic.source = "Safe Send";
      return diagnostic;
    });

    diagnostics.set(document.uri, diags);
  } catch (error) {
    console.error("Error computing diagnostics:", error);
    diagnostics.set(document.uri, []);
  }
}

// ==================== CODE ACTIONS ====================

class SafeSendCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    // Only provide actions for Safe Send diagnostics
    const safeSendDiagnostics = context.diagnostics.filter(
      (d) => d.source === "Safe Send",
    );
    if (safeSendDiagnostics.length === 0) {
      return undefined;
    }

    // Action: Sanitize this specific match
    for (const diag of safeSendDiagnostics) {
      const action = new vscode.CodeAction(
        `Sanitize "${diag.message}"`,
        vscode.CodeActionKind.QuickFix,
      );
      action.command = {
        command: "safeSend.sanitizeMatch",
        title: `Sanitize this ${diag.code}`,
        arguments: [document.uri, diag.range, diag.code],
      };
      actions.push(action);
    }

    // Action: Sanitize entire document
    const sanitizeDocAction = new vscode.CodeAction(
      "Sanitize entire document",
      vscode.CodeActionKind.QuickFix,
    );
    sanitizeDocAction.command = {
      command: "safeSend.sanitizeFile",
      title: "Sanitize entire document",
      arguments: [document.uri],
    };
    actions.push(sanitizeDocAction);

    return actions;
  }
}

// ==================== COMMAND HANDLERS ====================

async function handleSanitizeSelection(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor");
    return;
  }

  const selection = editor.selection;
  const text = editor.document.getText(selection);
  if (!text) {
    vscode.window.showWarningMessage("No text selected");
    return;
  }

  try {
    const customPatternDefs = loadRepoConfig(
      vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath || "",
    );
    const { compilePattern } = await import("./patternRegistry");
    const customPatterns = customPatternDefs
      .map((def) => compilePattern(def))
      .filter((p): p is CompiledPattern => p !== null);
    const allPatterns = [...BUILT_IN_PATTERNS, ...customPatterns];

    const sanitized = sanitize(text, allPatterns);
    if (sanitized === text) {
      vscode.window.showInformationMessage("No sensitive data found in selection");
      return;
    }

    await editor.edit((editBuilder) => {
      editBuilder.replace(selection, sanitized);
    });

    vscode.window.showInformationMessage("Selection sanitized successfully");
  } catch (error) {
    console.error("Error sanitizing selection:", error);
    vscode.window.showErrorMessage("Failed to sanitize selection");
  }
}

async function handleSanitizeFile(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor");
    return;
  }

  const document = editor.document;
  const filePath = document.fileName;

  // Skip if file is excluded
  if (isFileExcluded(filePath)) {
    vscode.window.showInformationMessage("File is excluded by Safe Send settings and will not be sanitized.");
    return;
  }

  const text = document.getText();

  try {
    const customPatternDefs = loadRepoConfig(
      vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || "",
    );
    const { compilePattern } = await import("./patternRegistry");
    const customPatterns = customPatternDefs
      .map((def) => compilePattern(def))
      .filter((p): p is CompiledPattern => p !== null);
    const allPatterns = [...BUILT_IN_PATTERNS, ...customPatterns];

    const sanitized = sanitize(text, allPatterns);
    if (sanitized === text) {
      vscode.window.showInformationMessage("No sensitive data found in file");
      return;
    }

    // Apply full document edit
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(text.length),
    );
    await editor.edit((editBuilder) => {
      editBuilder.replace(fullRange, sanitized);
    });

    vscode.window.showInformationMessage("File sanitized successfully");
  } catch (error) {
    console.error("Error sanitizing file:", error);
    vscode.window.showErrorMessage("Failed to sanitize file");
  }
}

// Code action handler: sanitizes a single match (called from code action command)
async function handleSanitizeMatch(uri: vscode.Uri, range: vscode.Range, patternId: string) {
  const workspacePath = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath || "";
  const customPatternDefs = loadRepoConfig(workspacePath);
  const customPatterns = customPatternDefs
    .map((def) => compilePattern(def))
    .filter((p): p is CompiledPattern => p !== null);
  const allPatterns = [...BUILT_IN_PATTERNS, ...customPatterns];
  const pattern = allPatterns.find(p => p.id === patternId);
  if (!pattern) {
    vscode.window.showErrorMessage(`Pattern not found: ${patternId}`);
    return;
  }

  const editor = await vscode.window.showTextDocument(uri);
  await editor.edit(edit => {
    edit.replace(range, pattern.placeholder);
  });
}

async function handleScanAndCopy(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor found");
    return;
  }

  try {
    const document = editor.document;
    const selection = editor.selection;
    const text = selection.isEmpty ? document.getText() : document.getText(selection);

    if (!text || text.trim().length === 0) {
      vscode.window.showWarningMessage("No text to scan");
      return;
    }

    if (Buffer.byteLength(text, "utf8") > 200 * 1024) {
      vscode.window.showWarningMessage("File too large for scanning (max 200KB)");
      return;
    }

    const customPatternDefs = loadRepoConfig(
      vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || "",
    );

    const { compilePattern } = await import("./patternRegistry");
    const customPatterns = customPatternDefs
      .map((def) => compilePattern(def))
      .filter((p): p is CompiledPattern => p !== null);

    const allPatterns = [...BUILT_IN_PATTERNS, ...customPatterns];
    const detected = detectSensitiveData(text, allPatterns);
    const riskResult = assessRisk(text, document.fileName, allPatterns);
    const riskScore = riskResult.score;

    let action = "copy-raw";

    if (detected.length > 0) {
      action = await showSanitizationDialog(detected, riskScore);
    }

    switch (action) {
      case "copy-sanitized": {
        const sanitized = sanitize(text, allPatterns);
        await copyToClipboard(sanitized);
        vscode.window.showInformationMessage(
          `Text copied safely (${detected.length} items sanitized)`,
        );
        break;
      }

      case "copy-raw":
        await copyToClipboard(text);
        if (detected.length > 0) {
          const riskLevel =
            riskScore >= 60 ? "HIGH RISK " : riskScore >= 30 ? "MEDIUM RISK ⚠️" : "LOW RISK ℹ️";
          vscode.window.showWarningMessage(`Copied with sensitive data (${riskLevel})`);
        }
        break;

      case "cancel":
        break;
    }
  } catch (error) {
    console.error("Error in scanAndCopy:", error);
    vscode.window.showErrorMessage("Safe Send: An error occurred during scanning");
  }
}

async function showSanitizationDialog(
  detected: string[],
  riskScore: number,
): Promise<"copy-sanitized" | "copy-raw" | "cancel"> {
  const riskLevel =
    riskScore >= 60 ? "HIGH RISK " : riskScore >= 30 ? "MEDIUM RISK ⚠️" : "LOW RISK ℹ️";

  const items: { label: string; description: string; detail: string; action: "copy-sanitized" | "copy-raw" | "cancel" }[] = [
    {
      label: "Sanitize & Copy",
      description: "Replace sensitive data with placeholders",
      detail: `Detected ${detected.length} sensitive pattern(s) | ${riskLevel}`,
      action: "copy-sanitized",
    },
    {
      label: "Copy Anyway",
      description: "Copy original text with warning",
      detail: "Bypass sanitization (not recommended)",
      action: "copy-raw",
    },
    {
      label: "Cancel",
      description: "Do not copy",
      detail: "Close this dialog",
      action: "cancel",
    },
  ];

  const pick = await vscode.window.showQuickPick(items, {
    title: "Safe Send - Sensitive Data Detected",
    placeHolder: "Choose how to handle the sensitive data",
    matchOnDescription: true,
    matchOnDetail: true,
  });

  return pick ? pick.action : "cancel";
}

async function copyToClipboard(text: string) {
  await vscode.env.clipboard.writeText(text);
}

// ==================== PRE-COMMIT HOOK ====================

async function installPreCommitHook(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showWarningMessage("No workspace folder open");
    return;
  }

  const repoPath = workspaceFolder.uri.fsPath;
  const gitHooksDir = join(repoPath, ".git", "hooks");
  const hookPath = join(gitHooksDir, "pre-commit");

  // Check if .git directory exists
  if (!existsSync(join(repoPath, ".git"))) {
    vscode.window.showWarningMessage("Not a git repository (no .git folder found)");
    return;
  }

  // Ensure hooks directory exists
  if (!existsSync(gitHooksDir)) {
    try {
      mkdirSync(gitHooksDir, { recursive: true });
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to create hooks directory: ${e}`);
      return;
    }
  }

  // If hook already exists, confirm overwrite
  if (existsSync(hookPath)) {
    const yes = await vscode.window.showWarningMessage(
      "A pre-commit hook already exists. Overwrite?",
      "Yes",
      "No",
    );
    if (yes !== "Yes") {
      return;
    }
  }

  // Path to the compiled preCommit.js script inside the extension installation directory
  const extensionPath = context.extensionPath; // Path to extension root
  const preCommitJS = join(extensionPath, "dist", "preCommit.js");

  if (!existsSync(preCommitJS)) {
    vscode.window.showErrorMessage(
      "Safe Send: preCommit.js not found. Please compile the extension first (Run > Compile).",
    );
    return;
  }

  // Build hook script content
  const hookContent = `#!/bin/sh
# Safe Send pre-commit hook
# This hook scans staged files for sensitive data.
# Generated by Safe Send extension.

node "${preCommitJS}" "$@"
`;

  try {
    writeFileSync(hookPath, hookContent, { mode: 0o755 }); // Make executable
    vscode.window.showInformationMessage("Safe Send pre-commit hook installed successfully!");
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to write pre-commit hook: ${error}`);
  }
}
