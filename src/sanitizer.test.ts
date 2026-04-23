import assert = require("node:assert/strict");
import test = require("node:test");
import { sanitize } from "./sanitizer";

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
