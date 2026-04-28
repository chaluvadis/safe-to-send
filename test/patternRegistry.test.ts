import assert = require("node:assert/strict");
import test = require("node:test");

import {
  BUILT_IN_PATTERNS,
  buildPatternList,
  compilePattern,
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
