# Changelog

All notable changes to the Safe Send extension are documented here.

## [0.1.0] - 2026-08-29

### Added
- **URL detection & redaction** — `url_general` (LOW) and `url_with_credentials` (critical, HIGH) patterns.
- **URL allow-list** — `safeSend.urlAllowlist` setting; trusted hosts (exact or `*.wildcard`) are never flagged or redacted. Surfaced in `package.json` configuration.
- **Service-token coverage** — Google API key, Stripe key & webhook secret, Slack token & webhook, Twilio SID/API key, Telegram bot token, AWS ARN, phone numbers (PII).
- **Command palette entries** — registered `sanitizeSelection`, `sanitizeFile`, `sanitizeMatch`, and `installPreCommitHook` (previously only reachable via code actions).
- **Settings** — `safeSend.urlAllowlist`, `safeSend.excludeGlobs`, `safeSend.customPatterns`, `safeSend.clipboard.monitor`, `safeSend.repoConfig.*` exposed in `package.json`.

### Changed
- **Severity model** — Anthropic, GitHub, and private-key patterns are now HIGH/critical (previously scored 0 → LOW, so clipboard monitoring silently missed them).
- **`.env` risk** — a real `.env` now raises risk (was incorrectly lowered).
- **Critical-key floor** re-applied after path modifiers, so critical secrets stay HIGH even in test/doc files.
- **Base64 detection** — entropy-gated (Shannon entropy) and broadened to base64url (`-`/`_`), fixing false negatives on real tokens while still ignoring identifiers/hex.
- **IP detection** — ignores octets > 255 (versions/IDs).
- **`hardcoded_secret`** — broadened keyword set (`client_secret`, `access_key_id`, `secret_key`, `encryption_key`, `database_url`, `api_token`, `webhook_secret`, `refresh_token`) and no longer re-redacts an already-sanitized placeholder.
- **Duplicate findings** collapsed in detection and risk scoring.
- **Custom patterns** — all command paths now go through `buildPatternList` (honours the 50-pattern cap and invalid-regex warnings previously bypassed).
- **Docs** — README and ARCHITECTURE updated for 41 patterns, URL allow-list, settings, and accurate (95) unit-test counts.

### Removed
- Dead `src/constants.ts` (contradictory, unused values).
- **Simulated autonomous-QA agents** (`codeAnalysisAgent`, `testGeneratorAgent`, `diagnosisAgent`, `orchestratorAgent`, `index`): their test execution and fix-application were faked with `Math.random()`. Quality is now verified solely by the real `node --test` suite (91 tests).

### Fixed
- `detectSensitiveDataWithRanges` zero-length-match handling (now `continue` instead of `break`).
- Biome formatting/lint across the codebase (`biome check` passes).

## [0.0.4] - Initial published version
