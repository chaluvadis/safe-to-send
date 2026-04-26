import * as vscode from "vscode";
import { registerEventManager } from "./eventManager";
import { BUILT_IN_PATTERNS, type CompiledPattern } from "./patternRegistry";
import { loadRepoConfig } from "./repoConfig";
import { assessRisk } from "./riskEngine";
import { sanitize } from "./sanitizer";
import { detectSensitiveData } from "./sensitive";

export function activate(context: vscode.ExtensionContext) {
  console.log("Safe Send extension is now active!");

  // Register the main command
  const disposable = vscode.commands.registerCommand("safeSend.scanAndCopyForAI", async () => {
    await handleScanAndCopy(context);
  });

  context.subscriptions.push(disposable);

  // Set up clipboard monitoring
  registerEventManager(context);

  console.log("Safe Send: All components initialized");
}

export function deactivate() {
  console.log("Safe Send extension deactivated");
}

async function handleScanAndCopy(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor found");
    return;
  }

  try {
    // Get the selected text or entire document
    const document = editor.document;
    const selection = editor.selection;
    const text = selection.isEmpty ? document.getText() : document.getText(selection);

    if (!text || text.trim().length === 0) {
      vscode.window.showWarningMessage("No text to scan");
      return;
    }

    // Check file size limit (200KB)
    if (Buffer.byteLength(text, "utf8") > 200 * 1024) {
      vscode.window.showWarningMessage("File too large for scanning (max 200KB)");
      return;
    }

    // Analyze the text
    const customPatternDefs = loadRepoConfig(
      vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || "",
    );

    // Compile custom patterns
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

    // Process based on user choice
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
        // Do nothing
        break;
    }
  } catch (error) {
    console.error("Error in scanAndCopy:", error);
    vscode.window.showErrorMessage("Safe Send: An error occurred during scanning");
  }
}

async function showSanitizationDialog(
  detected: any[],
  riskScore: number,
): Promise<"copy-sanitized" | "copy-raw" | "cancel"> {
  const riskLevel =
    riskScore >= 60 ? "HIGH RISK " : riskScore >= 30 ? "MEDIUM RISK ⚠️" : "LOW RISK ℹ️";

  const items = [
    {
      label: "Sanitize & Copy",
      description: "Replace sensitive data with placeholders",
      detail: `Detected ${detected.length} sensitive pattern(s) | ${riskLevel}`,
      action: "copy-sanitized" as const,
    },
    {
      label: "Copy Anyway",
      description: "Copy original text with warning",
      detail: "Bypass sanitization (not recommended)",
      action: "copy-raw" as const,
    },
    {
      label: "Cancel",
      description: "Do not copy",
      detail: "Close this dialog",
      action: "cancel" as const,
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
