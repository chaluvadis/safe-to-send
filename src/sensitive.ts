type Detector = {
  label: string;
  regex: RegExp;
};

const detectors: Detector[] = [
  { label: "OpenAI API key", regex: /\bsk-[a-zA-Z0-9]{20,}\b/g },
  { label: "AWS key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: "JWT token", regex: /\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g },
  { label: "IP address", regex: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g },
  { label: "Email", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  {
    label: "Hardcoded secret",
    regex: /(password|secret|api_key)\s*[:=]\s*["'][^"']+["']/gi,
  },
];

export function detectSensitiveData(text: string): string[] {
  const found: string[] = [];

  for (const detector of detectors) {
    if (detector.regex.test(text)) {
      found.push(detector.label);
    }
    detector.regex.lastIndex = 0;
  }

  return found;
}

export function sanitizeSensitiveData(text: string): string {
  return text
    .replace(/\bsk-[a-zA-Z0-9]{20,}\b/g, "<API_KEY>")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "<AWS_KEY>")
    .replace(/\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g, "<JWT_TOKEN>")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "<IP_ADDRESS>")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "<EMAIL>")
    .replace(
      /(password|secret|api_key)(\s*[:=]\s*["'])([^"']+)(["'])/gi,
      (_match, key: string, prefix: string, _value: string, suffix: string) =>
        `${key}${prefix}<SECRET>${suffix}`,
    );
}
