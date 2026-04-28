import * as fs from "node:fs";
import * as path from "node:path";
import type { AnalysisResult } from "./codeAnalysisAgent";
import type { GeneratedTests, TestCase } from "./testGeneratorAgent";

export interface TestResult {
  testCaseId: string;
  testName: string;
  status: "pass" | "fail" | "flaky" | "error";
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
  screenshots?: string[];
  logs?: string[];
  traces?: string[];
  retryCount?: number;
  actualOutput?: any;
  expectedOutput?: any;
}

export interface FailureDiagnosis {
  testCaseId: string;
  testName: string;
  rootCause: RootCause;
  confidence: number;
  suggestedFix: FixSuggestion;
  evidence: Evidence[];
  severity: "low" | "medium" | "high" | "critical";
}

export interface RootCause {
  category: "extension-bug" | "test-issue" | "environment-issue" | "timing-issue";
  description: string;
  location?: string;
  affectedComponent?: string;
}

export interface FixSuggestion {
  type: "code-patch" | "test-correction" | "configuration-change" | "retry";
  description: string;
  patch?: CodePatch;
  testCorrection?: TestCorrection;
  priority: "immediate" | "high" | "medium" | "low";
  estimatedEffort: "low" | "medium" | "high";
}

export interface CodePatch {
  file: string;
  line: number;
  originalCode: string;
  fixedCode: string;
  explanation: string;
  language: "typescript" | "javascript" | "json";
  risk: "low" | "medium" | "high";
}

export interface TestCorrection {
  issue: string;
  correction: string;
  line?: number;
  file?: string;
}

export interface Evidence {
  type: "log" | "screenshot" | "trace" | "error" | "state-diff";
  description: string;
  data: any;
  timestamp: string;
}

export interface PatternLearning {
  patternId: string;
  failureType: string;
  frequency: number;
  lastOccurrence: string;
  averageResolutionTime: number;
  suggestedActions: string[];
}

