"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitize = sanitize;
const patternRegistry_1 = require("./patternRegistry");
function sanitize(text, patterns) {
    const activePatterns = patterns ?? Array.from(patternRegistry_1.BUILT_IN_PATTERNS);
    let result = text;
    for (const pattern of activePatterns) {
        result = pattern.sanitize(result);
    }
    return result;
}
//# sourceMappingURL=sanitizer.js.map