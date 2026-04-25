"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.suppressNextClipboardEvent = suppressNextClipboardEvent;
exports.registerEventManager = registerEventManager;
const vscode = __importStar(require("vscode"));
const patternRegistry_1 = require("./patternRegistry");
const repoConfig_1 = require("./repoConfig");
const riskEngine_1 = require("./riskEngine");
const sanitizer_1 = require("./sanitizer");
const POLL_INTERVAL_MS = 200;
const ignoredFiles = new Set();
let lastClipboard = "";
let suppressCount = 0;
function suppressNextClipboardEvent() {
    suppressCount += 1;
}
/** Set of warning message IDs already shown (to avoid repeating on every poll tick). */
const shownWarnings = new Set();
function warnOnce(id, message) {
    if (!shownWarnings.has(id)) {
        shownWarnings.add(id);
        vscode.window.showWarningMessage(message);
    }
}
/** Loads all custom pattern definitions from VS Code settings and repo config files. */
function loadCustomPatternDefs() {
    try {
        const config = vscode.workspace.getConfiguration("safeSend");
        const settingsDefs = config.get("customPatterns") ?? [];
        const repoEnabled = config.get("repoConfig.enabled") ?? true;
        const repoFilename = config.get("repoConfig.filename") ?? ".safe-send.json";
        const repoDefs = [];
        if (repoEnabled) {
            const folders = vscode.workspace.workspaceFolders;
            if (folders && folders.length > 0) {
                for (const folder of folders) {
                    repoDefs.push(...(0, repoConfig_1.loadRepoConfig)(folder.uri.fsPath, repoFilename));
                }
            }
        }
        return [...repoDefs, ...settingsDefs];
    }
    catch {
        return [];
    }
}
/** Builds (or refreshes) the active pattern list, with once-only warnings for invalid patterns. */
function buildActivePatterns() {
    try {
        const customDefs = loadCustomPatternDefs();
        return (0, patternRegistry_1.buildPatternList)(customDefs, (msg) => warnOnce(msg, msg));
    }
    catch {
        return Array.from(patternRegistry_1.BUILT_IN_PATTERNS);
    }
}
function registerEventManager(context) {
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
            if (Buffer.byteLength(current, "utf8") > patternRegistry_1.MAX_CLIPBOARD_SIZE_BYTES) {
                return;
            }
            const filePath = vscode.window.activeTextEditor?.document.fileName;
            if (filePath && ignoredFiles.has(filePath)) {
                return;
            }
            const result = (0, riskEngine_1.assessRisk)(current, filePath, activePatterns);
            if (result.level === "LOW") {
                return;
            }
            const choice = await vscode.window.showWarningMessage(`⚠️ Safe Send: Risk ${result.score}/100 (${result.level}) — ${result.findings.join(", ")}`, "Sanitize Clipboard", "Allow Copy", "Ignore for this file");
            if (choice === "Sanitize Clipboard") {
                const sanitized = (0, sanitizer_1.sanitize)(current, activePatterns);
                suppressNextClipboardEvent();
                await vscode.env.clipboard.writeText(sanitized);
                lastClipboard = sanitized;
                await vscode.window.showInformationMessage("Clipboard sanitized by Safe Send");
                return;
            }
            if (choice === "Ignore for this file" && filePath) {
                ignoredFiles.add(filePath);
            }
        }
        catch {
            // Never block clipboard flow.
        }
    }, POLL_INTERVAL_MS);
    context.subscriptions.push({
        dispose: () => {
            clearInterval(interval);
        },
    });
}
//# sourceMappingURL=eventManager.js.map