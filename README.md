# Safe Send Pro

## Badges

![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visualstudiocode&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

## What is Safe Send Pro?

Safe Send Pro is a VS Code extension that helps prevent accidental leakage of sensitive data when copying code or text to AI tools. It scans selected content (or full file content), detects risky patterns, and offers safe sanitization before clipboard export.

## Features

- 🔍 Detects common credential and secret patterns before copy
- 🧼 Sanitizes sensitive values using consistent placeholders
- 🧠 Uses Risk Engine V2 scoring to classify LOW/MEDIUM/HIGH risk
- 📋 Monitors clipboard changes with Clipboard Event Manager V2
- ⚠️ Shows actionable warnings with sanitize/allow/ignore flows
- 🧪 Includes unit tests for detectors, sanitizer, risk engine, and event manager

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

## Risk Engine V2

Risk Engine V2 computes a `0-100` risk score and maps it to:

- `LOW`: `< 30`
- `MEDIUM`: `30-59`
- `HIGH`: `>= 60`

### Base scoring per finding type

- Critical key patterns (OpenAI, Anthropic, GitHub token, AWS, Private key block): `40`
- JWT token: `25`
- Hardcoded secret: `35`
- IP address: `15`
- Email: `10`

### Bonuses and path modifiers

- `+20` when 2 or more finding types are present
- `+15` when more than 3 finding types are present
- `-10` when file path ends with `.env`
- `+10` when file path ends with `README.md`
- `-15` when path includes `/test/`
- Final score is clamped to `0-100`

## Clipboard Event Manager V2

Clipboard Event Manager V2 uses a `200ms` polling loop to inspect clipboard updates. It:

1. Skips internally-suppressed clipboard writes to avoid warning loops
2. Avoids duplicate prompts for unchanged clipboard text
3. Optionally ignores warnings per active file
4. Triggers warning flow only for MEDIUM/HIGH risk

## Commands

- `Safe Send: Scan & Copy for AI`

## Setup / Scripts

```bash
pnpm install
pnpm run compile
pnpm run build
pnpm run package
pnpm run prepublish
pnpm run lint
pnpm run format
pnpm test
```

## Folder Structure

```text
safe-send-to-ai/
├── .gitignore
├── .vscodeignore
├── biome.json
├── icon.png
├── LICENSE
├── package.json
├── README.md
├── tsconfig.json
└── src/
    ├── eventManager.test.ts
    ├── eventManager.ts
    ├── extension.ts
    ├── riskEngine.test.ts
    ├── riskEngine.ts
    ├── sanitizer.test.ts
    ├── sanitizer.ts
    ├── sensitive.test.ts
    └── sensitive.ts
```
