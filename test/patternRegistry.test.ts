import assert = require("node:assert/strict");
import test = require("node:test");

import {
  BUILT_IN_PATTERNS,
  buildPatternList,
  compilePattern,
  setUrlAllowlist,
  isUrlAllowed,
  MAX_CUSTOM_PATTERNS,
  type PatternDefinition,
} from "../src/patternRegistry";
import { parseRepoConfig } from "../src/repoConfig";
import { assessRisk } from "../src/riskEngine";
import { sanitize } from "../src/sanitizer";
import { detectSensitiveData, sanitizeSensitiveData } from "../src/sensitive";

// ---------------------------------------------------------------------------
// compilePattern — basic compilation
// ---------------------------------------------------------------------------

test("compilePattern returns a valid CompiledPattern for a well-formed definition", () => {
  const def: PatternDefinition = {
    id: "test_token",
    label: "Test Token",
    regex: "TEST_[A-Z0-9]{8}",
    placeholder: "<TEST_TOKEN>",
    riskScore: 20,
  };
  const pattern = compilePattern(def);
  assert.ok(pattern !== null);
  assert.equal(pattern.id, "test_token");
  assert.equal(pattern.label, "Test Token");
  assert.equal(pattern.placeholder, "<TEST_TOKEN>");
  assert.equal(pattern.riskScore, 20);
  assert.equal(pattern.critical, false);
});

test("compilePattern enforces the global 'g' flag when flags is omitted", () => {
  const def: PatternDefinition = { id: "x", label: "X", regex: "abc" };
  const pattern = compilePattern(def);
  assert.ok(pattern !== null);
  assert.ok(pattern.regex.flags.includes("g"), "global flag must be present");
});

test("compilePattern enforces the global 'g' flag when flags does not include it", () => {
  const def: PatternDefinition = { id: "x", label: "X", regex: "abc", flags: "i" };
  const pattern = compilePattern(def);
  assert.ok(pattern !== null);
  assert.ok(pattern.regex.flags.includes("g"), "global flag must be added");
  assert.ok(pattern.regex.flags.includes("i"), "original flags must be preserved");
});

test("compilePattern keeps 'g' flag when already present in flags", () => {
  const def: PatternDefinition = { id: "x", label: "X", regex: "abc", flags: "gi" };
  const pattern = compilePattern(def);
  assert.ok(pattern !== null);
  const gCount = (pattern.regex.flags.match(/g/g) ?? []).length;
  assert.equal(gCount, 1, "should not duplicate the g flag");
});

test("compilePattern returns null and calls warnCallback for an invalid regex", () => {
  const warnings: string[] = [];
  const def: PatternDefinition = { id: "bad", label: "Bad", regex: "[invalid((" };
  const pattern = compilePattern(def, (msg) => warnings.push(msg));
  assert.equal(pattern, null);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes("bad"), "warning should mention the pattern id");
});

test("compilePattern returns null for a disabled pattern", () => {
  const def: PatternDefinition = { id: "x", label: "X", regex: "abc", enabled: false };
  const pattern = compilePattern(def);
  assert.equal(pattern, null);
});

test("compilePattern defaults placeholder to <REDACTED>", () => {
  const def: PatternDefinition = { id: "x", label: "X", regex: "abc" };
  const pattern = compilePattern(def);
  assert.ok(pattern !== null);
  assert.equal(pattern.placeholder, "<REDACTED>");
});

test("compilePattern clamps riskScore to 0..100", () => {
  const low = compilePattern({ id: "a", label: "A", regex: "a", riskScore: -50 });
  const high = compilePattern({ id: "b", label: "B", regex: "b", riskScore: 200 });
  assert.ok(low !== null && low.riskScore === 0);
  assert.ok(high !== null && high.riskScore === 100);
});

test("compilePattern respects critical flag", () => {
  const def: PatternDefinition = { id: "x", label: "X", regex: "abc", critical: true };
  const pattern = compilePattern(def);
  assert.ok(pattern !== null);
  assert.equal(pattern.critical, true);
});

// ---------------------------------------------------------------------------
// buildPatternList — merging precedence
// ---------------------------------------------------------------------------

test("buildPatternList with no custom patterns returns built-ins only", () => {
  const patterns = buildPatternList([]);
  assert.equal(patterns.length, BUILT_IN_PATTERNS.length);
  assert.deepEqual(
    patterns.map((p) => p.id),
    BUILT_IN_PATTERNS.map((p) => p.id),
  );
});

test("buildPatternList appends custom patterns after built-ins", () => {
  const custom: PatternDefinition = {
    id: "vendor_key",
    label: "Vendor Key",
    regex: "VNDR_[a-z0-9]{24}",
  };
  const patterns = buildPatternList([custom]);
  assert.equal(patterns.length, BUILT_IN_PATTERNS.length + 1);
  assert.equal(patterns[BUILT_IN_PATTERNS.length].id, "vendor_key");
});

