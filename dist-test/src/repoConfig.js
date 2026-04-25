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
exports.loadRepoConfig = loadRepoConfig;
exports.parseRepoConfig = parseRepoConfig;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
/**
 * Reads and parses a .safe-send.json file from the given workspace folder.
 * Returns an empty array if the file does not exist or is invalid.
 */
function loadRepoConfig(workspaceFolderPath, filename = ".safe-send.json") {
    const configPath = path.join(workspaceFolderPath, filename);
    try {
        const content = fs.readFileSync(configPath, "utf8");
        return parseRepoConfig(content);
    }
    catch {
        return [];
    }
}
/**
 * Parses the contents of a .safe-send.json file.
 * Returns only well-formed pattern definitions; silently drops malformed entries.
 */
function parseRepoConfig(json) {
    let parsed;
    try {
        parsed = JSON.parse(json);
    }
    catch {
        return [];
    }
    const config = parsed;
    if (!Array.isArray(config?.patterns)) {
        return [];
    }
    return config.patterns.filter(isValidPatternDefinition);
}
function isValidPatternDefinition(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const v = value;
    return (typeof v.id === "string" &&
        v.id.length > 0 &&
        typeof v.label === "string" &&
        v.label.length > 0 &&
        typeof v.regex === "string" &&
        v.regex.length > 0);
}
//# sourceMappingURL=repoConfig.js.map