import { BUILT_IN_PATTERNS, type CompiledPattern } from "./patternRegistry";

export function detectSensitiveData(text: string, patterns?: CompiledPattern[]): string[] {
  const activePatterns = patterns ?? Array.from(BUILT_IN_PATTERNS);
  const found: string[] = [];

  for (const pattern of activePatterns) {
    if (pattern.regex.test(text)) {
      found.push(pattern.label);
    }
    pattern.regex.lastIndex = 0;
  }

  return found;
}

export function sanitizeSensitiveData(text: string, patterns?: CompiledPattern[]): string {
  const activePatterns = patterns ?? Array.from(BUILT_IN_PATTERNS);
  let result = text;
  for (const pattern of activePatterns) {
    result = pattern.sanitize(result);
  }
  return result;
}
