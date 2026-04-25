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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const eventManager_1 = require("./eventManager");
const patternRegistry_1 = require("./patternRegistry");
const repoConfig_1 = require("./repoConfig");
const sensitive_1 = require("./sensitive");
/** Loads all custom pattern definitions from VS Code settings and the repo config file. */
function loadCustomPatternDefs(filePath) {
    const config = vscode.workspace.getConfiguration("safeSend");
    const settingsDefs = config.get("customPatterns") ?? [];
    const repoEnabled = config.get("repoConfig.enabled") ?? true;
    const repoFilename = config.get("repoConfig.filename") ?? ".safe-send.json";
    const repoDefs = [];
    if (repoEnabled) {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            if (filePath) {
                const normalizedFile = filePath.replaceAll("\\", "/");
                const matchingFolder = folders.find((f) => normalizedFile.startsWith(f.uri.fsPath.replaceAll("\\", "/")));
                if (matchingFolder) {
                    repoDefs.push(...(0, repoConfig_1.loadRepoConfig)(matchingFolder.uri.fsPath, repoFilename));
                }
                else {
                    for (const folder of folders) {
                        repoDefs.push(...(0, repoConfig_1.loadRepoConfig)(folder.uri.fsPath, repoFilename));
                    }
                }
            }
            else {
                for (const folder of folders) {
                    repoDefs.push(...(0, repoConfig_1.loadRepoConfig)(folder.uri.fsPath, repoFilename));
                }
            }
        }
    }
    return [...repoDefs, ...settingsDefs];
}
/** Builds the active pattern list for a given file path. */
function getPatterns(filePath) {
    try {
        const customDefs = loadCustomPatternDefs(filePath);
        return (0, patternRegistry_1.buildPatternList)(customDefs);
    }
    catch {
        // Fall back to built-ins so detection still works even if config loading fails.
        return Array.from(patternRegistry_1.BUILT_IN_PATTERNS);
    }
}
/**
 * Executes the Safe Send scan and copy command.
 * Can be invoked from command palette or context menu.
 */
async function executeScanAndCopyForAI() {
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
    const detectedTypes = (0, sensitive_1.detectSensitiveData)(text, patterns);
    if (detectedTypes.length === 0) {
        (0, eventManager_1.suppressNextClipboardEvent)();
        await vscode.env.clipboard.writeText(text);
        await vscode.window.showInformationMessage("No sensitive data detected");
        return;
    }
    const choice = await vscode.window.showWarningMessage(`Sensitive data detected: ${detectedTypes.join(", ")}`, "Sanitize & Copy", "Copy Anyway", "Cancel");
    if (choice === "Sanitize & Copy") {
        (0, eventManager_1.suppressNextClipboardEvent)();
        await vscode.env.clipboard.writeText((0, sensitive_1.sanitizeSensitiveData)(text, patterns));
        await vscode.window.showInformationMessage("Sanitized text copied to clipboard");
        return;
    }
    if (choice === "Copy Anyway") {
        (0, eventManager_1.suppressNextClipboardEvent)();
        await vscode.env.clipboard.writeText(text);
        await vscode.window.showWarningMessage("Original text copied to clipboard");
    }
}
function activate(context) {
    // Register command for command palette and context menu
    const command = vscode.commands.registerCommand("safeSend.scanAndCopyForAI", executeScanAndCopyForAI);
    context.subscriptions.push(command);
    (0, eventManager_1.registerEventManager)(context);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map