export class DiagnosisAgent {
  private projectRoot: string;
  private outputDir: string;
  private stateFile: string;
  private patternDatabase: Map<string, PatternLearning> = new Map();
  private failureHistory: Map<string, FailureDiagnosis[]> = new Map();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.outputDir = path.join(projectRoot, "test_data");
    this.stateFile = path.join(this.outputDir, "runs", "diagnosis-state.json");
    this.loadPatternDatabase();
    this.loadFailureHistory();
  }

  public async diagnoseFailures(
    testResults: TestResult[],
    generatedTests: GeneratedTests,
    analysisResult: AnalysisResult,
  ): Promise<FailureDiagnosis[]> {
    const diagnoses: FailureDiagnosis[] = [];

    for (const result of testResults) {
      if (result.status === "fail" || result.status === "error") {
        const diagnosis = await this.diagnoseSingleFailure(result, generatedTests, analysisResult);
        diagnoses.push(diagnosis);

        // Update pattern database
        await this.updatePatternDatabase(diagnosis);
      }
    }

    // Save diagnosis results
    await this.saveDiagnosisResults(diagnoses);

    return diagnoses;
  }

  private async diagnoseSingleFailure(
    result: TestResult,
    generatedTests: GeneratedTests,
    analysisResult: AnalysisResult,
  ): Promise<FailureDiagnosis> {
    const testCase = generatedTests.testCases.find((tc) => tc.id === result.testCaseId);

    const rootCause = await this.identifyRootCause(result, testCase, analysisResult);

    const confidence = this.calculateConfidence(result, rootCause);
    const suggestedFix = this.generateFixSuggestion(result, rootCause, testCase);
    const evidence = this.collectEvidence(result);
    const severity = this.determineSeverity(result, rootCause);

    return {
      testCaseId: result.testCaseId,
      testName: result.testName,
      rootCause,
      confidence,
      suggestedFix,
      evidence,
      severity,
    };
  }

  private async identifyRootCause(
    result: TestResult,
    testCase: TestCase | undefined,
    analysisResult: AnalysisResult,
  ): Promise<RootCause> {
    // Analyze error patterns
    const error = result.errorMessage || "";
    const stackTrace = result.stackTrace || "";

    // Check for extension-specific errors
    if (this.isExtensionBug(error, stackTrace, analysisResult)) {
      return {
        category: "extension-bug",
        description: this.describeExtensionBug(error, stackTrace),
        location: this.extractErrorLocation(stackTrace),
        affectedComponent: this.identifyAffectedComponent(error, analysisResult),
      };
    }

    // Check for test issues
    if (this.isTestIssue(error, stackTrace, result)) {
      return {
        category: "test-issue",
        description: this.describeTestIssue(error, result),
        location: testCase?.id,
      };
    }

    // Check for environment issues
    if (this.isEnvironmentIssue(error, result)) {
      return {
        category: "environment-issue",
        description: this.describeEnvironmentIssue(error, result),
        affectedComponent: "test-environment",
      };
    }

    // Default to timing issue
    return {
      category: "timing-issue",
      description: this.describeTimingIssue(error, result),
      affectedComponent: "async-execution",
    };
  }

  private isExtensionBug(
    error: string,
    stackTrace: string,
    analysisResult: AnalysisResult,
  ): boolean {
    const extensionErrorPatterns = [
      /Extension\[.*\]\.error/,
      /Cannot read property/,
      /Cannot set property/,
      /TypeError/,
      /ReferenceError/,
      /Command.*failed/,
      /not accessible/,
      /permission denied/i,
    ];

    return extensionErrorPatterns.some((pattern) => pattern.test(error));
  }

  private describeExtensionBug(error: string, stackTrace: string): string {
    if (error.includes("Cannot read property")) {
      const match = error.match(/Cannot read property '(\w+)'/);
      return `Extension attempted to read undefined property '${match?.[1] || "unknown"}'`;
    }
    if (error.includes("Cannot set property")) {
      return "Extension attempted to write to a read-only property";
    }
    if (error.includes("TypeError")) {
      return "Type mismatch in extension code";
    }
    return "Unknown extension error occurred";
  }

  private extractErrorLocation(stackTrace: string): string | undefined {
    const lines = stackTrace.split("\n");
    const relevantLines = lines.filter((line) => line.includes(".ts:") || line.includes(".js:"));
    return relevantLines[0]?.trim();
  }

  private identifyAffectedComponent(error: string, analysisResult: AnalysisResult): string {
    const components = [
      "sanitizer",
      "riskEngine",
      "patternRegistry",
      "eventManager",
      "sensitiveDetector",
      "repoConfig",
    ];

    for (const component of components) {
      if (error.toLowerCase().includes(component)) {
        return component;
      }
    }

    return "unknown-component";
  }

  private isTestIssue(error: string, stackTrace: string, result: TestResult): boolean {
    const testErrorPatterns = [
      /timeout/,
      /element.*not found/i,
      /selector.*failed/i,
      /assertion.*failed/i,
      /expected.*but got/i,
      /no\s+such\s+command/i,
    ];

    return testErrorPatterns.some((pattern) => pattern.test(error));
  }

  private describeTestIssue(error: string, result: TestResult): string {
    if (error.includes("timeout")) {
      return `Test timed out after ${result.duration}ms - possible infinite loop or slow operation`;
    }
    if (error.includes("element") && error.includes("not found")) {
      return "Test expected element not found in UI";
    }
    if (error.includes("assertion") || error.includes("expected")) {
      return "Test assertion failed - actual output differs from expected";
    }
    return "Test configuration or setup issue";
  }

  private isEnvironmentIssue(error: string, result: TestResult): boolean {
    const envErrorPatterns = [
      /network\s+error/i,
      /connection\s+refused/i,
      /unable\s+to\s+connect/i,
      /port\s+\d+\s+already\s+in\s+use/i,
      /workspace\s+not\s+found/i,
      /file\s+not\s+found/i,
      /permission\s+denied/i,
      /out\s+of\s+memory/i,
    ];

    return envErrorPatterns.some((pattern) => pattern.test(error));
  }

  private describeEnvironmentIssue(error: string, result: TestResult): string {
    if (error.includes("network")) {
      return "Network connectivity issue during test execution";
    }
    if (error.includes("port")) {
      return "Port conflict - another process using test port";
    }
    if (error.includes("workspace") || error.includes("file")) {
      return "Test workspace or file not accessible";
    }
    return "Environment configuration issue";
  }

  private describeTimingIssue(error: string, result: TestResult): string {
    return `Asynchronous timing issue - operation took ${result.duration}ms`;
  }

  private calculateConfidence(result: TestResult, rootCause: RootCause): number {
    let confidence = 50; // Base confidence

    // Adjust based on retry behavior
    if (result.retryCount && result.retryCount > 0) {
      confidence += 10 * Math.min(result.retryCount, 3);
    }

    // Adjust based on error clarity
    if (result.errorMessage && result.errorMessage.length > 50) {
      confidence += 15;
    }

    // Adjust based on evidence
    if (result.screenshots && result.screenshots.length > 0) {
      confidence += 10;
    }
    if (result.stackTrace && result.stackTrace.length > 100) {
      confidence += 10;
    }

    // Adjust based on root cause clarity
    if (rootCause.location) {
      confidence += 5;
    }

    return Math.min(confidence, 100);
  }

  private generateFixSuggestion(
    result: TestResult,
    rootCause: RootCause,
    testCase: TestCase | undefined,
  ): FixSuggestion {
    switch (rootCause.category) {
      case "extension-bug":
        return this.generateCodeFix(result, rootCause);
      case "test-issue":
        return this.generateTestFix(result, rootCause, testCase);
      case "environment-issue":
        return {
          type: "configuration-change",
          description: "Adjust test environment configuration",
          priority: "medium",
          estimatedEffort: "low",
        };
      case "timing-issue":
        return {
          type: "test-correction",
          description: "Increase wait times or add explicit waits",
          priority: "low",
          estimatedEffort: "low",
          testCorrection: {
            issue: "Timing-related flakiness",
            correction: "Add explicit waits for async operations",
            file: testCase?.id || "unknown",
          },
        };
    }
  }

  private generateCodeFix(result: TestResult, rootCause: RootCause): FixSuggestion {
    const error = result.errorMessage || "";

    if (error.includes("Cannot read property")) {
      const match = error.match(/'(\w+)'/);
      const property = match ? match[1] : "property";

      return {
        type: "code-patch",
        description: `Add null check for property '${property}'`,
        priority: "high",
        estimatedEffort: "low",
        patch: {
          file: this.extractFileFromStack(result.stackTrace || ""),
          line: this.extractLineFromStack(result.stackTrace || ""),
          originalCode: "// original code with missing check",
          fixedCode: `if (${property} && ${property}.hasOwnProperty) { /* safe access */ }`,
          explanation: `Add defensive check before accessing '${property}' to prevent undefined access errors`,
          language: "typescript",
          risk: "low",
        },
      };
    }

    if (error.includes("undefined")) {
      return {
        type: "code-patch",
        description: "Initialize missing variable or add null check",
        priority: "high",
        estimatedEffort: "low",
        patch: {
          file: this.extractFileFromStack(result.stackTrace || ""),
          line: this.extractLineFromStack(result.stackTrace || ""),
          originalCode: "// code with uninitialized variable",
          fixedCode: "const variable = defaultValue || safeFallback;",
          explanation: "Initialize variable with safe default value",
          language: "typescript",
          risk: "low",
        },
      };
    }

    return {
      type: "code-patch",
      description: "Fix extension bug in core logic",
      priority: "high",
      estimatedEffort: "medium",
      patch: {
        file: this.extractFileFromStack(result.stackTrace || ""),
        line: this.extractLineFromStack(result.stackTrace || ""),
        originalCode: "// Bug in extension code",
        fixedCode: "// Fixed extension code",
        explanation: "Resolve bug based on failure analysis",
        language: "typescript",
        risk: "medium",
      },
    };
  }

  private generateTestFix(
    result: TestResult,
    rootCause: RootCause,
    testCase: TestCase | undefined,
  ): FixSuggestion {
    const error = result.errorMessage || "";

    if (error.includes("timeout")) {
      return {
        type: "test-correction",
        description: "Increase test timeout limit",
        priority: "medium",
        estimatedEffort: "low",
        testCorrection: {
          issue: "Test timeout - operation taking too long",
          correction: `Increase timeout from default to ${(result.duration || 5000) * 2}ms`,
          file: testCase?.id || "unknown",
          line: 0,
        },
      };
    }

    if (error.includes("element") && error.includes("not found")) {
      return {
        type: "test-correction",
        description: "Fix element selector or add wait",
        priority: "medium",
        estimatedEffort: "medium",
        testCorrection: {
          issue: "Element selector incorrect or element not yet rendered",
          correction: "Update selector or add explicit wait for element",
          file: testCase?.id || "unknown",
        },
      };
    }

    if (error.includes("assertion")) {
      return {
        type: "test-correction",
        description: "Fix test assertion logic",
        priority: "high",
        estimatedEffort: "low",
        testCorrection: {
          issue: "Assertion logic does not match actual behavior",
          correction: "Update expected values to match correct behavior",
          file: testCase?.id || "unknown",
        },
      };
    }

    return {
      type: "test-correction",
      description: "General test correction needed",
      priority: "medium",
      estimatedEffort: "medium",
      testCorrection: {
        issue: "Test needs adjustment",
        correction: "Review and update test logic",
        file: testCase?.id || "unknown",
      },
    };
  }

  private collectEvidence(result: TestResult): Evidence[] {
    const evidence: Evidence[] = [];

    if (result.errorMessage) {
      evidence.push({
        type: "error",
        description: "Error message from test failure",
        data: result.errorMessage,
        timestamp: new Date().toISOString(),
      });
    }

    if (result.stackTrace) {
      evidence.push({
        type: "error",
        description: "Stack trace from error",
        data: result.stackTrace,
        timestamp: new Date().toISOString(),
      });
    }

    if (result.screenshots && result.screenshots.length > 0) {
      evidence.push({
        type: "screenshot",
        description: `Screenshots from test failure (${result.screenshots.length} files)`,
        data: result.screenshots,
        timestamp: new Date().toISOString(),
      });
    }

    if (result.logs && result.logs.length > 0) {
      evidence.push({
        type: "log",
        description: "Application logs from test execution",
        data: result.logs.slice(-100), // Last 100 log entries
        timestamp: new Date().toISOString(),
      });
    }

    if (result.traces && result.traces.length > 0) {
      evidence.push({
        type: "trace",
        description: "Playwright trace files",
        data: result.traces,
        timestamp: new Date().toISOString(),
      });
    }

    return evidence;
  }

  private determineSeverity(
    result: TestResult,
    rootCause: RootCause,
  ): "low" | "medium" | "high" | "critical" {
    // Critical: Extension security issues or data loss
    if (
      rootCause.category === "extension-bug" &&
      (result.errorMessage?.includes("security") ||
        result.errorMessage?.includes("leak") ||
        result.errorMessage?.includes("sensitive"))
    ) {
      return "critical";
    }

    // High: Core functionality broken
    if (
      (rootCause.category === "extension-bug" && result.testName.includes("core")) ||
      result.testName.includes("critical")
    ) {
      return "high";
    }

    // Medium: Important feature broken or persistent test failures
    if (
      rootCause.category === "extension-bug" ||
      (rootCause.category === "test-issue" && result.retryCount && result.retryCount > 2)
    ) {
      return "medium";
    }

    // Low: Environment or timing issues
    return "low";
  }

  private async updatePatternDatabase(diagnosis: FailureDiagnosis): Promise<void> {
    const key = `${diagnosis.rootCause.category}-${diagnosis.rootCause.affectedComponent}`;

    const existing = this.patternDatabase.get(key);
    if (existing) {
      existing.frequency++;
      existing.lastOccurrence = new Date().toISOString();
      existing.averageResolutionTime =
        (existing.averageResolutionTime * (existing.frequency - 1) + 1) / existing.frequency;
    } else {
      this.patternDatabase.set(key, {
        patternId: key,
        failureType: diagnosis.rootCause.category,
        frequency: 1,
        lastOccurrence: new Date().toISOString(),
        averageResolutionTime: 1,
        suggestedActions: [diagnosis.suggestedFix.description],
      });
    }

    await this.savePatternDatabase();
  }

  private loadPatternDatabase(): void {
    const dbPath = path.join(this.outputDir, "runs", "pattern-database.json");
    try {
      const content = fs.readFileSync(dbPath, "utf-8");
      const data = JSON.parse(content);
      this.patternDatabase = new Map(Object.entries(data));
    } catch (err) {
      // No existing database, start fresh
    }
  }

  private async savePatternDatabase(): Promise<void> {
    const dbPath = path.join(this.outputDir, "runs", "pattern-database.json");
    await fs.promises.mkdir(path.dirname(dbPath), { recursive: true });
    const obj = Object.fromEntries(this.patternDatabase);
    await fs.promises.writeFile(dbPath, JSON.stringify(obj, null, 2));
  }

  private loadFailureHistory(): void {
    const historyPath = path.join(this.outputDir, "runs", "failure-history.json");
    try {
      const content = fs.readFileSync(historyPath, "utf-8");
      this.failureHistory = new Map(Object.entries(JSON.parse(content)));
    } catch (err) {
      // No existing history, start fresh
    }
  }

  private async saveDiagnosisResults(diagnoses: FailureDiagnosis[]): Promise<void> {
    const diagnosesPath = path.join(this.outputDir, "runs", "diagnoses.json");
    await fs.promises.mkdir(path.dirname(diagnosesPath), { recursive: true });

    const existing = await this.loadExistingDiagnoses();
    const allDiagnoses = [...existing, ...diagnoses];

    await fs.promises.writeFile(
      diagnosesPath,
      JSON.stringify({ diagnoses: allDiagnoses, updatedAt: new Date().toISOString() }, null, 2),
    );

    // Update failure history
    diagnoses.forEach((diagnosis) => {
      if (!this.failureHistory.has(diagnosis.testCaseId)) {
        this.failureHistory.set(diagnosis.testCaseId, []);
      }
      this.failureHistory.get(diagnosis.testCaseId)!.push(diagnosis);
    });

    await this.saveFailureHistory();
  }

  private async loadExistingDiagnoses(): Promise<FailureDiagnosis[]> {
    const diagnosesPath = path.join(this.outputDir, "runs", "diagnoses.json");
    try {
      const content = await fs.promises.readFile(diagnosesPath, "utf-8");
      const data = JSON.parse(content);
      return data.diagnoses || [];
    } catch (err) {
      return [];
    }
  }

  private async saveFailureHistory(): Promise<void> {
    const historyPath = path.join(this.outputDir, "runs", "failure-history.json");
    await fs.promises.mkdir(path.dirname(historyPath), { recursive: true });
    const obj = Object.fromEntries(this.failureHistory);
    await fs.promises.writeFile(historyPath, JSON.stringify(obj, null, 2));
  }

  private extractFileFromStack(stackTrace: string): string {
    const lines = stackTrace.split("\n");
    for (const line of lines) {
      const match = line.match(/at\s+.*\s+\((.*\.ts):\d+:\d+\)/) || line.match(/(.*\.ts):\d+:\d+/);
      if (match) {
        return match[1];
      }
    }
    return "unknown-file.ts";
  }

  private extractLineFromStack(stackTrace: string): number {
    const lines = stackTrace.split("\n");
    for (const line of lines) {
      const match = line.match(/:(\d+):\d+\)/) || line.match(/:(\d+):\d+$/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return 0;
  }

  public getPatternLearnings(): PatternLearning[] {
    return Array.from(this.patternDatabase.values()).sort((a, b) => b.frequency - a.frequency);
  }
}
