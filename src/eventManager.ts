import * as vscode from "vscode";
import { assessRisk } from "./riskEngine";
import { sanitize } from "./sanitizer";

const POLL_INTERVAL_MS = 200;
const ignoredFiles = new Set<string>();
let lastClipboard = "";
let suppressCount = 0;

export function suppressNextClipboardEvent(): void {
  suppressCount += 1;
}

export function registerEventManager(context: vscode.ExtensionContext): void {
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

      const filePath = vscode.window.activeTextEditor?.document.fileName;
      if (filePath && ignoredFiles.has(filePath)) {
        return;
      }

      const result = assessRisk(current, filePath);
      if (result.level === "LOW") {
        return;
      }

      const choice = await vscode.window.showWarningMessage(
        `⚠️ Safe Send Pro: Risk ${result.score}/100 (${result.level}) — ${result.findings.join(", ")}`,
        "Sanitize Clipboard",
        "Allow Copy",
        "Ignore for this file",
      );

      if (choice === "Sanitize Clipboard") {
        const sanitized = sanitize(current);
        suppressNextClipboardEvent();
        await vscode.env.clipboard.writeText(sanitized);
        lastClipboard = sanitized;
        await vscode.window.showInformationMessage("Clipboard sanitized by Safe Send Pro");
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
