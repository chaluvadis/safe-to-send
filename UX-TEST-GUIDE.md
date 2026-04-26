# Safe Send UX Test Guide

This workspace contains test files to verify all Safe Send features.

---

## 📁 Test Files

| File | Purpose |
|------|---------|
| `file_with_secrets.js` | Full secret detection demo (multiple types) |
| `README.md` | Documentation file (risk modifier test) |
| `.env` | Environment file (lower risk modifier) |
| `test/example.test.ts` | Test file (reduced risk) |
| `normal.js` | Clean file (no secrets) |

---

## ✅ Feature Test Matrix

### **1. Real-Time Diagnostics**
- [ ] Open `file_with_secrets.js`
- [ ] See yellow squiggly underlines under each secret
- [ ] Hover over each → tooltip says "Sensitive data detected: `<type>`"
- [ ] CodeAction lightbulb appears → "Sanitize this `<type>`"
- [ ] Click → that specific secret replaced with placeholder

**Expected detections in this file:**
| Secret | Detected As | Placeholder |
|--------|------------|-------------|
| `sk-12345678901234567890` | OpenAI API key | `<API_KEY>` |
| `AKIAABCDEFGHIJKLMNOP` | AWS key | `<AWS_KEY>` |
| `sk-ant-12345678901234567890` | Anthropic API key | `<ANTHROPIC_API_KEY>` |
| `eyJ...` (3-part) | JWT token | `<JWT_TOKEN>` |
| `192.168.1.1` | IP address | `<IP_ADDRESS>` |
| `dev@example.com` | Email | `<EMAIL>` |
| `password = "abc"` | Hardcoded secret | `password = "<SECRET>"` |
| `ghp_...` | GitHub token | `<GITHUB_TOKEN>` |
| `Bearer ya29...` | OAuth Bearer token | `<BEARER_TOKEN>` |
| `0x1a2b...` | Ethereum private key | `<ETHEREUM_PRIVATE_KEY>` |

### **2. Status Bar Indicator**
- [ ] Open `file_with_secrets.js` → status bar shows **RED** "HIGH (XX)"
- [ ] Open `normal.js` → status bar shows **GREEN** "LOW (0)"
- [ ] Click status bar → triggers "Scan & Copy for AI" command

### **3. Sanitize Selection**
- [ ] Select a few lines with secrets
- [ ] Right-click → "Safe Send: Sanitize Selection"
- [ ] Selection replaced with sanitized version

### **4. Sanitize File**
- [ ] Open any file with secrets
- [ ] Right-click in editor → "Safe Send: Sanitize File"
- [ ] Entire file sanitized in one edit

### **5. Scan & Copy for AI** (main command)
- [ ] Select some text with secrets
- [ ] Press `Ctrl+Shift+P` → "Safe Send: Scan & Copy for AI"
- [ ] Dialog shows detected patterns + risk level
- [ ] "Sanitize & Copy" → clipboard has sanitized text
- [ ] "Copy Anyway" → raw text copied with warning

### **6. Context-Aware Scoring**
- [ ] Open `.env` → status bar shows **LOWER** risk vs code file with same secrets
- [ ] Open `test/example.test.ts` → risk reduced (test key detection + test folder bonus)
- [ ] Open `README.md` → risk slightly **higher** (visible documentation penalty)

### **7. Pre-Commit Hook**
```bash
# In terminal, inside this workspace:
git add .
Safe Send: Install Pre-Commit Hook
git commit -m "test"
```
- [ ] Commit fails with error listing files/secrets
- [ ] Output shows: `[Safe Send] file_with_secrets.js: HIGH risk (score XX) — OpenAI API key, ...`
- [ ] Can bypass with `git commit --no-verify`

### **8. Exclusion Globs**
1. Open Settings (`Ctrl+,`)
2. Search "Safe Send"
3. Edit `safeSend.excludeGlobs`
4. Add pattern `"**/ignored/**"` (or any folder)
5. Create file in that folder with secret
6. [ ] No diagnostics appear for excluded file

### **9. Custom Patterns**
```bash
# Create .safe-send.json in workspace root:
cat > .safe-send.json << 'EOF'
{
  "patterns": [
    {
      "id": "my_secret",
      "label": "My Custom Pattern",
      "regex": "superkey-[A-Z0-9]+",
      "riskScore": 50
    }
  ]
}
EOF
```
- [ ] Restart VS Code or reload window
- [ ] Open a file containing `superkey-ABC123`
- [ ] Detected as "My Custom Pattern"

### **10. False Positive Mitigation**
- [ ] `sk-test-...` keys detected as "Test API key placeholder" (low risk)
- [ ] `changeme`, `your-key-here` flagged as "Common placeholder secret" (risk=1)

---

## 🐛 Bug Reporting

If something doesn't work:

1. Open Dev Tools: `Help > Toggle Developer Tools`
2. Check Console for errors (red)
3. Note which file/secret pattern triggered issue
4. File a GitHub issue with:
   - VS Code version
   - OS
   - Exact secret string that failed
   - Screenshot of diagnostic/warning

---

## 🔄 Reset Test Workspace

If you want a clean slate:
```bash
rm -rf ~/safe-send-test-workspace
# Re-run install-and-test.sh to recreate
```

---

**Last updated:** 2026-04-26  
**Extension version:** 0.0.1
