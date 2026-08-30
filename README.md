# Safe Send

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=nomad-in-code.safe-send)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**Safe Send** prevents accidental leakage of sensitive data when copying code to AI tools. It scans for secrets (API keys, passwords, tokens) and sanitizes them before they reach your clipboard.

---

## 🚀 Quick Start

1. **Install** from VS Code Extensions (`Ctrl+Shift+X` → Search "Safe Send")
2. **Select code** in your editor
3. **Right-click** → **"Safe Send: Scan & Copy for AI"**
4. **Review results** → Copy safely!

---

## 🔍 What It Does

### Detects 41 Types of Secrets

Patterns are grouped into categories. Each runs with case-insensitive matching where appropriate and is replaced by a placeholder (e.g. `<API_KEY>`).

| Category | Patterns |
|----------|----------|
| AI / LLM keys | OpenAI (`sk-…`), Anthropic (`sk-ant-…`), Google API key (`AIza…`), Google OAuth token |
| Source-control / CI | GitHub token (`ghp_…`), GitLab (`glpat-`/`glcbt-`), npm `_authToken` |
| Cloud providers | AWS key (`AKIA…`), AWS ARN, Azure connection string, GCP service account, Firebase server key, Heroku API key |
| Payment / messaging | Stripe key & webhook secret, Slack token & webhook, Twilio SID/API key, Telegram bot token |
| Databases | PostgreSQL, MySQL, MongoDB, Redis connection strings |
| Infrastructure-as-Code | Terraform variable defaults, CloudFormation secret refs, Docker Compose env secrets |
| Tokens / auth | JWT, OAuth Bearer, generic `password`/`secret`/`api_key` assignments |
| Encoded / high-entropy | base64url secrets (entropy-gated to avoid false positives) |
| Crypto keys | Bitcoin (WIF) / Ethereum private keys, `-----BEGIN … PRIVATE KEY-----` blocks |
| PII | Email, IP address, US SSN, credit card number, phone number |
| URLs | URLs with embedded credentials, plus generic URLs (configurable allow-list) |

Detection is **extensible**: add your own rules via VS Code settings or a repo-level `.safe-send.json` (see [Configuration](#-configuration)).

### Risk Levels

Risk is the sum of matched pattern scores, with a floor that forces **HIGH** whenever a *critical* secret (real API keys, tokens, private keys) is present, and context adjustments for file type (`.env`, test files, docs, IaC).

- 🟢 **LOW** (0–29): no warning (emails, IPs, phones)
- 🟡 **MEDIUM** (30–59): warning (e.g. a hardcoded password)
- 🔴 **HIGH** (60–100): warning (API keys, tokens, private keys)

> Note: clipboard monitoring only warns on MEDIUM/HIGH; LOW-risk findings are ignored so everyday copying isn't interrupted.

---

## 💻 Usage Examples

### Example: Secret Detected → Warning
```javascript
// Before: Contains an API key
const apiKey = "sk-1234567890abcdef";
```
⚠️ **Dialog appears**:
- Risk: 60/100 (HIGH)
- Detected: OpenAI API key
- Options: **Sanitize & Copy** | Copy Anyway | Cancel

✅ **After Sanitizing**:
```javascript
const apiKey = "<API_KEY>";
```

---

## 📸 Screenshots

See **[SCREENSHOTS.md](SCREENSHOTS.md)** for visual examples.

---

## ⚙️ Configuration

### Custom Patterns (VS Code settings)

```json
{
  "safeSend.customPatterns": [
    {
      "id": "company_key",
      "label": "Company Key",
      "regex": "COMPANY_[A-Z0-9]{24}",
      "placeholder": "<COMPANY_KEY>",
      "riskScore": 60,
      "critical": true
    }
  ]
}
```

### Repository Config

Create `.safe-send.json` in your project:

```json
{
  "patterns": [
    { "id": "internal_token", "label": "Internal Token", "regex": "INTERNAL_[A-Z0-9]{32}" }
  ]
}
```

### URL Allow-list

Trusted URL hosts are never redacted or flagged. Supports exact hosts and `*.example.com` wildcards (case-insensitive, scheme ignored):

```json
{
  "safeSend.urlAllowlist": ["api.example.com", "*.trusted.dev"]
}
```

### All Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `safeSend.urlAllowlist` | `string[]` | `[]` | Trusted URL hosts to skip |
| `safeSend.excludeGlobs` | `string[]` | `[]` | File globs to exclude from scanning |
| `safeSend.customPatterns` | `array` | `[]` | User-defined detection patterns (max 50) |
| `safeSend.clipboard.monitor` | `boolean` | `true` | Monitor the clipboard and warn on risk |
| `safeSend.repoConfig.enabled` | `boolean` | `true` | Load `.safe-send.json` from the workspace |
| `safeSend.repoConfig.filename` | `string` | `.safe-send.json` | Repo config file name |

---

## 🔄 Clipboard Monitoring

Safe Send automatically monitors your clipboard:

- ✅ Scans every 200ms
- ✅ Warns for MEDIUM/HIGH risk
- ✅ Ignores LOW risk (emails, IPs, phones)
- ✅ Never blocks clipboard

---

## 📊 Quality Metrics

| Metric | Value |
|--------|-------|
| Unit tests | **95 passing** (`node --test`) |
| Test files | 7 (`sensitive`, `sanitizer`, `riskEngine`, `eventManager`, `patternRegistry`, `repoConfig`, `orchestrator`) |
| Compile errors | 0 |
| Pattern coverage | 41 built-in detectors + custom/repo patterns |
| Max scan size | 200 KB per file/clipboard |

> The detection engine is covered by a real `node --test` suite. Coverage is **not** measured by a coverage tool in this repo — the earlier "100% coverage" claim has been removed.

---

## 🚀 Quick Commands

```bash
npm run install:local   # Install locally
npm run remove:local    # Remove local install
npm test                # Compile + run unit tests
pnpm run build          # Build the extension
```

---

## 🔒 Safety & Privacy

- ✅ No data collection
- ✅ No network access
- ✅ 100% offline
- ✅ Open source (MIT)
- ✅ Max 200KB file size

---

## 📚 Documentation

- **[Architecture](docs/ARCHITECTURE.md)** - Technical design
- **[Test Data](docs/Test_Data.md)** - Example inputs
- **[User Guide](docs/USER_TESTING_GUIDE.md)** - Testing instructions

---

## 💻 Development

```bash
git clone https://github.com/chaluvadis/safe-send.git
cd safe-to-send
pnpm install
pnpm run dev:setup
```

---

<div align="center">
  <strong>Stay safe. Sanitize before you share.</strong>
</div>
