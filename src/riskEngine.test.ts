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

test("assessRisk applies .env context modifier", () => {
  const base = assessRisk('password = "abc"');
  const inEnv = assessRisk('password = "abc"', "/workspace/.env");
  assert.equal(inEnv.score, base.score - 10);
});

test("assessRisk applies /test/ path modifier", () => {
  const base = assessRisk('password = "abc"');
  const inTest = assessRisk('password = "abc"', "/workspace/test/secrets.txt");
  assert.equal(inTest.score, base.score - 15);
});

test("assessRisk applies multiple findings modifier", () => {
  const result = assessRisk("sk-12345678901234567890 dev@example.com");
  assert.ok(result.score >= 70);
  assert.equal(result.level, "HIGH");
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

test("assessRisk is deterministic", () => {
  const text = 'AKIAABCDEFGHIJKLMNOP dev@example.com password = "abc"';
  const filePath = "/workspace/src/file.ts";
  assert.deepEqual(assessRisk(text, filePath), assessRisk(text, filePath));
});
