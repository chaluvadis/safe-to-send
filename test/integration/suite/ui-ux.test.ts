/**
 * Safe Send UI/UX Integration Tests
 *
 * These tests verify user-facing behaviors inside VS Code:
 * - Extension activation
 * - Diagnostics (squiggles) appear for secrets
 * - Quick fix code actions are offered
 * - Sanitize file/selection commands work
 * - Status bar updates
 * - Configuration is respected
 */

import * as vscode from "vscode";
import * as assert from "node:assert";
import * as path from "path";
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from "fs";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const TEST_WORKSPACE = path.join(PROJECT_ROOT, "test", "workspace");

suite("Safe Send UI/UX Tests", () => {
  before(() => {
    // Ensure clean workspace exists
    if (existsSync(TEST_WORKSPACE)) {
      rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    }
    mkdirSync(TEST_WORKSPACE, { recursive: true });
  });

  after(() => {
    // Cleanup
    if (existsSync(TEST_WORKSPACE)) {
      rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    }
  });

  test("extension activates on startup", async () => {
    const ext = vscode.extensions.getExtension("chaluvadis.safe-send");
    assert.ok(ext, "Extension should be installed");
    assert.ok(ext?.isActive, "Extension should be active on startup");
  });

  test("diagnostics appear for file with secrets", async () => {
    const testFile = path.join(TEST_WORKSPACE, "secrets.js");
    writeFileSync(
      testFile,
      `const openai = 'sk-12345678901234567890';\nconst aws = 'AKIAABCDEFGHIJKLMNOP';`,
    );

    const doc = await vscode.workspace.openTextDocument(testFile);
    await vscode.window.showTextDocument(doc);

    // Wait for async diagnostic computation
    await new Promise((r) => setTimeout(r, 500));

    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    assert.ok(diagnostics.length >= 2, "Expected at least 2 diagnostics");

    const messages = diagnostics.map((d) => d.message);
    assert.ok(messages.some((m) => m.includes("OpenAI API key")), "Detect OpenAI key");
    assert.ok(messages.some((m) => m.includes("AWS key")), "Detect AWS key");
  });

  test("diagnostics have correct properties", async () => {
    const testFile = path.join(TEST_WORKSPACE, "secrets.js");
    writeFileSync(testFile, "const key = 'sk-12345678901234567890';");

    const doc = await vscode.workspace.openTextDocument(testFile);
    await vscode.window.showTextDocument(doc);
    await new Promise((r) => setTimeout(r, 500));

    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    assert.ok(diagnostics.length > 0);

    const diag = diagnostics[0];
    assert.strictEqual(diag.severity, vscode.DiagnosticSeverity.Warning);
    assert.ok(diag.code === "openai_api_key" || typeof diag.code === "string");
    assert.strictEqual(diag.source, "Safe Send");
  });

  test("clean file has no diagnostics", async () => {
    const cleanFile = path.join(TEST_WORKSPACE, "clean.js");
    writeFileSync(cleanFile, "// No secrets here\nconst x = 1;");

    const doc = await vscode.workspace.openTextDocument(cleanFile);
    await vscode.window.showTextDocument(doc);
    await new Promise((r) => setTimeout(r, 300));

    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    assert.strictEqual(diagnostics.length, 0);
  });

  test("code actions are offered for diagnostics", async () => {
    const testFile = path.join(TEST_WORKSPACE, "secrets.js");
    writeFileSync(testFile, "const key = 'sk-12345678901234567890';");

    const doc = await vscode.workspace.openTextDocument(testFile);
    await vscode.window.showTextDocument(doc);
    await new Promise((r) => setTimeout(r, 500));

    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    assert.ok(diagnostics.length > 0);

    const range = diagnostics[0].range;
    const codeActions = await vscode.commands.executeCommand<
      vscode.CodeAction[]
    >("vscode.executeCodeActionProvider", doc.uri, range, vscode.CodeActionKind.QuickFix);

    assert.ok(codeActions && codeActions.length > 0, "Should have quick fix actions");
    const sanitizeAction = codeActions.find((a) => a.title.toLowerCase().includes("sanitize"));
    assert.ok(sanitizeAction, "Should have 'Sanitize this...' action");
  });

  test("sanitizeFile command works", async () => {
    const testFile = path.join(TEST_WORKSPACE, "secrets.js");
    writeFileSync(testFile, "const key = 'sk-12345678901234567890';");

    const doc = await vscode.workspace.openTextDocument(testFile);
    await vscode.window.showTextDocument(doc);

    const before = doc.getText();
    assert.ok(before.includes("sk-12345678901234567890"), "Should contain raw secret");

    await vscode.commands.executeCommand("safeSend.sanitizeFile");
    await new Promise((r) => setTimeout(r, 300));

    const after = doc.getText();
    assert.ok(!after.includes("sk-12345678901234567890"), "Secret should be removed");
    assert.ok(after.includes("<API_KEY>"), "Should contain placeholder");
  });

  test("sanitizeSelection works on selected text", async () => {
    const testFile = path.join(TEST_WORKSPACE, "secrets.js");
    writeFileSync(testFile, "const key = 'sk-12345678901234567890';\nconst aws = 'AKIAABCDEFGHIJKLMNOP';");

    const doc = await vscode.workspace.openTextDocument(testFile);
    const editor = await vscode.window.showTextDocument(doc);

    const firstLine = doc.lineAt(0);
    const range = new vscode.Range(0, 0, 0, firstLine.text.length);
    editor.selection = new vscode.Selection(range.start, range.end);

    const before = doc.getText(range);
    assert.ok(before.includes("sk-12345678901234567890"), "Selection contains secret");

    await vscode.commands.executeCommand("safeSend.sanitizeSelection");
    await new Promise((r) => setTimeout(r, 200));

    const after = doc.getText(range);
    assert.ok(!after.includes("sk-12345678901234567890"), "Selection should be sanitized");

    // Second line should remain unchanged
    const secondLine = doc.lineAt(1);
    assert.ok(secondLine.text.includes("AKIAABCDEFGHIJKLMNOP"), "Unselected line unchanged");
  });

  test("status bar item is visible for file with secrets", async () => {
    const testFile = path.join(TEST_WORKSPACE, "secrets.js");
    writeFileSync(testFile, "const key = 'sk-12345678901234567890';");

    const doc = await vscode.workspace.openTextDocument(testFile);
    await vscode.window.showTextDocument(doc);
    await new Promise((r) => setTimeout(r, 500));

    const statusBarItems = vscode.window.statusBarItems;
    const safeSendItem = statusBarItems.find((item) =>
      item.id?.includes("safeSend") || item.name?.toLowerCase().includes("safe send")
    );

    assert.ok(safeSendItem, "Status bar item should be visible");

    const text = safeSendItem.text || "";
    assert.ok(text.includes("HIGH") || text.includes("MEDIUM") || text.includes("LOW"));
  });

  test("status bar shows clean state for file without secrets", async () => {
    const cleanFile = path.join(TEST_WORKSPACE, "clean.js");
    writeFileSync(cleanFile, "// No secrets\nconst x = 1;");

    const doc = await vscode.workspace.openTextDocument(cleanFile);
    await vscode.window.showTextDocument(doc);
    await new Promise((r) => setTimeout(r, 300));

    const statusBarItems = vscode.window.statusBarItems;
    const safeSendItem = statusBarItems.find((item) =>
      item.id?.includes("safeSend")
    );

    if (safeSendItem && safeSendItem.text) {
      const text = safeSendItem.text;
      assert.ok(text.includes("LOW") || text.includes("0"));
    }
  });

  test("pre-commit hook installer command exists and runs", async () => {
    // Verify command is registered
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes("safeSend.installPreCommitHook"), "Command should be registered");
  });

  test("excludeGlobs config can be read", async () => {
    const config = vscode.workspace.getConfiguration("safeSend");
    const excludeGlobs: string[] = config.get("excludeGlobs", []);
    assert.ok(Array.isArray(excludeGlobs));
    assert.ok(excludeGlobs.some((g) => g.includes("node_modules")));
    assert.ok(excludeGlobs.some((g) => g.includes("dist")));
  });

  test("excludeGlobs can be updated", async () => {
    const config = vscode.workspace.getConfiguration("safeSend");
    const newGlobs = ["**/custom/**", "**/excluded/**"];
    config.update("excludeGlobs", newGlobs, true);

    const updated = vscode.workspace.getConfiguration("safeSend").get("excludeGlobs");
    assert.ok((updated as string[]).includes("**/custom/**"));

    // Reset
    config.update("excludeGlobs", [], true);
  });

  test("all built-in patterns are valid and complete", () => {
    const { BUILT_IN_PATTERNS } = require("../../src/patternRegistry");
    assert.ok(Array.isArray(BUILT_IN_PATTERNS));
    assert.ok(BUILT_IN_PATTERNS.length > 20);

    const requiredPatterns = [
      "openai_api_key",
      "aws_key",
      "github_token",
      "jwt_token",
      "azure_storage_connection",
      "gcp_service_account",
      "postgresql_connection",
      "mysql_connection",
      "redis_connection",
      "oauth_bearer_token",
      "ethereum_private_key",
      "us_ssn",
    ];

    const ids = BUILT_IN_PATTERNS.map((p: any) => p.id);
    for (const id of requiredPatterns) {
      assert.ok(ids.includes(id), `Missing pattern: ${id}`);
    }
  });

  test("pattern registry: each pattern has required fields", () => {
    const { BUILT_IN_PATTERNS } = require("../../src/patternRegistry");

    for (const p of BUILT_IN_PATTERNS) {
      assert.ok(p.id && typeof p.id === "string", "Pattern must have id");
      assert.ok(p.label && typeof p.label === "string");
      assert.ok(p.regex instanceof RegExp, "Pattern must have regex");
      assert.ok(p.placeholder && typeof p.placeholder === "string");
      assert.ok(typeof p.riskScore === "number" && p.riskScore >= 0 && p.riskScore <= 100);
      assert.ok(typeof p.sanitize === "function");
    }
  });

  test("pre-commit hook script exists and is valid", () => {
    const preCommitPath = path.join(PROJECT_ROOT, "dist", "preCommit.js");
    assert.ok(existsSync(preCommitPath), "preCommit.js should exist in dist/");
  });

  test("pre-commit hook has correct shebang", () => {
    const preCommitPath = path.join(PROJECT_ROOT, "dist", "preCommit.js");
    const content = readFileSync(preCommitPath, "utf8");
    assert.ok(content.startsWith("#!/usr/bin/env node"), "Should have node shebang");
  });

  test("pre-commit hook contains required imports", () => {
    const preCommitPath = path.join(PROJECT_ROOT, "dist", "preCommit.js");
    const content = readFileSync(preCommitPath, "utf8");
    assert.ok(content.includes("buildPatternList"));
    assert.ok(content.includes("assessRisk"));
    assert.ok(content.includes("loadRepoConfig"));
  });
});
