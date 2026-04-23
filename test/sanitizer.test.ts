import assert = require("node:assert/strict");
import test = require("node:test");
import { sanitize } from "../src/sanitizer";

test("sanitize replaces API key", () => {
  assert.equal(sanitize("sk-12345678901234567890"), "<API_KEY>");
});

test("sanitize replaces AWS key", () => {
  assert.equal(sanitize("AKIAABCDEFGHIJKLMNOP"), "<AWS_KEY>");
});

test("sanitize replaces JWT", () => {
  assert.equal(sanitize("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def"), "<JWT_TOKEN>");
});

test("sanitize replaces IP address", () => {
  assert.equal(sanitize("192.168.1.1"), "<IP_ADDRESS>");
});

test("sanitize replaces email", () => {
  assert.equal(sanitize("dev@example.com"), "<EMAIL>");
});

test("sanitize replaces hardcoded secret", () => {
  assert.equal(sanitize('password = "abc"'), 'password = "<SECRET>"');
});

test("sanitize preserves surrounding structure", () => {
  const input = "token='sk-12345678901234567890' ip=127.0.0.1";
  assert.equal(sanitize(input), "token='<API_KEY>' ip=<IP_ADDRESS>");
});

test("sanitize returns clean text unchanged", () => {
  const input = "const x = 1;\nconsole.log(x);";
  assert.equal(sanitize(input), input);
});

test("sanitize replaces multiple occurrences of the same type", () => {
  const input = "sk-12345678901234567890 and sk-ABCDEFGHIJKLMNOPQRSTUV";
  assert.equal(sanitize(input), "<API_KEY> and <API_KEY>");
});

test("sanitize replaces secret= and api_key= variants", () => {
  const input = 'secret="abc" api_key="xyz"';
  assert.equal(sanitize(input), 'secret="<SECRET>" api_key="<SECRET>"');
});

test("sanitize handles single-quoted secret value", () => {
  assert.equal(sanitize("secret='abc'"), "secret='<SECRET>'");
});

test("sanitize handles double-quoted api_key value", () => {
  assert.equal(sanitize('api_key = "xyz"'), 'api_key = "<SECRET>"');
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

  const output = sanitize(input);
  assert.equal(
    output,
    "<API_KEY> <AWS_KEY> <JWT_TOKEN> <IP_ADDRESS> <EMAIL> secret = \"<SECRET>\"",
  );
});

test("sanitize replaces all sensitive values in very long input", () => {
  const block = "sk-12345678901234567890 dev@example.com secret='abc' ";
  const input = `${"const safe = 1; ".repeat(200)}${block.repeat(20)}`;
  const output = sanitize(input);

  assert.equal(output.includes("sk-12345678901234567890"), false);
  assert.equal(output.includes("dev@example.com"), false);
  assert.equal(output.includes("secret='abc'"), false);
  assert.equal(output.includes("<API_KEY>"), true);
  assert.equal(output.includes("<EMAIL>"), true);
  assert.equal(output.includes("secret='<SECRET>'"), true);
});
