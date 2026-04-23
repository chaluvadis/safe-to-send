# Safe Send

Minimal VS Code extension to scan selected code (or full file) for sensitive data before copying for manual AI usage.

## Folder structure

```text
safe-send-to-ai/
├── .gitignore
├── biome.json
├── package.json
├── README.md
├── tsconfig.json
└── src/
    └── extension.ts
```

## Setup (pnpm only)

```bash
pnpm install
```

## Scripts

```bash
pnpm run compile
pnpm run build
pnpm run lint
pnpm run format
```

## Command

- `Safe Send: Scan & Copy for AI`

Behavior:

1. Uses selected text (or full file if no selection).
2. Detects sensitive values with regex.
3. If no match: copies original text and shows info notification.
4. If matched: shows warning with:
   - `Sanitize & Copy`
   - `Copy Anyway`
   - `Cancel`
