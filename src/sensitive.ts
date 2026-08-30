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
    let matched = false;
    pattern.regex.lastIndex = 0;
    for (let m = pattern.regex.exec(text); m !== null; m = pattern.regex.exec(text)) {
      if (m[0].length === 0) {
        pattern.regex.lastIndex++;
        continue;
      }
      if (!pattern.shouldIgnore?.(m[0])) {
        matched = true;
        break;
      }
    }
    pattern.regex.lastIndex = 0;
    if (matched && !found.includes(pattern.label)) {
      found.push(pattern.label);
    }
  }

  return found;
}

export function detectSensitiveDataWithRanges(
  text: string,
  patterns?: CompiledPattern[],
): SensitiveMatch[] {
  const activePatterns = patterns ?? Array.from(BUILT_IN_PATTERNS);
  const matches: SensitiveMatch[] = [];

  for (const pattern of activePatterns) {
    pattern.regex.lastIndex = 0;
    for (let match = pattern.regex.exec(text); match !== null; match = pattern.regex.exec(text)) {
      // Avoid getting stuck on a zero-length match.
      if (match[0].length === 0) {
        pattern.regex.lastIndex++;
        continue;
      }
      // Skip allow-listed matches (e.g. trusted URL hosts).
      if (pattern.shouldIgnore?.(match[0])) {
        continue;
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
export function sanitizeMatch(
  text: string,
  match: SensitiveMatch,
  patterns?: CompiledPattern[],
): string {
  const activePatterns = patterns ?? Array.from(BUILT_IN_PATTERNS);
  const pattern = activePatterns.find((p) => p.id === match.patternId);
  if (!pattern) return text;

  // Replace only this specific occurrence at the exact position
  const before = text.slice(0, match.start);
  const after = text.slice(match.end);
  return before + pattern.placeholder + after;
}
