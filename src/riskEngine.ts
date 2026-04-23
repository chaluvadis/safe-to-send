type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type RiskResult = {
  score: number;
  level: RiskLevel;
  findings: string[];
};

type Detector = {
  label: string;
  regex: RegExp;
  score: number;
};

const detectors: Detector[] = [
  { label: "OpenAI API key", regex: /\bsk-[a-zA-Z0-9]{20,}\b/g, score: 40 },
  { label: "AWS key", regex: /\bAKIA[0-9A-Z]{16}\b/g, score: 40 },
  {
    label: "JWT token",
    regex: /\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
    score: 25,
  },
  { label: "IP address", regex: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g, score: 15 },
  { label: "Email", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, score: 10 },
  {
    label: "Hardcoded secret",
    regex: /(password|secret|api_key)\s*[:=]\s*["'][^"']+["']/gi,
    score: 35,
  },
];

export function assessRisk(text: string, filePath?: string): RiskResult {
  const findings: string[] = [];
  let score = 0;
  let hasCriticalKey = false;

  for (const detector of detectors) {
    if (detector.regex.test(text)) {
      findings.push(detector.label);
      score += detector.score;
      if (detector.label === "OpenAI API key" || detector.label === "AWS key") {
        hasCriticalKey = true;
      }
    }
    detector.regex.lastIndex = 0;
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
