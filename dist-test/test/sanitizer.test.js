"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("node:assert/strict");
const test = require("node:test");
const sanitizer_1 = require("../src/sanitizer");
test("sanitize replaces API key", () => {
    assert.equal((0, sanitizer_1.sanitize)("sk-12345678901234567890"), "<API_KEY>");
});
test("sanitize replaces AWS key", () => {
    assert.equal((0, sanitizer_1.sanitize)("AKIAABCDEFGHIJKLMNOP"), "<AWS_KEY>");
});
test("sanitize replaces JWT", () => {
    assert.equal((0, sanitizer_1.sanitize)("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def"), "<JWT_TOKEN>");
});
test("sanitize replaces IP address", () => {
    assert.equal((0, sanitizer_1.sanitize)("192.168.1.1"), "<IP_ADDRESS>");
});
test("sanitize replaces email", () => {
    assert.equal((0, sanitizer_1.sanitize)("dev@example.com"), "<EMAIL>");
});
test("sanitize replaces hardcoded secret", () => {
    assert.equal((0, sanitizer_1.sanitize)('password = "abc"'), 'password = "<SECRET>"');
});
test("sanitize preserves surrounding structure", () => {
    const input = "token='sk-12345678901234567890' ip=127.0.0.1";
    assert.equal((0, sanitizer_1.sanitize)(input), "token='<API_KEY>' ip=<IP_ADDRESS>");
});
test("sanitize returns clean text unchanged", () => {
    const input = "const x = 1;\nconsole.log(x);";
    assert.equal((0, sanitizer_1.sanitize)(input), input);
});
test("sanitize replaces multiple occurrences of the same type", () => {
    const input = "sk-12345678901234567890 and sk-ABCDEFGHIJKLMNOPQRSTUV";
    assert.equal((0, sanitizer_1.sanitize)(input), "<API_KEY> and <API_KEY>");
});
test("sanitize replaces secret= and api_key= variants", () => {
    const input = 'secret="abc" api_key="xyz"';
    assert.equal((0, sanitizer_1.sanitize)(input), 'secret="<SECRET>" api_key="<SECRET>"');
});
test("sanitize handles single-quoted secret value", () => {
    assert.equal((0, sanitizer_1.sanitize)("secret='abc'"), "secret='<SECRET>'");
});
test("sanitize handles double-quoted api_key value", () => {
    assert.equal((0, sanitizer_1.sanitize)('api_key = "xyz"'), 'api_key = "<SECRET>"');
});
test("sanitize replaces all mixed sensitive types in one string", () => {
    const input = [
        "sk-12345678901234567890",
        "AKIAABCDEFGHIJKLMNOP",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def",
        "192.168.1.1",
        "dev@example.com",
        'secret = "abc"',
    ].join(" ");
    const output = (0, sanitizer_1.sanitize)(input);
    assert.equal(output, '<API_KEY> <AWS_KEY> <JWT_TOKEN> <IP_ADDRESS> <EMAIL> secret = "<SECRET>"');
});
test("sanitize replaces all sensitive values in very long input", () => {
    const block = "sk-12345678901234567890 dev@example.com secret='abc' ";
    const input = `${"const safe = 1; ".repeat(200)}${block.repeat(20)}`;
    const output = (0, sanitizer_1.sanitize)(input);
    assert.equal(output.includes("sk-12345678901234567890"), false);
    assert.equal(output.includes("dev@example.com"), false);
    assert.equal(output.includes("secret='abc'"), false);
    assert.equal(output.includes("<API_KEY>"), true);
    assert.equal(output.includes("<EMAIL>"), true);
    assert.equal(output.includes("secret='<SECRET>'"), true);
});
//# sourceMappingURL=sanitizer.test.js.map