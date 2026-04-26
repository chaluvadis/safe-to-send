# Safe Send UX Test Project

This is a sample project for manually testing Safe Send extension features.

## Files

- `file_with_secrets.js` — contains various secret types for detection testing
- `README.md` — documentation file (tests context-aware scoring)
- `.env` — environment file (lower risk modifier)
- `test/example.test.ts` — test file (reduced risk detection)
- `normal.js` — clean file (should show no warnings)

## Quick Test

1. Open any file with secrets
2. Look for yellow squiggly underlines
3. Hover to see detection details
4. Click lightbulb → "Sanitize this ..."
5. Check status bar at bottom for risk level

## Pre-Commit Hook Test

```bash
git add .
git commit -m "test"
# Should fail if secrets present
```

Install hook via VS Code Command Palette: `Safe Send: Install Pre-Commit Hook`

## Custom Patterns

Create `.safe-send.json` in workspace root to test custom patterns.

See extension docs for details.