test("buildPatternList skips invalid custom patterns and warns once", () => {
  const warnings: string[] = [];
  const defs: PatternDefinition[] = [
    { id: "bad", label: "Bad", regex: "[[invalid" },
    { id: "good", label: "Good", regex: "GOOD_[A-Z]{4}" },
  ];
  const patterns = buildPatternList(defs, (msg) => warnings.push(msg));
  assert.equal(patterns.length, BUILT_IN_PATTERNS.length + 1);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes("bad"));
});

test("buildPatternList caps custom patterns at MAX_CUSTOM_PATTERNS", () => {
  const many: PatternDefinition[] = Array.from({ length: MAX_CUSTOM_PATTERNS + 10 }, (_, i) => ({
    id: `p${i}`,
    label: `P${i}`,
    regex: `PATTERN_${i}_[A-Z]{4}`,
  }));
  const patterns = buildPatternList(many);
  assert.equal(patterns.length, BUILT_IN_PATTERNS.length + MAX_CUSTOM_PATTERNS);
});

// ---------------------------------------------------------------------------
// Custom pattern detection
// ---------------------------------------------------------------------------

test("custom pattern is detected by detectSensitiveData", () => {
  const custom: PatternDefinition = {
    id: "vendor_token",
    label: "Vendor API Token",
    regex: String.raw`\bVNDR_[a-z0-9]{24}\b`,
  };
  const patterns = buildPatternList([custom]);
  const result = detectSensitiveData("token = VNDR_abcdefghijklmnopqrstuvwx", patterns);
  assert.ok(result.includes("Vendor API Token"));
});

test("custom pattern is sanitized by sanitizeSensitiveData", () => {
  const custom: PatternDefinition = {
    id: "company_token",
    label: "Company Token",
    regex: "COMPANY_[A-Z0-9]{8}",
    placeholder: "<COMPANY_TOKEN>",
  };
  const patterns = buildPatternList([custom]);
  const result = sanitizeSensitiveData("secret=COMPANY_ABCD1234", patterns);
  assert.equal(result, "secret=<COMPANY_TOKEN>");
});

test("custom pattern contributes riskScore to assessRisk", () => {
  const custom: PatternDefinition = {
    id: "company_token",
    label: "Company Token",
    regex: "COMPANY_[A-Z0-9]{8}",
    riskScore: 45,
  };
  const patterns = buildPatternList([custom]);
  const result = assessRisk("secret=COMPANY_ABCD1234", undefined, patterns);
  assert.ok(result.findings.includes("Company Token"));
  assert.ok(result.score >= 45);
});

test("custom pattern with critical:true escalates risk to at least 60", () => {
  const custom: PatternDefinition = {
    id: "internal_key",
    label: "Internal Key",
    regex: "INT_KEY_[A-Z0-9]{8}",
    riskScore: 30,
    critical: true,
  };
  const patterns = buildPatternList([custom]);
  const result = assessRisk("INT_KEY_ABCDE123", undefined, patterns);
  assert.ok(result.score >= 60);
  assert.equal(result.level, "HIGH");
});

test("custom pattern sanitize uses its placeholder", () => {
  const custom: PatternDefinition = {
    id: "token",
    label: "Token",
    regex: "TOK_[A-Z]{6}",
    placeholder: "<MY_TOKEN>",
  };
  const patterns = buildPatternList([custom]);
  const result = sanitize("value=TOK_ABCDEF", patterns);
  assert.equal(result, "value=<MY_TOKEN>");
});

// ---------------------------------------------------------------------------
// parseRepoConfig — repo config file parsing
// ---------------------------------------------------------------------------

test("parseRepoConfig returns empty array for invalid JSON", () => {
  const result = parseRepoConfig("not json {{");
  assert.deepEqual(result, []);
});

test("parseRepoConfig returns empty array when patterns key is missing", () => {
  const result = parseRepoConfig(JSON.stringify({ version: 1 }));
  assert.deepEqual(result, []);
});

test("parseRepoConfig returns empty array when patterns is not an array", () => {
  const result = parseRepoConfig(JSON.stringify({ patterns: "bad" }));
  assert.deepEqual(result, []);
});

test("parseRepoConfig filters out entries missing required fields", () => {
  const json = JSON.stringify({
    patterns: [
      { id: "ok", label: "OK", regex: "abc" },
      { label: "Missing id", regex: "abc" },
      { id: "miss_regex", label: "Missing regex" },
      { id: "miss_label", regex: "abc" },
      {},
    ],
  });
  const result = parseRepoConfig(json);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "ok");
});

