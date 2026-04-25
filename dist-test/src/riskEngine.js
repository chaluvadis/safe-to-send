"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assessRisk = assessRisk;
const patternRegistry_1 = require("./patternRegistry");
function assessRisk(text, filePath, patterns) {
    const activePatterns = patterns ?? Array.from(patternRegistry_1.BUILT_IN_PATTERNS);
    const findings = [];
    let score = 0;
    let hasCriticalKey = false;
    for (const pattern of activePatterns) {
        if (pattern.regex.test(text)) {
            findings.push(pattern.label);
            score += pattern.riskScore;
            if (pattern.critical) {
                hasCriticalKey = true;
            }
        }
        pattern.regex.lastIndex = 0;
    }
    if (hasCriticalKey && score < 60) {
        score = 60;
    }
    const normalizedPath = filePath?.replaceAll("\\", "/");
    if (normalizedPath?.endsWith(".env")) {
        score -= 10;
    }
    if (normalizedPath?.endsWith("README.md")) {
        score += 10;
    }
    if (normalizedPath?.includes("/test/")) {
        score -= 15;
    }
    if (findings.length >= 2) {
        score += 20;
    }
    if (findings.length > 3) {
        score += 15;
    }
    if (score < 0) {
        score = 0;
    }
    if (score > 100) {
        score = 100;
    }
    let level = "LOW";
    if (score >= 60) {
        level = "HIGH";
    }
    else if (score >= 30) {
        level = "MEDIUM";
    }
    return { score, level, findings };
}
//# sourceMappingURL=riskEngine.js.map