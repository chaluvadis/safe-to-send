import { BUILT_IN_PATTERNS, type CompiledPattern } from "./patternRegistry";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type RiskResult = {
  score: number;
  level: RiskLevel;
  findings: string[];
};

/**
 * Detects if the file is a test file based on path and content patterns.
 * Uses conservative heuristics to avoid false positives.
 */
function isTestFile(filePath?: string, content?: string): boolean {
  if (!filePath) return false;

  const normalizedPath = filePath.replaceAll("\\", "/").toLowerCase();

  // Avoid false positives: exclude common non-test directories that contain "test"
  const falsePositivePatterns = [
    /\/testament\//,
    /\/test-data\//,
    /\/test_utils\//,
    /\/testutils\//,
    /\/testing\//,
  ];
  if (falsePositivePatterns.some(p => p.test(normalizedPath))) {
    return false;
  }

  // Precise test path patterns (common conventions)
  const testPathPatterns = [
    /\/__tests__\//i,      // Jest/Vitest/TS-Jest
    /\/test\/src\//i,      // monorepo: packages/*/test/src
    /\/integration\/test\//i,
    /\/e2e\//i,
    /\.test\.(ts|js|tsx|jsx|mjs|cjs)$/i,
    /\.spec\.(ts|js|tsx|jsx|mjs|cjs)$/i,
    /^test\.(ts|js)$/i,    // root-level test files
    /^tests\.(ts|js)$/i,
  ];

  if (testPathPatterns.some(p => p.test(normalizedPath))) {
    // Path strongly indicates test file
    return true;
  }

  // Directory named exactly "test" at a likely level
  // e.g., /src/components/Button/test/Button.test.tsx or /test/unit/foo.test.ts
  const testDirPattern = /(?:\/|^)test(?:\/|$)/i;
  if (testDirPattern.test(normalizedPath)) {
    // For ambiguous "test" directories, optionally verify with content
    if (content) {
      const testContentPatterns = [
        /describe\(/,
        /^\s*(it|test)\(/m,
        /^\s*expect\(/m,
        /from\s+['"]@testing-library/,
        /jest\./,
        /vitest\./,
        /mocha\./,
        /should\(\s*\)/,
      ];
      const matches = testContentPatterns.filter(p => p.test(content)).length;
      if (matches >= 2) return true; // Strong content evidence
    }
    // If path matches known test dir exactly (like __tests__), trust it
    if (/\/__tests__\//i.test(normalizedPath)) return true;
    // Otherwise be conservative: don't classify as test
    return false;
  }

  // Content-based detection (only if path doesn't contradict)
  if (content) {
    const strongContentIndicators = [
      /^\s*describe\(/m,
      /^\s*(it|test)\(/m,
    ];
    const count = strongContentIndicators.filter(p => p.test(content)).length;
    if (count >= 3) return true;  // Definitely a test file
  }

  return false;
}

/**
 * Detects if the file is documentation or example code.
 */
function isDocumentationOrExample(filePath?: string): boolean {
  if (!filePath) return false;

  const normalizedPath = filePath.replaceAll("\\", "/").toLowerCase();

  const docPatterns = [
    /\/docs\//,
    /\/examples?\//,
    /\/tutorials?\//,
    /README\.md$/i,
    /CHANGELOG\.md$/i,
    /CONTRIBUTING\.md$/i,
    /\.md$/,
  ];

  return docPatterns.some((pattern) => pattern.test(normalizedPath));
}

/**
 * Detects if the file is a configuration template (often contains example secrets).
 */
function isConfigTemplate(filePath?: string): boolean {
  if (!filePath) return false;

  const normalizedPath = filePath.replaceAll("\\", "/").toLowerCase();

  const templatePatterns = [
    /\.env\.example$/i,
    /\.env\.template$/i,
    /config\.template\./,
    /example\.config\./,
    /\/templates?\//,
  ];

  return templatePatterns.some((pattern) => pattern.test(normalizedPath));
}

/**
 * Detects if the file is an Infrastructure-as-Code file.
 * Focuses on Terraform, CloudFormation, Kubernetes manifests, Ansible.
 */
function isIaCFile(filePath?: string): boolean {
  if (!filePath) return false;

  const normalizedPath = filePath.replaceAll("\\", "/").toLowerCase();

  // Limit to known IaC extensions to avoid false positives on generic YAML/JSON
  const iacExtensions = [".tf", ".tfvars"];
  const iacPathPatterns = [
    /\/terraform\//,
    /\/cloudformation\//,
    /\/k8s\//,
    /\/kubernetes\//,
    /\/ansible\//,
  ];

  return (
    iacExtensions.some((ext) => normalizedPath.endsWith(ext)) ||
    iacPathPatterns.some((pattern) => pattern.test(normalizedPath))
  );
}

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

  // Legacy path-based modifiers (preserved for backward compatibility)
  const hasEnvLegacy = normalizedPath?.endsWith(".env");
  const hasReadmeLegacy = normalizedPath?.endsWith("README.md");
  const hasTestLegacy = normalizedPath?.includes("/test/");

  if (hasEnvLegacy) score -= 10;
  if (hasReadmeLegacy) score += 10;
  if (hasTestLegacy) score -= 15;

  // Enhanced context-aware scoring (runs only if not covered by legacy equivalents)
  // 1. Configuration templates (e.g., .env.example, config.template.js)
  if (isConfigTemplate(filePath)) score -= 15;
  
  // 2. Test files - only if not already classified by /test/ path
  else if (!hasTestLegacy && isTestFile(filePath, text)) score -= 20;
  
  // 3. Documentation files - README already handled above, other docs get reduction
  else if (!hasReadmeLegacy && isDocumentationOrExample(filePath)) score -= 10;
  
  // 4. Infrastructure-as-Code files (if not already handled by other rules)
  else if (isIaCFile(filePath)) score -= 5;

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
