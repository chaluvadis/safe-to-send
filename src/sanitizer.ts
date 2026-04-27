import { BUILT_IN_PATTERNS, type CompiledPattern } from "./patternRegistry";

export function sanitize(text: string, patterns?: CompiledPattern[]): string {
  const activePatterns = patterns ?? Array.from(BUILT_IN_PATTERNS);
  let result = text;
  for (const pattern of activePatterns) {
    result = pattern.sanitize(result);
  }
  return result;
}
