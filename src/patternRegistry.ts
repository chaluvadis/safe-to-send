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
    regex: /(password|secret|api_key|access_token|auth_token|pass|pwd)\s*[:=]\s*["'][^"']+["']/gi,
    placeholder: "<SECRET>",
    riskScore: 35,
    critical: false,
    // Preserves the key name; replaces only the value with <SECRET>.
    sanitize: (text: string) =>
      text.replace(
        /(password|secret|api_key|access_token|auth_token|pass|pwd)(\s*[:=]\s*["'])([^"']+)(["'])/gi,
        (_match, key: string, prefix: string, _value: string, suffix: string) =>
          `${key}${prefix}<SECRET>${suffix}`,
      ),
  },

  // ============================================
  // ENHANCED DETECTIONS (new in Safe Send Pro)
  // ============================================

  // Cloud Provider Credentials
  {
    id: "azure_storage_connection",
    label: "Azure Storage connection string",
    regex: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+;EndpointSuffix=core\.windows\.net/g,
    placeholder: "<AZURE_CONNECTION_STRING>",
    riskScore: 60,
    critical: true,
    sanitize: makeSimpleSanitize(
      String.raw`DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+;EndpointSuffix=core\.windows\.net`,
      "g",
      "<AZURE_CONNECTION_STRING>",
    ),
  },
  {
    id: "gcp_service_account",
    label: "Google Cloud service account",
    regex: /"type"\s*:\s*"service_account"/g,
    placeholder: "<GCP_SERVICE_ACCOUNT>",
    riskScore: 55,
    critical: true,
    sanitize: makeSimpleSanitize(String.raw`"type"\s*:\s*"service_account"`, "g", "<GCP_SERVICE_ACCOUNT>"),
  },
  {
    id: "firebase_server_key",
    label: "Firebase server key",
    regex: /\bAAAA[0-9A-Za-z\-_]{35}:[0-9A-Za-z\-_]{93}\b/g,
    placeholder: "<FIREBASE_SERVER_KEY>",
    riskScore: 55,
    critical: true,
    sanitize: makeSimpleSanitize(String.raw`\bAAAA[0-9A-Za-z\-_]{35}:[0-9A-Za-z\-_]{93}\b`, "g", "<FIREBASE_SERVER_KEY>"),
  },
  {
    id: "heroku_api_key",
    label: "Heroku API key",
    regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g,
    placeholder: "<HEROKU_API_KEY>",
    riskScore: 50,
    critical: true,
    sanitize: makeSimpleSanitize(String.raw`\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b`, "g", "<HEROKU_API_KEY>"),
  },

  // Database Connection Strings
  {
    id: "postgresql_connection",
    label: "PostgreSQL connection string",
    regex: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^:]+\:[0-9]+\//g,
    placeholder: "<POSTGRESQL_CONNECTION>",
    riskScore: 60,
    critical: true,
    sanitize: makeSimpleSanitize(String.raw`postgres(?:ql)?:\/\/[^:]+:[^@]+@[^:]+\:[0-9]+\//`, "g", "<POSTGRESQL_CONNECTION>"),
  },
  {
    id: "mysql_connection",
    label: "MySQL connection string",
    regex: /mysql:\/\/\w+:\w+@[\w\.]+:\d+\//g,
    placeholder: "<MYSQL_CONNECTION>",
    riskScore: 60,
    critical: true,
    sanitize: makeSimpleSanitize(String.raw`mysql:\/\/\w+:\w+@[\w\.]+:\d+\//`, "g", "<MYSQL_CONNECTION>"),
  },
  {
    id: "mongodb_connection",
    label: "MongoDB connection string",
    regex: /mongodb:\/\/\w+:\w+@[\w\.]+:\d+\/\w+/g,
    placeholder: "<MONGODB_CONNECTION>",
    riskScore: 60,
    critical: true,
    sanitize: makeSimpleSanitize(String.raw`mongodb:\/\/\w+:\w+@[\w\.]+:\d+\/\w+`, "g", "<MONGODB_CONNECTION>"),
  },
  {
    id: "redis_connection",
    label: "Redis connection string",
    regex: /redis:\/\/:[^@]+@[\w\.]+:\d+/g,
    placeholder: "<REDIS_CONNECTION>",
    riskScore: 55,
    critical: true,
    sanitize: makeSimpleSanitize(String.raw`redis:\/\/:[^@]+@[\w\.]+:\d+`, "g", "<REDIS_CONNECTION>"),
  },

  // Infrastructure-as-Code Secrets
  {
    id: "terraform_variable_default",
    label: "Terraform variable with default",
    regex: /variable\s+["'][^"']+["']\s*\{\s*default\s*=\s*["'][^"']+["']\s*\}/g,
    placeholder: "<TF_VARIABLE>",
    riskScore: 45,
    critical: false,
    sanitize: makeSimpleSanitize(
      String.raw`variable\s+["'][^"']+["']\s*\{\s*default\s*=\s*["'][^"']+["']\s*\}`,
      "g",
      "<TF_VARIABLE>",
    ),
  },
  {
    id: "cloudformation_secret",
    label: "CloudFormation secret reference",
    regex: /{{resolve:secretsmanager:[^:]+:[^}]+}}/g,
    placeholder: "<CF_SECRET_REF>",
    riskScore: 45,
    critical: false,
    sanitize: makeSimpleSanitize(String.raw`{{resolve:secretsmanager:[^:]+:[^}]+}}`, "g", "<CF_SECRET_REF>"),
  },
  {
    id: "docker_compose_env",
    label: "Docker Compose environment secret",
    regex: /environment:\s*-\s*[A-Z_]+=\S+/g,
    placeholder: "<DOCKER_ENV>",
    riskScore: 40,
    critical: false,
    sanitize: makeSimpleSanitize(String.raw`environment:\s*-\s*[A-Z_]+=\S+`, "g", "<DOCKER_ENV>"),
  },

  // ============================================
  // EXTENDED PATTERNS (Free Tier Enhancements)
  // ============================================

  // OAuth & Token Patterns
  {
    id: "oauth_bearer_token",
    label: "OAuth Bearer token",
    regex: /Bearer\s+[A-Za-z0-9\-_.]+/g,
    placeholder: "<BEARER_TOKEN>",
    riskScore: 55,
    critical: true,
    sanitize: makeSimpleSanitize(String.raw`Bearer\s+[A-Za-z0-9\-_.]+`, "g", "<BEARER_TOKEN>"),
  },
  {
    id: "google_oauth_token",
    label: "Google OAuth token",
    regex: /ya29\.[A-Za-z0-9\-_.]+/g,
    placeholder: "<GOOGLE_OAUTH_TOKEN>",
    riskScore: 55,
    critical: true,
    sanitize: makeSimpleSanitize(String.raw`ya29\.[A-Za-z0-9\-_.]+`, "g", "<GOOGLE_OAUTH_TOKEN>"),
  },

  // High-Entropy / Encoded Secrets
  {
    id: "high_entropy_base64",
    label: "Possible base64-encoded secret",
    regex: /[A-Za-z0-9+/]{40,}={0,2}/g,
    placeholder: "<BASE64_SECRET>",
    riskScore: 30,
    critical: false,
    sanitize: makeSimpleSanitize(String.raw`[A-Za-z0-9+/]{40,}={0,2}`, "g", "<BASE64_SECRET>"),
  },

  // Cryptocurrency Keys
  {
    id: "bitcoin_private_key_wif",
    label: "Bitcoin private key (WIF)",
    regex: /5[HJK][1-9A-HJ-NP-Za-km-z]{50,}/g,
    placeholder: "<BITCOIN_PRIVATE_KEY>",
    riskScore: 80,
    critical: true,
    sanitize: makeSimpleSanitize(String.raw`5[HJK][1-9A-HJ-NP-Za-km-z]{50,}`, "g", "<BITCOIN_PRIVATE_KEY>"),
  },
  {
    id: "ethereum_private_key",
    label: "Ethereum private key",
    regex: /0x[a-fA-F0-9]{64}/g,
    placeholder: "<ETHEREUM_PRIVATE_KEY>",
    riskScore: 80,
    critical: true,
    sanitize: makeSimpleSanitize(String.raw`0x[a-fA-F0-9]{64}`, "g", "<ETHEREUM_PRIVATE_KEY>"),
  },

  // Personal Identifiable Information (PII)
  {
    id: "us_ssn",
    label: "US Social Security Number",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    placeholder: "<SSN>",
    riskScore: 50,
    critical: false,
    sanitize: makeSimpleSanitize(String.raw`\b\d{3}-\d{2}-\d{4}\b`, "g", "<SSN>"),
  },
   // Credit card detection: requires 15-16 digit number with word boundaries to avoid false positives
   {
     id: "credit_card_luhn",
     label: "Credit card number",
     regex: /\b(?:\d{4}[- ]?){3}\d{3,4}\b/g,
     placeholder: "<CREDIT_CARD>",
     riskScore: 60,
     critical: false,
     sanitize: makeSimpleSanitize(String.raw`\b(?:\d{4}[- ]?){3}\d{3,4}\b`, "g", "<CREDIT_CARD>"),
   },

   // Known Test/Placeholder Keywords (low risk, but better to flag than miss)
  {
    id: "test_api_key_placeholder",
    label: "Test API key placeholder",
    regex: /\b(sk|ak|gh)-test-[A-Za-z0-9]+\b/g,
    placeholder: "<TEST_KEY>",
    riskScore: 5,
    critical: false,
    sanitize: makeSimpleSanitize(String.raw`\b(sk|ak|gh)-test-[A-Za-z0-9]+\b`, "g", "<TEST_KEY>"),
  },
  {
    id: "common_placeholder",
    label: "Common placeholder secret",
    regex: /\b(?:changeme|your-key-here|enter[\s._-]?secret|insert[\s._-]?here)\b/gi,
    placeholder: "<PLACEHOLDER>",
    riskScore: 1,
    critical: false,
    sanitize: makeSimpleSanitize(String.raw`\b(?:changeme|your-key-here|enter[\s._-]?secret|insert[\s._-]?here)\b`, "gi", "<PLACEHOLDER>"),
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
