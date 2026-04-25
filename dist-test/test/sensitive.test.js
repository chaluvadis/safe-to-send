"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("node:assert/strict");
const test = require("node:test");
const sensitive_1 = require("../src/sensitive");
test("detectSensitiveData identifies all configured sensitive types", () => {
    const input = [
        "const anthropic = 'sk-ant-12345678901234567890';",
        "const openai = 'sk-12345678901234567890';",
        "const github = 'ghp_123456789012345678901234567890123456';",
        "const aws = 'AKIAABCDEFGHIJKLMNOP';",
        "const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def';",
        "-----BEGIN PRIVATE KEY-----",
        "const ip = '10.20.30.40';",
        "const email = 'dev@example.com';",
        'password = "supersecret";',
    ].join("\n");
    const detected = (0, sensitive_1.detectSensitiveData)(input);
    assert.deepEqual(detected, [
        "Anthropic API key",
        "OpenAI API key",
        "GitHub token",
        "AWS key",
        "JWT token",
        "Private key block",
        "IP address",
        "Email",
        "Hardcoded secret",
    ]);
});
test("detectSensitiveData returns empty array for clean text", () => {
    const detected = (0, sensitive_1.detectSensitiveData)("const x = 1;\nconsole.log(x);");
    assert.deepEqual(detected, []);
});
test("detectSensitiveData finds each detector type in isolation", () => {
    const cases = [
        { input: "sk-ant-12345678901234567890", expected: "Anthropic API key" },
        { input: "sk-12345678901234567890", expected: "OpenAI API key" },
        { input: "ghp_123456789012345678901234567890123456", expected: "GitHub token" },
        { input: "AKIAABCDEFGHIJKLMNOP", expected: "AWS key" },
        { input: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def", expected: "JWT token" },
        { input: "-----BEGIN PRIVATE KEY-----", expected: "Private key block" },
        { input: "192.168.1.1", expected: "IP address" },
        { input: "dev@example.com", expected: "Email" },
        { input: 'password = "abc"', expected: "Hardcoded secret" },
    ];
    for (const { input, expected } of cases) {
        assert.deepEqual((0, sensitive_1.detectSensitiveData)(input), [expected]);
    }
});
test("detectSensitiveData matches hardcoded secret keyword variants", () => {
    const detected = (0, sensitive_1.detectSensitiveData)('secret = "abc"\napi_key = "xyz"');
    assert.deepEqual(detected, ["Hardcoded secret"]);
});
test("detectSensitiveData matches single and double quoted hardcoded secrets", () => {
    const detected = (0, sensitive_1.detectSensitiveData)("secret='abc'\napi_key=\"xyz\"");
    assert.deepEqual(detected, ["Hardcoded secret"]);
});
test("detectSensitiveData handles multi-line mixed sensitive and clean lines", () => {
    const input = [
        "const safe = 42;",
        "const key = 'sk-12345678901234567890';",
        "notes: nothing sensitive here",
        'email = "dev@example.com"',
    ].join("\n");
    assert.deepEqual((0, sensitive_1.detectSensitiveData)(input), ["OpenAI API key", "Email"]);
});
test("detectSensitiveData does not match near misses", () => {
    const detected = (0, sensitive_1.detectSensitiveData)("const a = 'sk-short'; const b = 'AKIASHORT';");
    assert.deepEqual(detected, []);
});
test("sanitizeSensitiveData replaces only sensitive values", () => {
    const input = "ant='sk-ant-12345678901234567890' token='sk-12345678901234567890' gh='ghp_123456789012345678901234567890123456' pk='-----BEGIN PRIVATE KEY-----' ip=127.0.0.1 email=dev@example.com password=\"abc\"";
    const output = (0, sensitive_1.sanitizeSensitiveData)(input);
    assert.equal(output, "ant='<ANTHROPIC_API_KEY>' token='<API_KEY>' gh='<GITHUB_TOKEN>' pk='<PRIVATE_KEY_BLOCK>' ip=<IP_ADDRESS> email=<EMAIL> password=\"<SECRET>\"");
});
test("sanitizeSensitiveData returns clean text unchanged", () => {
    const input = "const x = 1;\nconst y = x + 1;";
    assert.equal((0, sensitive_1.sanitizeSensitiveData)(input), input);
});
test("sanitizeSensitiveData replaces all occurrences of the same type", () => {
    const input = "sk-12345678901234567890 then sk-ABCDEFGHIJKLMNOPQRSTUV";
    assert.equal((0, sensitive_1.sanitizeSensitiveData)(input), "<API_KEY> then <API_KEY>");
});
test("sanitizeSensitiveData supports secret and api_key keyword variants", () => {
    const input = "secret='abc' api_key = \"xyz\"";
    assert.equal((0, sensitive_1.sanitizeSensitiveData)(input), "secret='<SECRET>' api_key = \"<SECRET>\"");
});
//# sourceMappingURL=sensitive.test.js.map