test("parseRepoConfig parses a well-formed repo config", () => {
  const json = JSON.stringify({
    patterns: [
      {
        id: "vendor_token",
        label: "Vendor API Token",
        regex: String.raw`\bVNDR_[a-z0-9]{24}\b`,
        placeholder: "<VENDOR_TOKEN>",
        riskScore: 60,
        critical: true,
        enabled: true,
      },
    ],
  });
  const result = parseRepoConfig(json);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "vendor_token");
  assert.equal(result[0].riskScore, 60);
  assert.equal(result[0].critical, true);
});

// ---------------------------------------------------------------------------
// BUILT_IN_PATTERNS — sanity checks
// ---------------------------------------------------------------------------

test("all built-in patterns have a global regex", () => {
  for (const pattern of BUILT_IN_PATTERNS) {
    assert.ok(pattern.regex.flags.includes("g"), `Pattern "${pattern.id}" must have global flag`);
  }
});

test("all built-in patterns have non-empty ids and labels", () => {
  for (const pattern of BUILT_IN_PATTERNS) {
    assert.ok(pattern.id.length > 0, "id must not be empty");
    assert.ok(pattern.label.length > 0, "label must not be empty");
  }
});

test("built-in hardcoded_secret pattern preserves key name in sanitization", () => {
  const pattern = BUILT_IN_PATTERNS.find((p) => p.id === "hardcoded_secret");
  assert.ok(pattern !== undefined);
  const result = pattern.sanitize('password = "mysecret"');
  assert.equal(result, 'password = "<SECRET>"');
  // Confirm the key name is preserved, not replaced
  assert.ok(result.startsWith("password"));
});

// ---------------------------------------------------------------------------
// URL detection + allow-list
// ---------------------------------------------------------------------------

test("URL patterns redact generic and credentialed URLs by default", () => {
  const general = BUILT_IN_PATTERNS.find((p) => p.id === "url_general");
  const cred = BUILT_IN_PATTERNS.find((p) => p.id === "url_with_credentials");
  assert.ok(general && cred, "URL patterns must exist");

  let text = "see https://example.com/docs and https://user:pw@secret.com/x";
  text = cred.sanitize(text);
  text = general.sanitize(text);
  assert.ok(!text.includes("example.com"), "generic URL should be redacted");
  assert.ok(text.includes("<URL_WITH_CREDENTIALS>"), "credentialed URL must be redacted");
});

test("isUrlAllowed matches exact and wildcard hosts case-insensitively", () => {
  setUrlAllowlist(["Example.com", "*.trusted.dev"]);
  try {
    assert.equal(isUrlAllowed("https://example.com/path"), true);
    assert.equal(isUrlAllowed("https://api.trusted.dev/x"), true);
    assert.equal(isUrlAllowed("https://other.dev/x"), false);
    assert.equal(isUrlAllowed("https://untrusted.com"), false);
  } finally {
    setUrlAllowlist([]);
  }
});

test("allow-listed URLs are neither detected nor sanitized", () => {
  setUrlAllowlist(["example.com"]);
  try {
    const text = "visit https://example.com/docs please";
    const detected = detectSensitiveData(text);
    assert.ok(
      !detected.includes("URL"),
      "allow-listed URL host should not be reported as a URL finding",
    );
    assert.equal(sanitize(text), text, "allow-listed URL should be left untouched");

    const risky = "https://example.com " + 'password = "secret"';
    const stillDetected = detectSensitiveData(risky);
    assert.ok(stillDetected.includes("Hardcoded secret"), "other patterns still detect");
    assert.ok(!stillDetected.includes("URL"), "allow-listed URL host not reported");
  } finally {
    setUrlAllowlist([]);
  }
});

test("credentialed URL on an allow-listed host is not redacted", () => {
  setUrlAllowlist(["example.com"]);
  try {
    const text = "https://user:pw@example.com/x";
    assert.equal(sanitize(text), text, "trusted host with credentials stays intact");
  } finally {
    setUrlAllowlist([]);
  }
});

// ---------------------------------------------------------------------------
// Base64 / IP false-positive hardening
// ---------------------------------------------------------------------------

