# Safe Send

## Badges

![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visualstudiocode&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

## What is Safe Send?

Safe Send is a VS Code extension that helps prevent accidental leakage of sensitive data when copying code or text to AI tools. It scans selected content (or full file content), detects risky patterns, and offers safe sanitization before clipboard export.

## Features

- 🔍 Detects common credential and secret patterns before copy
- 🧼 Sanitizes sensitive values using consistent placeholders
- 🧠 Uses Risk Engine V2 scoring to classify LOW/MEDIUM/HIGH risk
- 📋 Monitors clipboard changes with Clipboard Event Manager V2
- ⚠️ Shows actionable warnings with sanitize/allow/ignore flows
- 🔧 Supports **user-defined custom patterns** via VS Code settings or a per-repo `.safe-send.json` file
- 🧪 Includes unit tests for detectors, sanitizer, risk engine, and event manager

## Usage

### Command: Safe Send: Scan & Copy for AI

1. Open a file in VS Code
2. Select text (or leave unselected to copy entire file)
3. Run the command:
   - **Windows/Linux**: `Ctrl+Shift+P` → "Safe Send: Scan & Copy for AI"
   - **macOS**: `Cmd+Shift+P` → "Safe Send: Scan & Copy for AI"

### Scan Results

- **No sensitive data found**: Text is copied directly to clipboard
- **Sensitive data detected**: A warning dialog shows detected types with options:
  - **Sanitize & Copy**: Replaces sensitive values with placeholders, then copies
  - **Copy Anyway**: Copies original text (with warning)
  - **Cancel**: Does nothing

### Automatic Clipboard Monitoring (Enabled by default)

The extension monitors clipboard changes in the background. When risky content is detected:

- **LOW risk**: No warning (e.g., single email or IP address)
- **MEDIUM/HIGH risk**: Warning dialog with options:
  - **Sanitize Clipboard**: Replace sensitive values automatically
  - **Allow Copy**: Keep the content as-is
  - **Ignore for this file**: Don't warn again for this file path

> **Note:** Clipboard content larger than 200 KB is skipped during background monitoring to keep VS Code responsive.

## Detected Patterns

| Pattern Type | Example | Placeholder |
| --- | --- | --- |
| OpenAI key | `<API_KEY>` | `<API_KEY>` |
| Anthropic key | `<ANTHROPIC_API_KEY>` | `<ANTHROPIC_API_KEY>` |
| GitHub token | `<GITHUB_TOKEN>` | `<GITHUB_TOKEN>` |
| AWS key | `<AWS_KEY>` | `<AWS_KEY>` |
| JWT | `<JWT_TOKEN>` | `<JWT_TOKEN>` |
| Private key block | `<PRIVATE_KEY_BLOCK>` | `<PRIVATE_KEY_BLOCK>` |
| IP | `<IP_ADDRESS>` | `<IP_ADDRESS>` |
| Email | `<EMAIL>` | `<EMAIL>` |
| Hardcoded secret | `password = "<SECRET>"` | `<SECRET>` |

## Custom Patterns

You can define your own sensitive-data patterns in two ways.

### Option A — VS Code Settings (`settings.json`)

Add custom patterns to your User or Workspace settings:

```json
"safeSend.customPatterns": [
  {
    "id": "vendor_secret_key",
    "label": "Vendor Secret Key",
    "regex": "\\bVNDR_[0-9a-zA-Z]{24,}\\b",
    "flags": "g",
    "placeholder": "<VENDOR_KEY>",
    "riskScore": 60,
    "critical": true
  },
  {
    "id": "internal_api_token",
    "label": "Internal API Token",
    "regex": "CORP_[A-Z0-9]{32}",
    "placeholder": "<CORP_TOKEN>",
    "riskScore": 45
  }
]
```

### Option B — Repository Config File (`.safe-send.json`)

Place a `.safe-send.json` file in your workspace root and commit it alongside your code. This makes the policy version-controlled and shared across your team.

```json
{
  "patterns": [
    {
      "id": "vendor_secret_key",
      "label": "Vendor Secret Key",
      "regex": "\\bVNDR_[0-9a-zA-Z]{24,}\\b",
      "placeholder": "<VENDOR_KEY>",
      "riskScore": 60,
      "critical": true
    }
  ]
}
```

> In a multi-root workspace, Safe Send prefers the `.safe-send.json` from the workspace folder that contains the active file. Patterns from all workspace folders are merged when no active file is present.

### Pattern Definition Schema

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | string | ✅ | — | Unique identifier for the pattern |
| `label` | string | ✅ | — | Human-readable name shown in warnings |
| `regex` | string | ✅ | — | JavaScript regex source (no surrounding `/`) |
| `flags` | string | | `"g"` | Regex flags. The `g` (global) flag is always enforced |
| `placeholder` | string | | `"<REDACTED>"` | Text used to replace matched values during sanitization |
| `riskScore` | number | | `0` | Base risk contribution when this pattern matches (0–100) |
| `critical` | boolean | | `false` | When `true`, escalates total risk score to at least 60 |
| `enabled` | boolean | | `true` | Set to `false` to disable the pattern without removing it |

> **Tip:** Patterns are limited to 50 custom entries. Patterns with an invalid regex are silently skipped and a single warning is shown in VS Code.

### Controlling Repo Config Loading

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `safeSend.repoConfig.enabled` | boolean | `true` | Enable/disable loading `.safe-send.json` |
| `safeSend.repoConfig.filename` | string | `".safe-send.json"` | Custom config filename |

## Commands

| Command | Description |
| --- | --- |
| `Safe Send: Scan & Copy for AI` | Scans selected text or entire file for sensitive data, then copies (with optional sanitization) |

## Setup / Development

### Prerequisites

- Node.js >= 24.0.0
- pnpm (recommended) or npm
- VS Code >= 1.116.0

### Available Scripts

| Script | Description |
| --- | --- |
| `pnpm run compile` | Compile TypeScript to JavaScript (extension only) |
| `pnpm run compile:test` | Compile TypeScript including test files |
| `pnpm run package` | Package extension as `.vsix` file |
| `pnpm run lint` | Run Biome linter |
| `pnpm run format` | Format code with Biome |
| `pnpm test` | Run tests (compile + execute) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Documentation

Detailed documentation is available in the `docs/` folder:

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Complete system architecture, module design, data flows, and technical details
- **[USER_TESTING_GUIDE.md](docs/USER_TESTING_GUIDE.md)** - Step-by-step manual testing instructions and scenarios
- **[Test_Data.md](docs/Test_Data.md)** - Comprehensive test cases and sample data (1100+ test scenarios)

## Support

- Report issues: [GitHub Issues](https://github.com/chaluvadis/safe-send-to-ai/issues)
- Discussions: [GitHub Discussions](https://github.com/chaluvadis/safe-send-to-ai/discussions)