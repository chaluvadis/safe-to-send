"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectSensitiveData = detectSensitiveData;
exports.sanitizeSensitiveData = sanitizeSensitiveData;
const patternRegistry_1 = require("./patternRegistry");
function detectSensitiveData(text, patterns) {
    const activePatterns = patterns ?? Array.from(patternRegistry_1.BUILT_IN_PATTERNS);
    const found = [];
    for (const pattern of activePatterns) {
        if (pattern.regex.test(text)) {
            found.push(pattern.label);
        }
        pattern.regex.lastIndex = 0;
    }
    return found;
}
function sanitizeSensitiveData(text, patterns) {
    const activePatterns = patterns ?? Array.from(patternRegistry_1.BUILT_IN_PATTERNS);
    let result = text;
    for (const pattern of activePatterns) {
        result = pattern.sanitize(result);
    }
    return result;
}
//# sourceMappingURL=sensitive.js.map