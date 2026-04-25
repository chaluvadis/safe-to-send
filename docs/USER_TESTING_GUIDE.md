# User Experience Testing Guide

## Overview

This guide provides step-by-step instructions for testing the Safe Send extension in a real VS Code environment. Focus on user experience, behavior, and edge cases.

**See Also:**
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture and design
- [Test_Data.md](Test_Data.md) - Comprehensive test scenarios

**Package File:** `safe-send-0.0.1.vsix`
**Size:** 33.6 KB (23 files)

---

## Installation

### Method 1: Install from VSIX File (Recommended)

1. **Open VS Code**
   - Launch VS Code (version 1.116.0 or higher required)

2. **Install Extension**
   - Open Extensions view: `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (Mac)
   - Click the **"..."** (More Actions) dropdown in the top-right
   - Select **"Install from VSIX..."**
   - Navigate to `/home/surendra/Documents/safe-to-send/safe-send-0.0.1.vsix`
   - Click **Install**

3. **Verify Installation**
   - Look for **"Safe Send"** in the Extensions list
   - Status: **Enabled**
   - Version: **0.0.1**
   - Publisher: **chaluvadis**

4. **Reload VS Code**
   - If prompted, click **"Reload Required"**
   - If not prompted, manually reload: `Ctrl+Shift+P` → "Developer: Reload Window"

### Method 2: Launch Extension Development Host

For development testing:

1. Open the project in VS Code
2. Press `F5` or click **"Run and Debug"** (sidebar)
3. A new VS Code window opens with the extension loaded
4. This is ideal for testing without installing

---

## Test Scenario 1: Clean Code (No Secrets)

### Purpose
Verify extension doesn't interfere with normal workflow.

### Steps

1. Create a new TypeScript file: `test-clean.ts`
2. Paste this clean code:
   ```typescript
   function greet(name: string): string {
     return `Hello, ${name}!`;
   }

   const message = greet("World");
   console.log(message);

   const x = 42;
   const y = x * 2;
   console.log(`Result: ${y}`);
   ```
3. Select all text (or leave unselected for full file)
4. Run command: `Ctrl+Shift+P` → **"Safe Send: Scan & Copy for AI"**

### Expected Behavior ✅

- ✅ **No warning dialog appears**
- ✅ Information message: **"No sensitive data detected"**
- ✅ Text is copied to clipboard unchanged
- ✅ Paste anywhere to verify: content matches original

### What to Check

- [ ] No false positive detections
- [ ] Clipboard contains exact original text
- [ ] No performance lag
- [ ] Command completes in < 1 second

### Actual Result

- [ ]

---

## Test Scenario 2: Single Secret (OpenAI Key)

### Purpose
Test detection and sanitization of a common secret.

### Steps

1. Create a new file: `test-openai.ts`
2. Paste this code:
   ```typescript
   // Configure OpenAI client
   const OPENAI_API_KEY = "sk-12345678901234567890";
   const ORGANIZATION = "org-abc123";

   console.log("OpenAI configured");
   ```


3. Select all text
4. Run command: **"Safe Send: Scan & Copy for AI"**

### Expected Behavior ✅

1. **Warning Dialog Appears**
   - Title: ⚠️ Safe Send: Risk 60/100 (HIGH)
   - Message includes: "OpenAI API key"
   - Buttons: [Sanitize & Copy] [Copy Anyway] [Cancel]

2. Choose **"Sanitize & Copy"**
   - Information message: **"Sanitized text copied to clipboard"**
   - Clipboard contains:
     ```typescript
     // Configure OpenAI client
     const OPENAI_API_KEY = "<API_KEY>";
     const ORGANIZATION = "org-abc123";

     console.log("OpenAI configured");
     ```

### Alternative: Choose "Copy Anyway"

- Warning message: **"Original text copied to clipboard"**
- Clipboard contains original (unmodified) text

### What to Check

- [ ] Warning shows correct risk level: **HIGH**
- [ ] Detected pattern: **OpenAI API key**
- [ ] Score: **60** (not 40, due to critical key rule)
- [ ] Sanitization placeholder: **<API_KEY>** (not the real key)
- [ ] Non-sensitive data preserved (ORGANIZATION unchanged)

### Actual Result

- [ ]

---

## Test Scenario 3: Multiple Secret Types

### Purpose
Test detection of multiple secrets and risk scoring bonuses.

### Steps

1. Create file: `test-multiple-secrets.py`
2. Paste:
   ```python
   # Database and API configuration
   DB_PASSWORD = "supersecretpassword123"
   AWS_ACCESS_KEY = "AKIAABCDEFGHIJKLMNOP"
   OPENAI_KEY = "sk-12345678901234567890"
   API_ENDPOINT = "https://api.example.com"
   ADMIN_EMAIL = "admin@company.com"
   ```
3. Select all text
4. Run command: **"Safe Send: Scan & Copy for AI"**

### Expected Behavior ✅

**Warning Dialog:**
- Title shows: Risk **125** (or **100** if clamped) / 100 (HIGH)
- Lists: "Hardcoded secret, AWS key, OpenAI API key, Email"
- 4 finding types → +20 bonus
- Critical keys → scores raised to 60+

**After Sanitization:**
```python
# Database and API configuration
DB_PASSWORD = "<SECRET>"
AWS_ACCESS_KEY = "<AWS_KEY>"
OPENAI_KEY = "<API_KEY>"
API_ENDPOINT = "https://api.example.com"
ADMIN_EMAIL = "<EMAIL>"
```

### What to Check

- [ ] All 4 secret types detected
- [ ] Risk score calculated correctly (> 100 → clamped to 100)
- [ ] Risk level: **HIGH**
- [ ] All secrets replaced with placeholders
- [ ] Non-sensitive lines unchanged

### Actual Result

- [ ]

---

## Test Scenario 4: Automatic Clipboard Monitoring

### Purpose
Test background clipboard monitoring (the "Event Manager").

### Steps

**Note:** This feature monitors clipboard changes automatically after ~200ms.

1. Copy some text **outside VS Code** (e.g., from a browser or text editor):
   ```
   api_key = "sk-12345678901234567890"
   ```

2. **Wait 1-2 seconds** (the polling interval is 200ms)

3. **Expected:** Warning dialog appears
   - ⚠️ Safe Send: Risk 60/100 (HIGH) — OpenAI API key
   - Options: [Sanitize Clipboard] [Allow Copy] [Ignore for this file]

4. **Choose "Sanitize Clipboard"**
   - Should see: **"Clipboard sanitized by Safe Send"**
   - Paste somewhere to verify: shows `<API_KEY>` instead of real key

5. **Test "Ignore for this file"**
   - In VS Code, open a file (e.g., `test.ts`)
   - Copy risky text
   - Warning appears → Choose **"Ignore for this file"**
   - Copy more risky text while same file is active
   - **Expected:** No warning (file is ignored)

### What to Check

- [ ] Warning appears automatically (no manual command needed)
- [ ] Appears within ~500ms of copying
- [ ] Sanitize Clipboard works automatically
- [ ] "Ignore for this file" works for that file only
- [ ] Other files still get warnings

### Actual Result

- [ ]

---

## Test Scenario 5: Edge Cases

### Purpose
Test special characters and unusual formats.

#### Test 5a: Special Characters in Secrets

1. Create file with:
   ```javascript
   secret = "p@ssw0rd!#$%^&*()"
   api_key = 'it\'s-a-secret'
   ```
2. Run command

**Expected:** Both detected as hardcoded secrets, sanitized to `<SECRET>`

#### Test 5b: Near Misses (Should NOT Detect)

1. Create file with:
   ```javascript
   const sk = "sk-short"  // Too short
   const fake = "AKIA"    // Too short
   const user = "ghp_"    // Too short
   ```
2. Run command

**Expected:** **No warning** — these are not valid keys

#### Test 5c: Email and IP (LOW Risk)

1. Create file with:
   ```text
   Contact: user@example.com
   Server: 192.168.1.1
   ```
2. Copy text externally (not via command)

**Expected:** **No warning** — risk is LOW (< 30)

### What to Check

- [ ] Special characters in secrets handled correctly
- [ ] No false positives on near-misses
- [ ] LOW risk content doesn't trigger warnings

### Actual Result

- [ ]

---

## Test Scenario 6: Different File Types

### Purpose
Test path-based modifiers.

#### Test 6a: .env File (Reduced Risk)

1. Create `.env` file:
   ```ini
   DATABASE_URL="postgres://user:pass@localhost/db"
   SECRET_KEY="abc123"
   ```
2. Copy content

**Expected:** Risk score reduced by -10 (because .env)

#### Test 6b: README.md (Increased Risk)

1. Create `README.md`:
   ```markdown
   Contact: admin@example.com
   ```
2. Copy content

**Expected:** Risk score increased by +10 (because README.md)

#### Test 6c: /test/ Directory (Reduced Risk)

1. Create `test/fixtures.ts`:
   ```typescript
   export const TEST_API_KEY = "sk-test123";
   ```
2. Copy content

**Expected:** Risk score reduced by -15 (because /test/)

### What to Check

- [ ] .env modifier applied (-10)
- [ ] README.md modifier applied (+10)
- [ ] /test/ modifier applied (-15)

### Actual Result

- [ ]

---

## Test Scenario 7: Cancellation and Dismissal

### Purpose
Test user cancellation flows.

### Steps

1. Create file with secrets
2. Run command → Warning appears
3. Click **"Cancel"** or press <kbd>Esc</kbd>

**Expected:**
- ✅ Clipboard unchanged
- ✅ No message shown
- ✅ Command exits cleanly

4. Try with automatic monitoring:
   - Copy risky text
   - Warning appears
   - Click outside dialog or press <kbd>Esc</kbd>

**Expected:**
- ✅ Dialog closes
- ✅ Clipboard unchanged
- ✅ Can warn again if clipboard changes

### What to Check

- [ ] Cancel button works
- [ ] Esc key dismisses
- [ ] Clipboard not modified
- [ ] No error messages

### Actual Result

- [ ]

---

## Performance Testing

### Purpose
Ensure extension doesn't slow down VS Code.

### Test Commands

**Small file:**
1. Create file with 10 lines
2. Run command
3. Time from click to completion

**Expected:** < 100ms

**Large file:**
1. Create file with 1000+ lines (or paste lots of text)
2. Include some secrets
3. Run command

**Expected:** < 500ms

**Clipboard monitoring:**
1. Copy large text (10KB+)
2. Time to warning appearance

**Expected:** < 500ms

### What to Check

- [ ] Command response < 100ms for small files
- [ ] Command response < 500ms for large files
- [ ] No UI freezing
- [ ] No high CPU usage

### Actual Result

- [ ]

---

## Usability Testing Checklist

### Visual Design

- [ ] Warning dialog is clear and readable
- [ ] Risk level (LOW/MEDIUM/HIGH) is obvious
- [ ] Risk score is displayed
- [ ] Detected patterns are listed clearly
- [ ] Button labels are clear ("Sanitize & Copy", "Allow Copy", "Cancel")
- [ ] Info messages use appropriate icon (ℹ, ⚠️, ✅)
- [ ] Color-coding matches risk level (green/yellow/red)

### Interaction Design

- [ ] Buttons are large enough to click easily
- [ ] Focus is on primary button (Sanitize & Copy)
- [ ] Can use keyboard (Enter = primary, Esc = cancel)
- [ ] Dialog can be moved if needed
- [ ] Messages don't block UI unnecessarily

### Error Handling

- [ ] No crashes when copying empty selection
- [ ] No crashes when no editor is open
- [ ] Graceful handling if clipboard is unavailable
- [ ] Clear messages for all states
- [ ] No console errors in DevTools

---

## Bug Reporting Template

If you find a bug, report it with:

```
**Bug Description:**
[Short description]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Test File:**
[Content of file being tested]

