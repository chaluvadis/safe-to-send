/** Shape of a user-supplied pattern definition (from VS Code settings or .safe-send.json). */
export type PatternDefinition = {
  id: string;
  label: string;
  regex: string;
  flags?: string;
  placeholder?: string;
  riskScore?: number;
  critical?: boolean;
  enabled?: boolean;
};

/** A fully compiled, runtime-ready pattern. */
export type CompiledPattern = {
  id: string;
  label: string;
  /** Detection regex — stateful; callers must reset lastIndex after use. */
  regex: RegExp;
  placeholder: string;
  riskScore: number;
  critical: boolean;
  /** Applies this pattern's sanitisation replacement to the given text. */
  sanitize: (text: string) => string;
};

/** Maximum number of user-defined custom patterns accepted. */
export const MAX_CUSTOM_PATTERNS = 50;

/** Clipboard content above this byte size is skipped during monitoring. */
export const MAX_CLIPBOARD_SIZE_BYTES = 200 * 1024;

/** Returns a sanitise function that replaces all regex matches with placeholder. */
function makeSimpleSanitize(
  source: string,
  flags: string,
  placeholder: string,
): (text: string) => string {
  // Always creates a fresh RegExp to avoid lastIndex side-effects on global regexes.
  return (text: string) => text.replace(new RegExp(source, flags), placeholder);
}

/**
 * Built-in patterns in detection/sanitisation order.
 * Anthropic precedes OpenAI so that `sk-ant-…` tokens are handled first.
 */
export const BUILT_IN_PATTERNS: readonly CompiledPattern[] = Object.freeze([
  {
    id: "anthropic_api_key",
    label: "Anthropic API key",
    regex: /\bsk-ant-[a-zA-Z0-9]{20,}\b/g,
    placeholder: "<ANTHROPIC_API_KEY>",
    riskScore: 0,
    critical: false,
    sanitize: makeSimpleSanitize(
      String.raw`\bsk-ant-[a-zA-Z0-9]{20,}\b`,
      "g",
      "<ANTHROPIC_API_KEY>",
    ),
  },
  {
    id: "openai_api_key",
    label: "OpenAI API key",
    regex: /\bsk-[a-zA-Z0-9]{20,}\b/g,
    placeholder: "<API_KEY>",
    riskScore: 40,
    critical: true,
    sanitize: makeSimpleSanitize(String.raw`\bsk-[a-zA-Z0-9]{20,}\b`, "g", "<API_KEY>"),
  },
  {
    id: "github_token",
    label: "GitHub token",
    regex: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,
    placeholder: "<GITHUB_TOKEN>",
    riskScore: 0,
    critical: false,
    sanitize: makeSimpleSanitize(
      String.raw`\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b`,
      "g",
      "<GITHUB_TOKEN>",
    ),
  },
  {
    id: "aws_key",
    label: "AWS key",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    placeholder: "<AWS_KEY>",
    riskScore: 40,
    critical: true,
    sanitize: makeSimpleSanitize(String.raw`\bAKIA[0-9A-Z]{16}\b`, "g", "<AWS_KEY>"),
  },
  {
    id: "jwt_token",
    label: "JWT token",
    regex: /\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
    placeholder: "<JWT_TOKEN>",
    riskScore: 25,
    critical: false,
    sanitize: makeSimpleSanitize(
      String.raw`\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b`,
      "g",
      "<JWT_TOKEN>",
    ),
  },
  {
    id: "private_key_block",
    label: "Private key block",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
    placeholder: "<PRIVATE_KEY_BLOCK>",
    riskScore: 0,
    critical: false,
    sanitize: makeSimpleSanitize("-----BEGIN [A-Z ]*PRIVATE KEY-----", "g", "<PRIVATE_KEY_BLOCK>"),
  },
  {
    id: "ip_address",
    label: "IP address",
    regex: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g,
    placeholder: "<IP_ADDRESS>",
    riskScore: 15,
    critical: false,
    sanitize: makeSimpleSanitize(String.raw`\b\d{1,3}(?:\.\d{1,3}){3}\b`, "g", "<IP_ADDRESS>"),
  },
  {
    id: "email",
    label: "Email",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    placeholder: "<EMAIL>",
    riskScore: 10,
    critical: false,
    sanitize: makeSimpleSanitize(
      String.raw`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b`,
      "g",
      "<EMAIL>",
    ),
  },
  {
    id: "hardcoded_secret",
    label: "Hardcoded secret",
    regex: /(password|secret|api_key)\s*[:=]\s*["'][^"']+["']/gi,
    placeholder: "<SECRET>",
    riskScore: 35,
    critical: false,
    // Preserves the key name; replaces only the value with <SECRET>.
    sanitize: (text: string) =>
      text.replace(
        /(password|secret|api_key)(\s*[:=]\s*["'])([^"']+)(["'])/gi,
        (_match, key: string, prefix: string, _value: string, suffix: string) =>
          `${key}${prefix}<SECRET>${suffix}`,
      ),
  },
]);

/**
 * Attempts to compile a user-supplied PatternDefinition into a CompiledPattern.
 * Returns null and invokes warnCallback if the regex is invalid or the pattern is disabled.
 */
export function compilePattern(
  def: PatternDefinition,
  warnCallback?: (message: string) => void,
): CompiledPattern | null {
  if (def.enabled === false) {
    return null;
  }

  // Ensure the global 'g' flag is always present.
  let flags = def.flags ?? "g";
  if (!flags.includes("g")) {
    flags = `${flags}g`;
  }

  let regex: RegExp;
  try {
    regex = new RegExp(def.regex, flags);
  } catch {
    warnCallback?.(`Safe Send: ignoring custom pattern "${def.id}" — invalid regex: ${def.regex}`);
    return null;
  }

  const placeholder = def.placeholder ?? "<REDACTED>";
  const riskScore = Math.max(0, Math.min(100, def.riskScore ?? 0));
  const critical = def.critical ?? false;

  return {
    id: def.id,
    label: def.label,
    regex,
    placeholder,
    riskScore,
    critical,
    sanitize: makeSimpleSanitize(def.regex, flags, placeholder),
  };
}

/**
 * Builds the full pattern list: built-in patterns followed by compiled custom patterns.
 * Custom patterns exceeding MAX_CUSTOM_PATTERNS are silently dropped.
 */
export function buildPatternList(
  customDefs: PatternDefinition[],
  warnCallback?: (message: string) => void,
): CompiledPattern[] {
  const limited = customDefs.slice(0, MAX_CUSTOM_PATTERNS);
  const compiled = limited
    .map((def) => compilePattern(def, warnCallback))
    .filter((p): p is CompiledPattern => p !== null);
  return [...BUILT_IN_PATTERNS, ...compiled];
}
