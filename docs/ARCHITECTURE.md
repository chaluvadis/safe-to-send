## 6. Extension Points

### 6.1 VS Code Contributions

#### Commands

```json
"commands": [
  { "command": "safeSend.scanAndCopyForAI",      "title": "Safe Send: Scan & Copy for AI" },
  { "command": "safeSend.sanitizeSelection",     "title": "Safe Send: Sanitize Selection" },
  { "command": "safeSend.sanitizeFile",         "title": "Safe Send: Sanitize File" },
  { "command": "safeSend.sanitizeMatch",        "title": "Safe Send: Sanitize Match" },
  { "command": "safeSend.installPreCommitHook", "title": "Safe Send: Install Pre-Commit Hook" }
]
```

#### Menus

```json
"menus": {
  "editor/context": [
    {
      "command": "safeSend.scanAndCopyForAI",
      "when": "editorTextFocus && editorHasSelection",
      "group": "safe-send"
    },
    {
      "command": "safeSend.scanAndCopyForAI",
      "when": "editorTextFocus && !editorHasSelection",
      "group": "safe-send"
    }
  ],
  "editor/title/context": [
    {
      "command": "safeSend.scanAndCopyForAI",
      "when": "editorTextFocus"
    }
  ]
}
```

### 6.2 Activation Events

```json
"activationEvents": ["onStartupFinished"]
```

### 6.3 Engine Requirements

```json
"engines": {
  "vscode": "^1.116.0",
  "node": ">=24.0.0"
}
```

---

## 7. Configuration

### 7.1 TypeScript Configuration

**tsconfig.json:**
- Target: ES2022
- Module: CommonJS
- Strict mode: Enabled
- Source maps: Enabled
- Skip lib check: Enabled

### 7.2 Build Configuration

**package.json scripts:**
- `compile` - TypeScript compilation
- `compile:test` - Compile tests
- `test` - Run all tests
- `lint` - Biome linting
- `format` - Biome formatting

### 7.3 Linting Rules

**biome.json:**
- Indent style: space (2 spaces)
- Line width: 100
- Recommended lint rules
- Double quotes for JavaScript

---

## 8. Build & Deployment

### 8.1 Build Process

```
1. TypeScript Compilation
   src/*.ts → dist/*.js
   src/*.ts → dist/*.js.map

2. Test Compilation
   test/*.ts → dist-test/test/*.js

3. Package Creation
   vsce package → safe-send-0.0.1.vsix
```

### 8.2 Distribution

- **VSIX Package:** Local installation
- **VS Code Marketplace:** Remote installation

---

## 9. Testing Strategy

### 9.1 Test Pyramid

```
      [E2E Tests]          ← Future
          ↑
      [Integration]        ← Manual
          ↑
  [Component Tests]        ← 95 (Unit)
          ↑
  [No Static Tests]        ← N/A
```

### 9.2 Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| sensitive | 12 | ✅ |
| sanitizer | 14 | ✅ |
| riskEngine | 22 | ✅ |
| eventManager | 7 | ✅ |
| patternRegistry (+ repoConfig) | 36 | ✅ |
| orchestratorAgent | 4 | ✅ |
| **TOTAL** | **95** | **95/95 pass** |

> Run with `pnpm run compile && node --test "dist/**/*.test.js"`. Coverage is **not** measured by a coverage tool in this repo.

### 9.3 Test Categories

#### Unit Tests (`node --test`)
- Pattern detection (positive, negative, allow-list, base64/IP hardening)
- Sanitization accuracy (incl. placeholder double-sanitization)
- Risk scoring (all scenarios, critical floor, path modifiers)
- Event manager / clipboard behavior

#### Integration Tests
- Command execution (manual, via `test/integration`)
- Context menu interaction (manual)
- Clipboard monitoring (manual)

---

## 10. Autonomous QA System (Experimental / Prototype)

### 10.1 Overview

> ⚠️ **Status: prototype, not a substitute for the real test suite.** The agents in `src/` (`codeAnalysisAgent`, `testGeneratorAgent`, `diagnosisAgent`, `orchestratorAgent`) are scaffolding. Their test execution and "fix application" are **simulated** (they use `Math.random()` to fake pass/fail outcomes and only log fixes — they do not actually run or modify the extension). Do **not** rely on their reported metrics for quality assurance.

The authoritative quality signal is the `node --test` unit suite described in §9.2 (95 tests, all passing).

The orchestrator design (`runLoop()`) is a real control-loop skeleton that could later be wired to the actual test runner. It consists of 4 core agents and an orchestrator.

