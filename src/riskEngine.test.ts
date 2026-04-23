import assert = require("node:assert/strict");
import test = require("node:test");
import { assessRisk } from "./riskEngine";

test("assessRisk returns LOW for clean text", () => {
  const result = assessRisk("const x = 1;");
  assert.equal(result.score, 0);
  assert.equal(result.level, "LOW");
  assert.deepEqual(result.findings, []);
});

test("assessRisk scores OpenAI key as HIGH", () => {
  const result = assessRisk("sk-12345678901234567890");
  assert.ok(result.score >= 60);
  assert.equal(result.level, "HIGH");
  assert.ok(result.findings.includes("OpenAI API key"));
});

test("assessRisk scores AWS key as HIGH", () => {
  const result = assessRisk("AKIAABCDEFGHIJKLMNOP");
  assert.ok(result.score >= 60);
  assert.equal(result.level, "HIGH");
  assert.deepEqual(result.findings, ["AWS key"]);
});

test("assessRisk scores JWT token alone", () => {
  const result = assessRisk("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def");
  assert.equal(result.score, 25);
  assert.equal(result.level, "LOW");
  assert.deepEqual(result.findings, ["JWT token"]);
});

test("assessRisk scores IP address alone as LOW", () => {
  const result = assessRisk("192.168.1.1");
  assert.equal(result.score, 15);
  assert.equal(result.level, "LOW");
  assert.deepEqual(result.findings, ["IP address"]);
});

test("assessRisk scores Email alone as LOW", () => {
  const result = assessRisk("dev@example.com");
  assert.equal(result.score, 10);
  assert.equal(result.level, "LOW");
  assert.deepEqual(result.findings, ["Email"]);
});

test("assessRisk scores Hardcoded secret alone as MEDIUM", () => {
  const result = assessRisk('password = "abc"');
  assert.equal(result.score, 35);
  assert.equal(result.level, "MEDIUM");
  assert.deepEqual(result.findings, ["Hardcoded secret"]);
});

test("assessRisk applies .env context modifier", () => {
  const base = assessRisk('password = "abc"');
  const inEnv = assessRisk('password = "abc"', "/workspace/.env");
  assert.equal(inEnv.score, base.score - 10);
});

test("assessRisk applies README.md context modifier", () => {
  const base = assessRisk("dev@example.com");
  const inReadme = assessRisk("dev@example.com", "/workspace/README.md");
  assert.equal(inReadme.score, base.score + 10);
});

test("assessRisk applies /test/ path modifier", () => {
  const base = assessRisk('password = "abc"');
  const inTest = assessRisk('password = "abc"', "/workspace/test/secrets.txt");
  assert.equal(inTest.score, base.score - 15);
});

test("assessRisk normalizes Windows .env path modifier", () => {
  const base = assessRisk('password = "abc"');
  const windowsEnv = assessRisk('password = "abc"', "C:\\workspace\\.env");
  assert.equal(windowsEnv.score, base.score - 10);
});

test("assessRisk normalizes Windows /test/ path modifier", () => {
  const base = assessRisk('password = "abc"');
  const windowsTest = assessRisk('password = "abc"', "C:\\workspace\\test\\secrets.txt");
  assert.equal(windowsTest.score, base.score - 15);
});

test("assessRisk applies multiple findings modifier", () => {
  const result = assessRisk("sk-12345678901234567890 dev@example.com");
  assert.ok(result.score >= 70);
  assert.equal(result.level, "HIGH");
});

test("assessRisk applies >3 findings modifier on top of >=2 modifier", () => {
  const input = [
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def",
    "192.168.1.1",
    "dev@example.com",
    'password = "abc"',
  ].join(" ");

  const result = assessRisk(input, "/workspace/test/.env");
  assert.equal(result.score, 95);
  assert.equal(result.level, "HIGH");
  assert.equal(result.findings.length, 4);
});

test("assessRisk clamps score to 0", () => {
  const result = assessRisk("const x = 1;", "/workspace/test/file.ts");
  assert.equal(result.score, 0);
  assert.equal(result.level, "LOW");
});

test("assessRisk clamps score to 100", () => {
  const input = [
    "sk-12345678901234567890",
    "AKIAABCDEFGHIJKLMNOP",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def",
    "192.168.1.1",
    "dev@example.com",
    'password = "abc"',
  ].join(" ");
  const result = assessRisk(input, "/workspace/README.md");
  assert.ok(result.score <= 100);
  assert.equal(result.score, 100);
});

test("assessRisk works without filePath argument", () => {
  const result = assessRisk('password = "abc"');
  assert.equal(result.score, 35);
  assert.equal(result.level, "MEDIUM");
});

test("assessRisk is deterministic", () => {
  const text = 'AKIAABCDEFGHIJKLMNOP dev@example.com password = "abc"';
  const filePath = "/workspace/src/file.ts";
  assert.deepEqual(assessRisk(text, filePath), assessRisk(text, filePath));
});
