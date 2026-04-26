# Safe Send

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=chaluvadis.safe-send)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## What is Safe Send?

Safe Send is a VS Code extension that helps prevent accidental leakage of sensitive data when copying code or text to AI tools. It scans selected content (or full file content), detects risky patterns, and offers safe sanitization before clipboard export—powered by an **autonomous QA system** that continuously tests and improves itself.

---

## 🚀 Key Features

### 🔍 Sensitive Data Detection
- **9 built-in pattern types**: API keys, tokens, passwords, secrets, PII
- **Real-time scanning**: Detects OpenAI, AWS, GitHub, JWT, and custom patterns
- **Context-aware risk scoring**: Adjusts risk based on file type and location

### 🧼 Smart Sanitization
- **Placeholder-based replacement**: Preserves code structure
- **Multiple placeholder types**: `<API_KEY>`, `<SECRET>`, `<EMAIL>`, etc.
- **Non-destructive**: Original content stays intact until you choose to sanitize

### ⚙️ Autonomous QA System
- **Self-healing test loop**: Automatically generates, runs, and fixes tests
- **Pattern learning**: Remembers recurring issues for faster diagnosis
- **Continuous improvement**: Loop runs until all tests pass (< 5 iterations typical)

### 📋 Clipboard Monitoring
- **Background scanning**: Monitors clipboard every 200ms
- **Risk-based warnings**: Only warns for MEDIUM/HIGH risk content
- **Smart suppression**: Never blocks legitimate clipboard operations

### 🎯 Developer Experience
- **Context menu integration**: Right-click to scan
- **Command palette**: Quick access to all features
- **Configurable settings**: Custom patterns via VS Code settings or `.safe-send.json`
- **Per-file ignore**: Skip warnings for specific files

---

## 📖 Table of Contents

