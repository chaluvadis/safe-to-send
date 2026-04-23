import * as vscode from "vscode";
import { detectSensitiveData, sanitizeSensitiveData } from "./sensitive";

export function activate(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand("safeSend.scanAndCopyForAI", async () => {
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
      await vscode.env.clipboard.writeText(sanitizeSensitiveData(text));
      await vscode.window.showInformationMessage("Sanitized text copied to clipboard");
      return;
    }

    if (choice === "Copy Anyway") {
      await vscode.env.clipboard.writeText(text);
      await vscode.window.showWarningMessage("Original text copied to clipboard");
    }
  });

  context.subscriptions.push(command);
}

export function deactivate(): void {}