**Risk Score (if applicable):**
[Score shown]

**VS Code Version:**
[Version number]

**Extension Version:**
0.0.1
```

---

## Test Environment

- **VS Code Version:** 1.116.0 or higher
- **Node.js Version:** >= 24.0.0
- **Operating System:** Windows/Linux/Mac
- **Extension Version:** 0.0.1
- **Package:** safe-send-0.0.1.vsix

---

## Quick Reference Card

| Situation | What to Do | Expected Result |
|-----------|-----------|----------------|
| Clean code | Run command | Copied, no warning |
| Has secrets | Run command | Warning appears |
| Want to copy secrets | Sanitize & Copy | Clean copy, placeholders |
| Must keep originals | Copy Anyway | Original copied, warning |
| Don't want to copy | Cancel | Nothing happens |
| Copied externally | Wait 200ms | Warning may appear |
| Same file warnings | Choose "Ignore" | No more warnings for file |
| .env files | Copy secrets | Lower risk score |
| README files | Copy emails | Higher risk score |
| Test files | Copy secrets | Lower risk score |

---

## Verification Checklist

Before reporting testing complete:

- [ ] Extension installs successfully
- [ ] Extension loads without errors
- [ ] Command appears in palette
- [ ] Clean code copies without warning
- [ ] Secrets trigger warnings
- [ ] Risk scores are correct
- [ ] Sanitization works for all pattern types
- [ ] Automatic monitoring works
- [ ] "Ignore for this file" works
- [ ] Cancellation works
- [ ] No crashes or freezes
- [ ] Performance is acceptable
- [ ] All 50 unit tests pass
- [ ] Path modifiers work (.env, README.md, /test/)
- [ ] Edge cases handled (special chars, near-misses)

---

## Support

For issues or questions:
- Review README.md
- Check dev_test.md for detailed test results
- Run `pnpm test` to verify automated tests
- Check VS Code DevTools (Help → Toggle Developer Tools) for errors