- [Installation](#-installation)
- [Usage](#-usage)
- [Features](#-features)
- [Configuration](#-configuration)
- [Autonomous QA System](#-autonomous-qa-system)
- [Architecture](#-architecture)
- [Testing](#-testing)
- [Documentation](#-documentation)
- [Development](#-development)
- [Contributing](#-contributing)
- [License](#-license)

---

## 📥 Installation

### From VSIX Package

1. Download the latest `.vsix` from [Releases](https://github.com/chaluvadis/safe-send-to-ai/releases)
2. Open VS Code
3. Open Extensions view: `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (Mac)
4. Click **"..."** → **"Install from VSIX..."**
5. Select the downloaded `.vsix` file
6. Click **Install**

### From Source

```bash
# Clone the repository
git clone https://github.com/chaluvadis/safe-send-to-ai.git
cd safe-send-to-ai

# Install dependencies
pnpm install

# Build the extension
pnpm run compile

# Package as VSIX
pnpm run package
```

---

## 🎬 Usage

### Basic Workflow

#### 1. Select Code to Copy

Open any file in VS Code and select the text you want to copy (or leave unselected to copy the entire file).

#### 2. Run Safe Send

**Option A: Context Menu**
- Right-click in the editor
- Select **"Safe Send: Scan & Copy for AI"** from the context menu

**Option B: Command Palette**
- Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
- Type `"Safe Send: Scan & Copy for AI"`
- Press Enter

#### 3. Review Results

**If no sensitive data found:**
- ✅ Text is copied to clipboard immediately
- ✅ No warning dialog

**If sensitive data detected:**
- ⚠️ A warning dialog appears showing:
  - Risk level (LOW / MEDIUM / HIGH)
  - Risk score (0-100)
  - Detected pattern types
  - Options: **Sanitize & Copy** | **Copy Anyway** | **Cancel**

**Choose "Sanitize & Copy":**
- Sensitive values are replaced with placeholders
- Modified text is copied to clipboard
- Example: `password = "secret123"` → `password = "<SECRET>"`

**Choose "Copy Anyway":**
- Original text is copied (unchanged)
- A warning message is shown

**Choose "Cancel":**
- Nothing is copied
- You can modify the text and try again

### Automatic Clipboard Monitoring

Safe Send automatically monitors your clipboard in the background:

1. Copy any text (from browser, editor, terminal, etc.)
2. Wait ~200ms
3. If the text contains **MEDIUM or HIGH risk** data, a warning appears
4. Choose to sanitize, allow, or ignore

**Note:** LOW risk content (emails, IPs, JWTs) doesn't trigger warnings.

### Ignoring Specific Files

When a warning appears, you can choose **"Ignore for this file"** to:
- Skip future warnings for that specific file
- Continue working without interruptions
- Still scan other files normally

---

## ⚙️ Configuration

### VS Code Settings

Open VS Code Settings (`Ctrl+,` or `Cmd+,`) and search for **"Safe Send"**:

#### Custom Patterns

Add your own sensitive data patterns:

```json
{
  "safeSend.customPatterns": [
    {
      "id": "company_api_key",
      "label": "Company API Key",
      "regex": "COMPANY_KEY_[A-Z0-9]{24}",
      "placeholder": "<COMPANY_KEY>",
      "riskScore": 60,
      "critical": true,
      "enabled": true
    }
  ]
}
```

**Pattern Schema:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | ✅ | — | Unique identifier |
| `label` | string | ✅ | — | Human-readable name |
| `regex` | string | ✅ | — | JavaScript regex (no `/` delimiters) |
| `flags` | string | ❌ | `"g"` | Regex flags (global always enforced) |
| `placeholder` | string | ❌ | `"<REDACTED>"` | Replacement text |
| `riskScore` | number | ❌ | `0` | Risk contribution (0-100) |
| `critical` | boolean | ❌ | `false` | Escalates risk to ≥60 |
| `enabled` | boolean | ❌ | `true` | Enable/disable pattern |

**Limits:**
- Maximum 50 custom patterns
- Invalid regex patterns are silently skipped (warning shown once)

#### Repository Configuration

Create a `.safe-send.json` file in your repository root:

```json
{
  "patterns": [
    {
      "id": "internal_token",
      "label": "Internal Token",
      "regex": "INTERNAL_[A-Z0-9]{32}",
      "placeholder": "<INTERNAL_TOKEN>",
      "riskScore": 50,
      "critical": false,
      "enabled": true
    }
  ]
}
```

**Benefits:**
- Version-controlled with your code
- Shared across all team members
- Automatically loaded when opening the workspace

#### Repository Config Settings

```json
{
  "safeSend.repoConfig.enabled": true,
  "safeSend.repoConfig.filename": ".safe-send.json"
}
```

### Clipboard Monitoring Settings

The extension uses the following file path modifiers to adjust risk scores:

| Path / File | Modifier | Effect |
|-------------|----------|--------|
| `.env` | `-10` | Lower risk (expected secrets) |
| `README.md` | `+10` | Higher risk (public docs) |
| `/test/` or `/tests/` | `-15` | Lower risk (test files) |

These are built-in and cannot be disabled.

---

## 🤖 Autonomous QA System

Safe Send includes a **self-healing autonomous QA system** that continuously tests and improves the extension.

### How It Works

The system runs a loop that:

1. **Analyzes** the extension codebase
2. **Generates** test cases automatically
3. **Executes** tests via Playwright
4. **Evaluates** results (pass/fail/flaky)
5. **Diagnoses** failures (root cause analysis)
6. **Fixes** issues (code patches, test corrections)
7. **Retries** failed tests

This loop continues until:
- ✅ All critical tests pass, OR
- 🛑 Maximum iterations reached (default: 5), OR
- ❌ Unresolved blocking issue detected

### Architecture

```

                  Autonomous QA System                      

                                                           
  
   CodeAnalysis      TestGenerator      Diagnosis     
      Agent              Agent                Agent       
                                                           
  - Parse code        - Create tests      - Find causes   
  - Extract feats     - Generate data      - Suggest fixes
                                                           
  
                                                           
                                                           
  
                  Orchestrator Agent                       
                                                           
  - Control loop      - Track state        - Run fixes    
                                                           
  
                                                           
                
                                                        
            
      generate → run → evaluate → fix → retry   
            
                                                        
                
                                                           
                                                           
            
      Test Results             Artifacts             
      • Loop state           • Diagnoses            
      • Metrics              • Reports              
      • Pattern DB           • Fixes                
            

```

### Running the Autonomous QA

**From Command Line:**

```bash
# Compile the extension
pnpm run compile

# Run autonomous QA loop
node dist/index.js
```

**Configuration Options:**

```typescript
{
  maxIterations: 5,              // Max loop iterations
  stopOnAllPass: true,           // Stop when all tests pass
  retryFailedTests: true,        // Retry failing tests
  maxRetriesPerTest: 2,          // Max retries per test
  continueOnCriticalFailure: false,  // Stop on critical issues
  generateTestsOnEachIteration: false, // Regenerate tests each loop
  failFast: false                // Stop if no convergence
}
```

**Output Artifacts:**

All results are saved to `test_data/`:

```
test_data/
├── cases/                    # Test case definitions
│   └── test-cases.json
├── data/                     # Test data sets
│   └── test-data.json
├── tests/                    # Playwright scripts
│   ├── extension.test.ts
│   └── playwright-scripts.json
├── runs/                     # Execution logs
│   ├── loop-state.json       # Current state
│   ├── diagnoses.json        # Failure analyses
│   ├── pattern-database.json # Learned patterns
│   └── reports/              # Loop reports
├── screenshots/              # Failure screenshots
├── traces/                   # Playwright traces
├── fixes/                    # Patch suggestions
└── reports/                  # Final reports
```

### Benefits

- 🔄 **Continuous Testing**: Automatically generates comprehensive tests
- 🐛 **Early Bug Detection**: Finds issues before they reach production
- 📈 **Pattern Learning**: Remembers recurring problems
- 🔧 **Auto-Fix Suggestions**: Provides code patches for common issues
- 📊 **Quality Metrics**: Tracks convergence and improvement over time

---

## 🏗️ Architecture

### High-Level Design

```

                   VS Code Extension Host                       

                                                               
        
      Activation      Command        Clipboard         
     Event           Handler        Monitor          
    (onStartup)        (UI)            (Background)    
        
                                                               
                      
                                                               
      
                       Core Engine                              
            
      Sensitive          Sanitizer          Risk Engine  
      Detector                                                  
            
                                                               
      
                     Context Menu                                 
            
      Editor          Title Bar          Selection        
      Right-Click     Right-Click        Based            
            
                                                               

                               
                               
                      
                       VS Code APIs      
                                             
                       - Editor API       
                       - Clipboard API    
                       - Window API       
                       - Commands API     
                      
```

### Modular Components

| Module | Responsibility | File |
|--------|---------------|------|
| **Extension Entry** | Command registration, lifecycle | `src/extension.ts` |
| **Sensitive Detector** | Pattern matching for secrets | `src/sensitive.ts` |
| **Sanitizer** | Text replacement with placeholders | `src/sanitizer.ts` |
| **Risk Engine** | Risk scoring (0-100) | `src/riskEngine.ts` |
| **Event Manager** | Clipboard monitoring (200ms polling) | `src/eventManager.ts` |
| **Pattern Registry** | Built-in + custom patterns | `src/patternRegistry.ts` |
| **Repo Config** | Load `.safe-send.json` | `src/repoConfig.ts` |
| **Code Analysis** | Parse extension codebase | `src/codeAnalysisAgent.ts` |
| **Test Generator** | Create test cases & scripts | `src/testGeneratorAgent.ts` |
| **Diagnosis Agent** | Root cause analysis | `src/diagnosisAgent.ts` |
| **Orchestrator** | Control autonomous loop | `src/orchestratorAgent.ts` |

### Data Flow

**Command Execution:**
```
User Action
    ↓
[Command Palette / Context Menu]
    ↓
VS Code Command API
    ↓
executeScanAndCopyForAI()
    ↓
    ├─→ Get Active Editor
           ↓
        Get Text (selection or full file)
           ↓
    ├─→ detectSensitiveData(text)
           ↓
        [Pattern Matching Loop]
           ↓
        Return detected types
           ↓
    ├─→ If no detections: copy & exit

    └─→ If detections found:
           ↓
         Show Warning Dialog
           ↓
        User Choice
    ┌─────────┬───────────┬────────┐
    │         │           │        │
  Sanitize   Copy      Cancel
    │         │
    ↓         ↓
 Process    Exit
 Result
    │
    ↓
Write to Clipboard
    │
    ↓
Show Feedback
```

**Autonomous QA Loop:**
```
[Start Loop]
    ↓
1. Code Analysis → AnalysisResult
    ↓
2. Test Generation → GeneratedTests
    ↓
3. Execute Tests (Playwright)
    ↓
4. Evaluate Results
    ↓
5. Diagnose Failures → FixSuggestions
    ↓
6. Apply Fixes
    ↓
7. Retry Failed Tests
    ↓
[All Pass?] ──Yes──→ [Stop: Success]
    ↓ No
[Max Iterations?] ──Yes──→ [Stop: Max Reached]
    ↓ No
[Critical Failure?] ──Yes──→ [Stop: Critical]
    ↓ No
    → Continue Loop →
```

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Expected output:
# ℹ tests 80
# ℹ suites 0
# ℹ pass 80
# ℹ fail 0
```

### Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| Sensitive Detector | 10 | ✅ |
| Sanitizer | 10 | ✅ |
| Risk Engine | 17 | ✅ |
| Event Manager | 13 | ✅ |
| Pattern Registry | 8 | ✅ |
| Repo Config | 7 | ✅ |
| Orchestrator | 4 | ✅ |
| Other | 11 | ✅ |
| **TOTAL** | **80** | **100%** |

### Test Categories

- **Unit Tests**: Pattern detection, sanitization, risk scoring
- **Integration Tests**: Command execution (manual)
- **Autonomous QA Tests**: Loop control, state management
- **Performance Tests**: Large file handling

### Manual Testing

See [docs/USER_TESTING_GUIDE.md](docs/USER_TESTING_GUIDE.md) for step-by-step manual testing instructions.

---

## 📄 Documentation

### Core Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Technical architecture and design (v2.0)
- **[Test_Data.md](docs/Test_Data.md)** - Test scenarios and sample data (v2.0)
- **[USER_TESTING_GUIDE.md](docs/USER_TESTING_GUIDE.md)** - Manual testing instructions

### Autonomous QA Documentation

- **[reports/AGENTS.md](reports/AGENTS.md)** - Kilo CLI configuration guide
- **[reports/IMPLEMENTATION_SUMMARY.md](reports/IMPLEMENTATION_SUMMARY.md)** - Complete technical implementation
- **[reports/CHANGES.md](reports/CHANGES.md)** - Version 2.0 change log
- **[reports/CHANGES_REQUIRED.md](reports/CHANGES_REQUIRED.md)** - Known issues and improvements
- **[reports/CODE_REVIEW_REPORT.md](reports/CODE_REVIEW_REPORT.md)** - Comprehensive code review
- **[reports/FINAL_SUMMARY.txt](reports/FINAL_SUMMARY.txt)** - Executive summary
- **[reports/REVIEW_COMPLETE.md](reports/REVIEW_COMPLETE.md)** - Review completion report

### Quick References

- **Pattern Types**: [ARCHITECTURE.md - Section 4.1](docs/ARCHITECTURE.md#41-sensitive-data-detector)
- **Risk Scoring**: [ARCHITECTURE.md - Section 4.3](docs/ARCHITECTURE.md#43-risk-engine)
- **Autonomous QA**: [ARCHITECTURE.md - Section 10](docs/ARCHITECTURE.md#10-autonomous-qa-system)
- **Usage Examples**: [Test_Data.md](docs/Test_Data.md)

---

## 💻 Development

### Prerequisites

- **Node.js**: >= 24.0.0
- **VS Code**: >= 1.116.0
- **Package Manager**: pnpm (recommended)

### Setup

```bash
# Clone the repository
git clone https://github.com/chaluvadis/safe-send-to-ai.git
cd safe-send-to-ai

# Install dependencies
pnpm install

# Build the extension
pnpm run compile
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm run compile` | Compile TypeScript to JavaScript |
| `pnpm run compile:test` | Compile test files |
| `pnpm test` | Run all tests |
| `pnpm run lint` | Run Biome linter |
| `pnpm run format` | Format code with Biome |
| `pnpm run package` | Create VSIX package |

### Running the Autonomous QA

```bash
# Compile first
pnpm run compile

# Run the autonomous loop
node dist/index.js
```

View results in `test_data/runs/`.

### Debugging

1. Open the project in VS Code
2. Press `F5` or click **"Run and Debug"**
3. A new VS Code window opens with the extension loaded
4. Test the extension in the development host

### Adding New Patterns

Edit `src/patternRegistry.ts`:

```typescript
{
  id: "my_custom_pattern",
  label: "My Custom Pattern",
  regex: /\bMY_[A-Z0-9]{16}\b/g,
  placeholder: "<MY_PATTERN>",
  riskScore: 50,
  critical: false,
  sanitize: makeSimpleSanitize(
    String.raw`\bMY_[A-Z0-9]{16}\b`,
    "g",
    "<MY_PATTERN>"
  ),
}
```

---

## 🤝 Contributing

We welcome contributions! Please see our [contributing guidelines](CONTRIBUTING.md) for details.

### Areas for Improvement

- [ ] Split large modules (diagnosisAgent.ts)
- [ ] Add integration tests
- [ ] Improve TypeScript types (reduce `any`)
- [ ] Add performance optimizations
- [ ] Visual regression testing
- [ ] CI/CD integration

See [CHANGES_REQUIRED.md](reports/CHANGES_REQUIRED.md) for detailed tasks.

### Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- VS Code Extension API for excellent developer experience
- TypeScript for type safety
- Playwright for testing framework
- All contributors and testers

## 📞 Support

- **Report Issues**: [GitHub Issues](https://github.com/chaluvadis/safe-send-to-ai/issues)
- **Discussions**: [GitHub Discussions](https://github.com/chaluvadis/safe-send-to-ai/discussions)
- **Email**: support@safe-send.dev

---

<div align="center">
  <strong>Stay safe. Sanitize before you share.</strong>
</div>

---