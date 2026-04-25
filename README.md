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

## Detected Patterns

| Pattern Type | Example | Placeholder |
| --- | --- | --- |
| OpenAI key | `sk-12345678901234567890` | `<API_KEY>` |
| Anthropic key | `sk-ant-12345678901234567890` | `<ANTHROPIC_API_KEY>` |
| GitHub token | `ghp_123456789012345678901234567890123456` | `<GITHUB_TOKEN>` |
| AWS key | `AKIAABCDEFGHIJKLMNOP` | `<AWS_KEY>` |
| JWT | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def` | `<JWT_TOKEN>` |
| Private key block | `-----BEGIN PRIVATE KEY-----` | `<PRIVATE_KEY_BLOCK>` |
| IP | `192.168.1.1` | `<IP_ADDRESS>` |
| Email | `dev@example.com` | `<EMAIL>` |
| Hardcoded secret | `password = "supersecret"` | `<SECRET>` |

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
| `pnpm run compile` | Compile TypeScript to JavaScript |
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