test("high-entropy base64 is flagged, low-entropy long strings are not", () => {
  const base64 = BUILT_IN_PATTERNS.find((p) => p.id === "high_entropy_base64");
  assert.ok(base64, "base64 pattern must exist");

  const random = "ZmFrZXNlY3JldGtleTEyMzQ1Njc4OWFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6";
  assert.ok(base64.shouldIgnore?.(random) === false, "random base64 should be detected");

  const identifier = "thisIsJustAVeryLongCamelCaseIdentifierNameWithoutAnyRandomnessAtAll";
  assert.equal(base64.shouldIgnore?.(identifier), true, "ordinary identifier should be ignored");

  const hex = "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5";
  assert.equal(base64.shouldIgnore?.(hex), true, "hex digest should be ignored");

  // Real-world base64url tokens (with -/_) must still be detected.
  const base64url = "q7z7Kp9mX2vN4bR8tL1cW3eY5uI6oP0aS9dF2gH4jK";
  assert.equal(
    base64.shouldIgnore?.(base64url),
    false,
    "random base64url token should be detected",
  );

  const longSecret = "xK9mP2qR7vN4tB8wL1cZ3yE5uI0oA6sD9fG2hJ4kM5nX8pQ1rS3tU7vW";
  assert.equal(
    base64.shouldIgnore?.(longSecret),
    false,
    "long random alphanumeric secret should be detected",
  );
});

test("invalid IP octets (>=256) are ignored", () => {
  const ip = BUILT_IN_PATTERNS.find((p) => p.id === "ip_address");
  assert.ok(ip, "ip pattern must exist");
  assert.equal(ip.shouldIgnore?.("256.1.1.1"), true, "octet > 255 is not a real IP");
  assert.equal(ip.shouldIgnore?.("192.168.1.1"), false, "valid private IP is detected");
});

test("hardcoded_secret does not re-redact an existing placeholder", () => {
  const pattern = BUILT_IN_PATTERNS.find((p) => p.id === "hardcoded_secret");
  assert.ok(pattern !== undefined);
  assert.equal(
    pattern.sanitize('api_key = "<API_KEY>"'),
    'api_key = "<API_KEY>"',
    "already-sanitized value must be left untouched",
  );
  assert.equal(
    pattern.sanitize('api_key = "realvalue"'),
    'api_key = "<SECRET>"',
    "real value is still redacted",
  );
});

// ---------------------------------------------------------------------------
// Popular service tokens + PII (added in the next-version batch)
// ---------------------------------------------------------------------------

test("popular service-token and PII patterns detect and redact", () => {
  const cases: Array<{ input: string; label: string; placeholder: string }> = [
    { input: `AIza${"A".repeat(35)}`, label: "Google API key", placeholder: "<GOOGLE_API_KEY>" },
    {
      input: "sk_live_" + "a".repeat(24),
      label: "Stripe key",
      placeholder: "<STRIPE_KEY>",
    },
    {
      input: "whsec_abcDEF123ghiJKL456mnoPQR789stu",
      label: "Stripe webhook secret",
      placeholder: "<STRIPE_WEBHOOK_SECRET>",
    },
    {
      input: "xoxb-1234567890-1234567890123-abcdefABCDEF",
      label: "Slack token",
      placeholder: "<SLACK_TOKEN>",
    },
    {
      input: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXX",
      label: "Slack webhook URL",
      placeholder: "<SLACK_WEBHOOK>",
    },
    {
      input: "AC" + "0".repeat(32),
      label: "Twilio account SID",
      placeholder: "<TWILIO_SID>",
    },
    {
      input: "SK" + "0".repeat(32),
      label: "Twilio API key",
      placeholder: "<TWILIO_API_KEY>",
    },
    {
      input: "123456789:AAH7xKq9abcdefGHIJKLMNOPQRSTUVwxyzZ",
      label: "Telegram bot token",
      placeholder: "<TELEGRAM_BOT_TOKEN>",
    },
    { input: "arn:aws:iam::123456789012:user/example", label: "AWS ARN", placeholder: "<AWS_ARN>" },
    { input: "+14155552671", label: "Phone number", placeholder: "<PHONE_NUMBER>" },
    { input: "415-555-2671", label: "Phone number", placeholder: "<PHONE_NUMBER>" },
  ];

  for (const { input, label, placeholder } of cases) {
    assert.ok(detectSensitiveData(input).includes(label), `expected to detect ${label}`);
    assert.ok(sanitize(input).includes(placeholder), `expected to redact ${label}`);
  }
});

test("Slack webhook URL is redacted as a webhook, not a generic URL", () => {
  const input = "https://hooks.slack.com/services/T000/B000/XXXX";
  assert.equal(sanitize(input), "<SLACK_WEBHOOK>");
});

test("hardcoded_secret keyword set covers more secret names", () => {
  const pattern = BUILT_IN_PATTERNS.find((p) => p.id === "hardcoded_secret");
  assert.ok(pattern !== undefined);
  for (const line of [
    'client_secret = "abc"',
    'access_key_id = "AKIA123"',
    'secret_key = "xyz"',
    'encryption_key = "qwe"',
    'database_url = "postgres://u:p@h:5432/db"',
    'api_token = "tok"',
    'webhook_secret = "wh"',
    'refresh_token = "rt"',
  ]) {
    pattern.regex.lastIndex = 0;
    assert.ok(pattern.regex.test(line), `expected to match: ${line}`);
  }
});
