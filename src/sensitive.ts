import { BUILT_IN_PATTERNS, type CompiledPattern } from "./patternRegistry";

export interface SensitiveMatch {
  label: string;
  start: number;
  end: number;
  patternId: string;
}

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

export function detectSensitiveDataWithRanges(text: string, patterns?: CompiledPattern[]): SensitiveMatch[] {
  const activePatterns = patterns ?? Array.from(BUILT_IN_PATTERNS);
  const matches: SensitiveMatch[] = [];

  for (const pattern of activePatterns) {
    let match: RegExpExecArray | null;
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(text)) !== null) {
      // Avoid zero-length matches
      if (match.index === match.index + match[0].length) {
        break;
      }
      matches.push({
        label: pattern.label,
        start: match.index,
        end: match.index + match[0].length,
        patternId: pattern.id,
      });
    }
    pattern.regex.lastIndex = 0;
  }

  // Sort by start position
  matches.sort((a, b) => a.start - b.start);
  return matches;
}

export function sanitizeSensitiveData(text: string, patterns?: CompiledPattern[]): string {
  const activePatterns = patterns ?? Array.from(BUILT_IN_PATTERNS);
  let result = text;
  for (const pattern of activePatterns) {
    result = pattern.sanitize(result);
  }
  return result;
}

/**
 * Sanitizes a specific match within text (used for code actions).
 */
export function sanitizeMatch(text: string, match: SensitiveMatch, patterns?: CompiledPattern[]): string {
  const activePatterns = patterns ?? Array.from(BUILT_IN_PATTERNS);
  const pattern = activePatterns.find(p => p.id === match.patternId);
  if (!pattern) return text;

  // Replace only this specific occurrence at the exact position
  const before = text.slice(0, match.start);
  const after = text.slice(match.end);
  return before + pattern.placeholder + after;
}
