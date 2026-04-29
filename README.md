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

### Detects 9 Types of Secrets

| Type | Example | Replaced With |
|------|---------|---------------|
| OpenAI Keys | `sk-1234...` | `<API_KEY>` |
| AWS Keys | `AKIA...` | `<AWS_KEY>` |
| GitHub Tokens | `ghp_...` | `<GITHUB_TOKEN>` |
| JWT Tokens | `eyJhbGc...` | `<JWT_TOKEN>` |
| Private Keys | `-----BEGIN...` | `<PRIVATE_KEY_BLOCK>` |
| IP Addresses | `192.168.1.1` | `<IP_ADDRESS>` |
| Emails | `user@domain.com` | `<EMAIL>` |
| Passwords | `password = "secret"` | `<SECRET>` |
| Anthropic Keys | `sk-ant-...` | `<ANTHROPIC_API_KEY>` |

### Risk Levels

- 🟢 **LOW** (0-29): No warning (emails, IPs)
- 🟡 **MEDIUM** (30-59): Warning (passwords)
- 🔴 **HIGH** (60-100): Warning (API keys, tokens)

---

## 💻 Usage Examples

### Example 1: Clean Code → Auto Copy
```javascript
// Before: No secrets detected
const greeting = "Hello World";
```
✅ **Result**: Copied automatically (no warning)

---

### Example 2: Secret Detected → Warning
```javascript
// Before: Contains API key
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

### Example 3: Multiple Secrets
```javascript
// Before: Multiple secrets
const config = {
  apiKey: "sk-1234567890",
  password: "secret123",
  email: "admin@company.com"
};
```
⚠️ **Risk**: 100/100 (HIGH - maximum)

✅ **After**:
```javascript
const config = {
  apiKey: "<API_KEY>",
  password: "<SECRET>",
  email: "<EMAIL>"
};
```

---

## 📸 Screenshots

See **[SCREENSHOTS.md](SCREENSHOTS.md)** for visual examples of:

1. ✅ Clean code copy (no secrets)
2. ⚠️ Single secret warning
3. ⚠️ Multiple secrets warning
4. 🧼 Sanitized output
5. 🔒 Status bar indicators
6. ⚙️ Settings configuration
7. 📋 Ignore for file feature
8. 📋 Clipboard monitoring
9. 📂 Path-based risk adjustment
10. 🎨 Command palette access

---

## ⚙️ Configuration

### Custom Patterns

Add your own detectors in VS Code Settings:

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
    {
      "id": "internal_token",
      "label": "Internal Token",
      "regex": "INTERNAL_[A-Z0-9]{32}"
    }
  ]
}
```

---

## 🛠️ Commands

| Command | Shortcut |
|---------|----------|
| Scan & Copy | `Ctrl+Shift+P` → "Safe Send" |
| Context Menu | Right-click in editor |
| Settings | `Ctrl+,` → Search "Safe Send" |

---

## 🔄 Clipboard Monitoring

Safe Send automatically monitors your clipboard:

- ✅ Scans every 200ms
- ✅ Warns for MEDIUM/HIGH risk
- ✅ Ignores LOW risk (emails, IPs)
- ✅ Never blocks clipboard

**Disable in Settings**: `safeSend.clipboard.monitor`

---

## 📊 Quality Metrics

| Metric | Value |
|--------|-------|
| Tests Passing | 80/80 ✅ |
| Test Coverage | 100% |
| Compile Errors | 0 |
| Breaking Changes | 0 |
| Lines of Code | 7,484 |

---

## 🚀 Quick Commands

```bash
# Install locally
npm run install:local

# Remove local install
npm run remove:local

# Run tests
npm test

# Build
pnpm run build
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
- **[Test Scenarios](docs/Test_Data.md)** - 100+ examples
- **[User Guide](docs/USER_TESTING_GUIDE.md)** - Testing instructions
- **[QA System](reports/IMPLEMENTATION_SUMMARY.md)** - Autonomous testing

---

## 💻 Development

```bash
# Setup
git clone https://github.com/chaluvadis/safe-send-to-ai.git
cd safe-to-send
pnpm install
pnpm run dev:setup
```

---

<div align="center">
  <strong>Stay safe. Sanitize before you share.</strong>
</div>

---
