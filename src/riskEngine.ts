import { BUILT_IN_PATTERNS, type CompiledPattern } from "./patternRegistry";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type RiskResult = {
  score: number;
  level: RiskLevel;
  findings: string[];
};

export function assessRisk(
  text: string,
  filePath?: string,
  patterns?: CompiledPattern[],
): RiskResult {
  const activePatterns = patterns ?? Array.from(BUILT_IN_PATTERNS);
  const findings: string[] = [];
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

  let level: RiskLevel = "LOW";
  if (score >= 60) {
    level = "HIGH";
  } else if (score >= 30) {
    level = "MEDIUM";
  }

  return { score, level, findings };
}
