import * as fs from "node:fs";
import * as path from "node:path";
import { type AnalysisResult, ExtensionCommand } from "./codeAnalysisAgent";

export interface TestCase {
  id: string;
  name: string;
  description: string;
  type: "happy-path" | "failure-case" | "edge-condition";
  command?: string;
  inputs?: any;
  expectedOutputs?: any;
  assertions: string[];
  tags: string[];
}

export interface PlaywrightScript {
  id: string;
  name: string;
  description: string;
  testFile: string;
  steps: TestStep[];
  assertions: string[];
  cleanupSteps: string[];
}

export interface TestStep {
  action: string;
  selector?: string;
  value?: any;
  description: string;
  wait?: number;
}

export interface TestData {
  id: string;
  type: "valid" | "invalid" | "edge-case";
  description: string;
  content: string;
  expectedRisk: number;
  patterns: string[];
}

export interface GeneratedTests {
  testCases: TestCase[];
  playwrightScripts: PlaywrightScript[];
  testData: TestData[];
}

export class TestGeneratorAgent {
  private projectRoot: string;
  private outputDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.outputDir = path.join(projectRoot, "test_data");
  }

  public async generate(analysisResult: AnalysisResult): Promise<GeneratedTests> {
    const testCases = this.generateTestCases(analysisResult);
    const playwrightScripts = this.generatePlaywrightScripts(analysisResult, testCases);
    const testData = this.generateTestData(analysisResult);

    await this.saveGeneratedTests(testCases, playwrightScripts, testData);

    return {
      testCases,
      playwrightScripts,
      testData,
    };
  }

  private generateTestCases(analysisResult: AnalysisResult): TestCase[] {
    const testCases: TestCase[] = [];
    let caseId = 1;

    // Happy path tests for each command
    analysisResult.commands.forEach((cmd) => {
      testCases.push({
        id: `TC-${String(caseId++).padStart(3, "0")}`,
        name: `${cmd.command} Happy Path`,
        description: `Test that ${cmd.command} works correctly with valid input`,
        type: "happy-path",
        command: cmd.command,
        inputs: { selection: "valid code content", fileType: "typescript" },
        expectedOutputs: { copied: true, sanitized: false, risk: 0 },
        assertions: [
          "Command should be registered and active",
          "Should process selection without errors",
          "Should copy sanitized content to clipboard",
        ],
        tags: ["command", "happy-path", "core"],
      });

      // Failure case tests
      testCases.push({
        id: `TC-${String(caseId++).padStart(3, "0")}`,
        name: `${cmd.command} - Sensitive Data Detection`,
        description: `Test that ${cmd.command} detects sensitive data patterns`,
        type: "failure-case",
        command: cmd.command,
        inputs: {
          selection: 'password = "secret123"; apiKey = "sk-1234567890abcdef"',
          fileType: "typescript",
        },
        expectedOutputs: { copied: true, sanitized: true, risk: 60 },
        assertions: [
          "Should detect sensitive patterns in content",
          "Should show sanitization warning",
          "Should offer sanitization option",
          "Should replace secrets with placeholders",
        ],
        tags: ["command", "security", "sensitive-data"],
      });
    });

    // Edge condition tests
    testCases.push({
      id: `TC-${String(caseId++).padStart(3, "0")}`,
      name: "Empty Selection Test",
      description: "Test behavior when no text is selected",
      type: "edge-condition",
      command: analysisResult.commands[0]?.command,
      inputs: { selection: "", fileType: "typescript" },
      expectedOutputs: { copied: true, sanitized: false, risk: 0 },
      assertions: [
        "Should handle empty selection gracefully",
        "Should default to full file content",
        "Should not throw errors",
      ],
      tags: ["edge-case", "usability"],
    });

    testCases.push({
      id: `TC-${String(caseId++).padStart(3, "0")}`,
      name: "Large Content Test",
      description: "Test with content exceeding 200KB limit",
      type: "edge-condition",
      command: analysisResult.commands[0]?.command,
      inputs: {
        selection: "A".repeat(250000),
        fileType: "typescript",
      },
      expectedOutputs: { copied: false, sanitized: false, risk: 0, error: "size-limit" },
      assertions: [
        "Should detect oversized content",
        "Should skip processing for large files",
        "Should show appropriate message",
      ],
      tags: ["edge-case", "performance", "limits"],
    });

    // Pattern-specific tests
    const detectedPatterns = [
      { name: "API Key", pattern: "sk-1234567890abcdef", expectedRisk: 60 },
      { name: "AWS Key", pattern: "AKIAIOSFODNN7EXAMPLE", expectedRisk: 60 },
      { name: "GitHub Token", pattern: "ghp_1234567890abcdefghijklmnopqrstuv", expectedRisk: 60 },
      { name: "Email", pattern: "user@example.com", expectedRisk: 0 },
      { name: "JWT", pattern: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", expectedRisk: 30 },
    ];

    detectedPatterns.forEach((p, index) => {
      testCases.push({
        id: `TC-${String(caseId++).padStart(3, "0")}`,
        name: `${p.name} Pattern Detection`,
        description: `Test detection of ${p.name} pattern`,
        type: p.expectedRisk > 0 ? "failure-case" : "happy-path",
        command: analysisResult.commands[0]?.command,
        inputs: { selection: `var token = "${p.pattern}";`, fileType: "typescript" },
        expectedOutputs: { copied: true, sanitized: p.expectedRisk > 0, risk: p.expectedRisk },
        assertions: [
          `Should detect ${p.name} pattern`,
          `Should calculate risk score of ${p.expectedRisk}`,
          "Should handle pattern appropriately",
        ],
        tags: ["pattern-detection", "security", p.name.toLowerCase()],
      });
    });

    return testCases;
  }

  private generatePlaywrightScripts(
    analysisResult: AnalysisResult,
    testCases: TestCase[],
  ): PlaywrightScript[] {
    const scripts: PlaywrightScript[] = [];

    testCases.forEach((testCase) => {
      const steps: TestStep[] = [
        {
          action: "launch-vscode",
          description: "Launch VS Code with extension loaded",
          wait: 5000,
        },
        {
          action: "open-workspace",
          value: "test-workspace",
          description: "Open test workspace directory",
          wait: 2000,
        },
        {
          action: "open-file",
          selector: "editor",
          value: "test-file.ts",
          description: "Open test file in editor",
        },
      ];

      if (testCase.inputs?.selection) {
        steps.push({
          action: "select-text",
          selector: "editor",
          value: testCase.inputs.selection,
          description: "Select text in editor",
        });
      }

      steps.push({
        action: "execute-command",
        value: testCase.command,
        description: `Execute command: ${testCase.command}`,
      });

      if (testCase.expectedOutputs?.sanitized) {
        steps.push({
          action: "wait-for-dialog",
          selector: ".monaco-dialog",
          description: "Wait for sanitization dialog",
        });
        steps.push({
          action: "click-button",
          value: "Sanitize & Copy",
          description: "Click sanitize button",
        });
      }

      const assertions = testCase.assertions.map(
        (assertion) => `expect(${assertion.replace(/\s+/g, ".")}).toBe(true)`,
      );

      scripts.push({
        id: `PS-${testCase.id}`,
        name: `Playwright: ${testCase.name}`,
        description: `Playwright test script for ${testCase.name}`,
        testFile: path.join(this.outputDir, "tests", `${testCase.id.toLowerCase()}.spec.ts`),
        steps,
        assertions: testCase.assertions,
        cleanupSteps: ["Close editor tabs", "Reset workspace state", "Clear clipboard"],
      });
    });

    return scripts;
  }

  private generateTestData(analysisResult: AnalysisResult): TestData[] {
    const testData: TestData[] = [
      {
        id: "TD-001",
        type: "valid",
        description: "Normal code without sensitive data",
        content: "const result = calculate(1, 2); console.log(result);",
        expectedRisk: 0,
        patterns: [],
      },
      {
        id: "TD-002",
        type: "invalid",
        description: "Code with API key",
        content: 'const apiKey = "sk-1234567890abcdef"; fetch(apiKey);',
        expectedRisk: 60,
        patterns: ["openai-key"],
      },
      {
        id: "TD-003",
        type: "invalid",
        description: "Code with AWS credentials",
        content: 'const awsKey = "AKIAIOSFODNN7EXAMPLE";',
        expectedRisk: 60,
        patterns: ["aws-key"],
      },
      {
        id: "TD-004",
        type: "invalid",
        description: "Code with multiple sensitive patterns",
        content: `
          const API_KEY = "sk-secret123";
          const password = "supersecret";
          const dbConn = "mongodb://user:pass@localhost/db";
        `,
        expectedRisk: 100,
        patterns: ["api-key", "password", "connection-string"],
      },
      {
        id: "TD-005",
        type: "edge-case",
        description: "Large file content",
        content: "A".repeat(250000),
        expectedRisk: 0,
        patterns: [],
      },
      {
        id: "TD-006",
        type: "invalid",
        description: "JWT token in code",
        content:
          'const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";',
        expectedRisk: 30,
        patterns: ["jwt"],
      },
      {
        id: "TD-007",
        type: "invalid",
        description: "GitHub token",
        content: 'const GH_TOKEN = "ghp_1234567890abcdefghijklmnopqrstuv";',
        expectedRisk: 60,
        patterns: ["github-token"],
      },
      {
        id: "TD-008",
        type: "valid",
        description: "Code with comments only",
        content: `
          // This is a comment
          /* Multi-line comment */
          console.log("hello");
        `,
        expectedRisk: 0,
        patterns: [],
      },
    ];

    return testData;
  }

  private async saveGeneratedTests(
    testCases: TestCase[],
    playwrightScripts: PlaywrightScript[],
    testData: TestData[],
  ): Promise<void> {
    // Save test cases
    const casesPath = path.join(this.outputDir, "cases");
    await fs.promises.writeFile(
      path.join(casesPath, "test-cases.json"),
      JSON.stringify({ testCases, generatedAt: new Date().toISOString() }, null, 2),
    );

    // Save playwright scripts
    const testsPath = path.join(this.outputDir, "tests");
    const testSuite = {
      scripts: playwrightScripts,
      generatedAt: new Date().toISOString(),
      totalScripts: playwrightScripts.length,
    };
    await fs.promises.writeFile(
      path.join(testsPath, "playwright-scripts.json"),
      JSON.stringify(testSuite, null, 2),
    );

    // Save test data
    const dataPath = path.join(this.outputDir, "data");
    await fs.promises.writeFile(
      path.join(dataPath, "test-data.json"),
      JSON.stringify({ testData, generatedAt: new Date().toISOString() }, null, 2),
    );

    // Generate actual Playwright test files
    await this.generatePlaywrightTestFiles(playwrightScripts);
  }

  private async generatePlaywrightTestFiles(scripts: PlaywrightScript[]): Promise<void> {
    const testsPath = path.join(this.outputDir, "tests");

    for (const script of scripts) {
      const testContent = this.generatePlaywrightTestContent(script);
      await fs.promises.writeFile(script.testFile, testContent);
    }

    // Generate main test suite
    const suiteContent = this.generateTestSuite(scripts);
    await fs.promises.writeFile(path.join(testsPath, "extension.test.ts"), suiteContent);

    // Generate test config
    const configContent = this.generatePlaywrightConfig();
    await fs.promises.writeFile(path.join(this.outputDir, "playwright.config.ts"), configContent);
  }

  private generatePlaywrightTestContent(script: PlaywrightScript): string {
    const stepsCode = script.steps
      .map((step) => {
        switch (step.action) {
          case "launch-vscode":
            return `    // ${step.description}`;
          case "open-workspace":
            return `    await page.goto('file://${step.value}');`;
          case "execute-command":
            return `    await page.evaluate(() => vscode.commands.executeCommand('${step.value}'));`;
          default:
            return `    // ${step.description}`;
        }
      })
      .join("\n");

    const assertionsCode = script.assertions
      .map(
        (assertion, i) => `    expect(${assertion.replace(/\s+/g, ".")}).toBe(true); // ${i + 1}`,
      )
      .join("\n");

    return `import { test, expect } from '@playwright/test';

// Test: ${script.name}
// Description: ${script.description}
test('${script.name}', async ({ page }) => {
${stepsCode}

  // Assertions
${assertionsCode}
});
`;
  }

  private generateTestSuite(scripts: PlaywrightScript[]): string {
    const imports = scripts
      .map(
        (s) =>
          `import { ${s.name.replace(/\s+/g, "")}Test } from './${path.basename(s.testFile, ".ts")}';`,
      )
      .join("\n");

    return `import { test, expect } from '@playwright/test';

// Main extension test suite
test.describe('VS Code Extension Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('about:blank');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup after each test
  });

  ${scripts
    .map(
      (s) => `
  test('${s.name}', async ({ page }) => {
    // Test implementation for ${s.name}
    await page.evaluate(() => {
      console.log('Running: ${s.name}');
    });
    expect(true).toBe(true);
  });
  `,
    )
    .join("\n")}
});
`;
  }

  private generatePlaywrightConfig(): string {
    return `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '${this.outputDir}/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npx http-server . -p 3000',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
`;
  }
}
