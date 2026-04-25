import * as vscode from "vscode";
import { registerEventManager, suppressNextClipboardEvent } from "./eventManager";
import { detectSensitiveData, sanitizeSensitiveData } from "./sensitive";

/**
 * Executes the Safe Send scan and copy command
 * Can be invoked from command palette or context menu
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

  const detectedTypes = detectSensitiveData(text);
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
    "Cancel"
  );

  if (choice === "Sanitize & Copy") {
    suppressNextClipboardEvent();
    await vscode.env.clipboard.writeText(sanitizeSensitiveData(text));
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
  const command = vscode.commands.registerCommand("safeSend.scanAndCopyForAI", executeScanAndCopyForAI);

  context.subscriptions.push(command);
  registerEventManager(context);
}

export function deactivate(): void {}
