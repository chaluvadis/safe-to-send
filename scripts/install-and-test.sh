#!/bin/bash
set -e

echo "🚀 Safe Send UX Test Environment Setup"
echo "========================================"

# 1. Build the extension
echo ""
echo "📦 Building extension..."
pnpm run clean 2>/dev/null || true
pnpm run compile
pnpm run compile:test

# 2. Package VSIX
echo ""
echo "📦 Creating VSIX package..."
if [ -f "safe-send-0.0.1.vsix" ]; then rm safe-send-*.vsix; fi
pnpm run package

# 3. Install in VS Code
echo ""
echo "🔌 Installing extension in VS Code..."
if command -v code &> /dev/null; then
    code --install-extension safe-send-0.0.1.vsix --force
    echo "✅ Extension installed/updated"
else
    echo "❌ VS Code CLI not found!"
    echo "   Install it: https://code.visualstudio.com/docs/editor/command-line"
    echo "   macOS: Cmd+Shift+P → 'Shell Command: Install code command'"
    echo "   Linux: sudo apt install code (or download .deb from vscode.com)"
    exit 1
fi

# 4. Create test workspace (if not exists)
TEST_DIR="$HOME/safe-send-test-workspace"
if [ ! -d "$TEST_DIR" ]; then
    echo ""
    echo "📁 Creating test workspace at $TEST_DIR..."
    mkdir -p "$TEST_DIR"
    cd "$TEST_DIR"
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"
    
    # Create diverse test files
    cat > file_with_secrets.js << 'EOF'
// Test file with various secrets
const openaiKey = 'sk-12345678901234567890';
const awsKey = 'AKIAABCDEFGHIJKLMNOP';
const anthropic = 'sk-ant-12345678901234567890';
const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def';
const ip = '192.168.1.1';
const email = 'dev@example.com';
const password = "supersecret123";
const github = 'ghp_123456789012345678901234567890123456';
const bearer = 'Bearer ya29.A0AfH6SMB...';
const eth = '0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890';
EOF

    cat > README.md << 'EOF'
# Safe Send Test Project

This is a test README with example secrets:
- OpenAI: sk-12345678901234567890
- Anthropic: sk-ant-12345678901234567890
- GitHub: ghp_test1234567890abcdefghijklmnop
EOF

    cat > .env << 'EOF'
DATABASE_URL=postgres://user:password@localhost:5432/db
API_KEY=sk-test-12345678901234567890
AWS_SECRET=AKIATESTABCDEFGHIJKLMNOPQRSTUV
EOF

    mkdir -p test
    cat > test/example.test.ts << 'EOF'
describe('test suite', () => {
  it('should have test key', () => {
    const testKey = 'sk-test-ABCDEFGHIJKLMNOP';
    const anotherTest = 'ghp_test_1234567890abcdefghijklmnopqrstuvwxyz';
    expect(testKey).toBeDefined();
  });
});
EOF

    echo "✅ Test files created"
else
    echo "📁 Test workspace already exists at $TEST_DIR"
fi

# 5. Open VS Code
echo ""
echo "🚀 Opening VS Code with test workspace..."
if command -v code &> /dev/null; then
    code "$TEST_DIR"
    echo ""
    echo "✅ VS Code opened!"
else
    echo "⚠️  Could not launch VS Code automatically."
    echo "   Open manually: code \"$TEST_DIR\""
fi

# 6. Print test guide
echo ""
echo "========================================"
echo "📋 QUICK UX TEST CHECKLIST"
echo "========================================"
echo ""
echo "1. 📄 Open file_with_secrets.js"
echo "   → Yellow squiggles under secrets?"
echo "   → Hover shows 'Sensitive data detected: ...'"
echo ""
echo "2. 💡 Click lightbulb (Quick Fix)"
echo "   → 'Sanitize this OpenAI API key' works?"
echo ""
echo "3. 🧪 Right-click → 'Safe Send: Sanitize File'"
echo "   → Whole file sanitized?"
echo ""
echo "4. 🏷️  Status bar (bottom-left)"
echo "   → Shows risk level with color (red/yellow/green)"
echo "   → Clicking it triggers 'Scan & Copy for AI'"
echo ""
echo "5. ➡️  Select text → right-click → 'Safe Send: Sanitize Selection'"
echo ""
echo "6. 🔒 Test pre-commit hook:"
echo "   a. Open Command Palette (Ctrl+Shift+P)"
echo "   b. Run 'Safe Send: Install Pre-Commit Hook'"
echo "   c. In terminal: git add . && git commit -m 'test'"
echo "   → Commit blocked, shows error"
echo ""
echo "7. ⛔ Test exclusions:"
echo "   → Open .env → lower risk (context modifier)"
echo "   → Open test/example.test.ts → risk reduced (test file detection)"
echo ""
echo "8. ⚙️  Settings:"
echo "   → File > Preferences > Settings > search 'Safe Send'"
echo "   → Modify 'safeSend.excludeGlobs' → verify diagnostics skip"
echo ""
echo "📖 For more info: See README.md in test workspace"
echo ""
echo "Happy testing! 🎯"