**Intended capabilities (not yet functional):**
- Automated test generation from code analysis
- Failure diagnosis with root cause analysis
- Pattern learning for recurring issues
- Automatic fix generation and application
- Continuous loop until all tests pass
- Comprehensive artifact storage and reporting

### 10.2 Agent Responsibilities

| Agent | Responsibility | Key Methods |
|-------|---------------|-------------|
| **CodeAnalysisAgent** | Parse extension, extract features | `analyze()` |
| **TestGeneratorAgent** | Generate tests and data | `generate()` |
| **DiagnosisAgent** | Identify root causes | `diagnoseFailures()` |
| **OrchestratorAgent** | Control loop execution | `runLoop()` |

### 10.3 Loop Configuration

Default settings:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxIterations` | 5 | Maximum loop iterations |
| `stopOnAllPass` | true | Stop when all tests pass |
| `retryFailedTests` | true | Retry failing tests |
| `maxRetriesPerTest` | 2 | Max retries per test |

### 10.4 Test Generation

The system automatically generates:
- **Test cases:** Happy path, failure cases, edge conditions
- **Playwright scripts:** VS Code extension tests
- **Test data:** Valid, invalid, and edge-case inputs
- **Coverage (intended):** All 41 secret patterns, path modifiers, performance scenarios

### 10.5 Diagnosis & Learning

**Root Cause Categories:**
- extension-bug: Code issues in extension
- test-issue: Test script problems
- environment-issue: Environment/setup problems
- timing-issue: Async/wait problems

**Pattern Learning:** Maintains database of recurring issues for faster diagnosis

### 10.6 Artifacts

All artifacts stored in `test_data/`:
- Loop state (`runs/loop-state.json`)
- Diagnoses (`runs/diagnoses.json`)
- Pattern database (`runs/pattern-database.json`)
- Reports (`reports/loop-report-*.json`)

### 10.7 Status

The autonomous-loop code (`src/index.ts` and the four agent modules) has been **removed** from this repository. The control-loop design above is retained as documentation only. Quality is verified by the real `node --test` suite (see §9.2), not by a simulated loop.

---

## 11. Conclusion

### 11.1 Architecture Strengths

✅ **Modular Design** - Independent, testable components  
✅ **Clear Separation** - Presentation, application, domain, infrastructure, autonomous QA layers  
✅ **Testability** - 95 unit tests (`node --test`)  
✅ **Performance** - Sub-500ms for typical use cases  
✅ **Extensibility** - Easy to add new patterns or features  
✅ **Security** - No external dependencies or network access  
✅ **Maintainability** - Clean code, documented, typed  
⚠️ **Autonomous QA** - Prototype only; real suite is §9.2

### 11.2 Design Decisions

**Why TypeScript?**
- Type safety for critical security operations
- IDE support and developer experience
- Compile-time error detection
- Easy refactoring

**Why VS Code Extension?**
- Direct access to editor and clipboard
- Seamless user experience
- Large existing ecosystem
- Cross-platform support

**Why Local Processing?**
- Privacy and security
- No network latency
- Offline capability
- No external dependencies

**Why Autonomous QA?**
- Continuous quality improvement
- Automated regression detection
- Faster feedback loops
- Reduced manual testing burden

### 11.3 Quality Metrics

- **Unit tests:** 95 passing (`node --test`)
- **Coverage tool:** not run in this repo (do not claim 100%)
- **Performance Target:** < 500ms (met for typical inputs)
- **Security Review:** No network access; offline-only
- **Autonomous QA:** prototype only — see §10.1; not a quality gate

### 11.4 Production Readiness

✅ **Ready for Production**

The Safe Send extension follows modern architectural best practices, maintains high code quality standards, and provides a secure, performant solution for preventing sensitive data leakage in AI workflows. The new autonomous QA system ensures continuous quality improvement through automated testing and diagnosis.

### 11.5 System Capabilities

| Feature | Status | Notes |
|---------|--------|-------|
| Sensitive data detection | ✅ 41 patterns | All production-ready |
| Risk scoring | ✅ | Context-aware, critical floor |
| Sanitization | ✅ | Placeholder-based |
| Clipboard monitoring | ✅ | 200ms polling |
| URL allow-list | ✅ | `safeSend.urlAllowlist` |
| Custom patterns | ✅ | Settings + `.safe-send.json` (max 50) |
| Autonomous QA | ⚠️ Experimental | Simulated; not a quality gate (see §10) |
| Pattern learning | ⏳ | Planned |
| Automatic fixes | ⏳ | Planned |
| Loop control | ⚠️ | Skeleton only |
| Artifact storage | ⚠️ | Written by prototype loop |

---

*Documentation Version: 2.0*  
*Last Updated: 2026-04-26*  
*Maintained By: Safe Send Development Team*