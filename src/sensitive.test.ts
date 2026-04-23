import assert = require("node:assert/strict");
import test = require("node:test");
import { detectSensitiveData, sanitizeSensitiveData } from "./sensitive";

test("detectSensitiveData identifies all configured sensitive types", () => {
  const input = [
    "const openai = 'sk-12345678901234567890';",
    "const aws = 'AKIAABCDEFGHIJKLMNOP';",
    "const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def';",
    "const ip = '10.20.30.40';",
    "const email = 'dev@example.com';",
    'password = "supersecret";',
  ].join("\n");

  const detected = detectSensitiveData(input);
  assert.deepEqual(detected, [
    "OpenAI API key",
    "AWS key",
    "JWT token",
    "IP address",
    "Email",
    "Hardcoded secret",
  ]);
});

test("detectSensitiveData returns empty array for clean text", () => {
  const detected = detectSensitiveData("const x = 1;\nconsole.log(x);");
  assert.deepEqual(detected, []);
});

test("detectSensitiveData finds each detector type in isolation", () => {
  const cases: Array<{ input: string; expected: string }> = [
    { input: "sk-12345678901234567890", expected: "OpenAI API key" },
    { input: "AKIAABCDEFGHIJKLMNOP", expected: "AWS key" },
    { input: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def", expected: "JWT token" },
    { input: "192.168.1.1", expected: "IP address" },
    { input: "dev@example.com", expected: "Email" },
    { input: 'password = "abc"', expected: "Hardcoded secret" },
  ];

  for (const { input, expected } of cases) {
    assert.deepEqual(detectSensitiveData(input), [expected]);
  }
});

test("detectSensitiveData matches hardcoded secret keyword variants", () => {
  const detected = detectSensitiveData('secret = "abc"\napi_key = "xyz"');
  assert.deepEqual(detected, ["Hardcoded secret"]);
});

test("detectSensitiveData matches single and double quoted hardcoded secrets", () => {
  const detected = detectSensitiveData("secret='abc'\napi_key=\"xyz\"");
  assert.deepEqual(detected, ["Hardcoded secret"]);
});

test("detectSensitiveData handles multi-line mixed sensitive and clean lines", () => {
  const input = [
    "const safe = 42;",
    "const key = 'sk-12345678901234567890';",
    "notes: nothing sensitive here",
    'email = "dev@example.com"',
  ].join("\n");

  assert.deepEqual(detectSensitiveData(input), ["OpenAI API key", "Email"]);
});

test("detectSensitiveData does not match near misses", () => {
  const detected = detectSensitiveData("const a = 'sk-short'; const b = 'AKIASHORT';");
  assert.deepEqual(detected, []);
});

test("sanitizeSensitiveData replaces only sensitive values", () => {
  const input =
    "token='sk-12345678901234567890' ip=127.0.0.1 email=dev@example.com password=\"abc\"";

  const output = sanitizeSensitiveData(input);
  assert.equal(output, "token='<API_KEY>' ip=<IP_ADDRESS> email=<EMAIL> password=\"<SECRET>\"");
});

test("sanitizeSensitiveData returns clean text unchanged", () => {
  const input = "const x = 1;\nconst y = x + 1;";
  assert.equal(sanitizeSensitiveData(input), input);
});

test("sanitizeSensitiveData replaces all occurrences of the same type", () => {
  const input = "sk-12345678901234567890 then sk-ABCDEFGHIJKLMNOPQRSTUV";
  assert.equal(sanitizeSensitiveData(input), "<API_KEY> then <API_KEY>");
});

test("sanitizeSensitiveData supports secret and api_key keyword variants", () => {
  const input = "secret='abc' api_key = \"xyz\"";
  assert.equal(sanitizeSensitiveData(input), "secret='<SECRET>' api_key = \"<SECRET>\"");
});
