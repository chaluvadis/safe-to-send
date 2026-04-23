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

test("sanitizeSensitiveData replaces only sensitive values", () => {
  const input =
    "token='sk-12345678901234567890' ip=127.0.0.1 email=dev@example.com password=\"abc\"";

  const output = sanitizeSensitiveData(input);
  assert.equal(output, "token='<API_KEY>' ip=<IP_ADDRESS> email=<EMAIL> password=\"<SECRET>\"");
});
