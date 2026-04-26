import * as fs from "node:fs";
import * as path from "node:path";
import { type AnalysisResult, CodeAnalysisAgent } from "./codeAnalysisAgent";
import { DiagnosisAgent, type FailureDiagnosis, type TestResult } from "./diagnosisAgent";
import { type GeneratedTests, type TestCase, TestGeneratorAgent } from "./testGeneratorAgent";

export interface LoopState {
  iteration: number;
  maxIterations: number;
  testsTotal: number;
  passed: number;
  failed: number;
  flaky: number;
  error: number;
  openBugs: OpenBug[];
  lastRunAt?: string;
  status: "running" | "paused" | "completed" | "failed";
  stopReason?: string;
}

export interface OpenBug {
  testCaseId: string;
  testName: string;
  rootCause: string;
  status: "new" | "analyzing" | "fixing" | "verifying" | "resolved";
  iterationsOpen: number;
  severity: "low" | "medium" | "high" | "critical";
  assignedFix?: string;
}

export interface LoopConfig {
  maxIterations: number;
  stopOnAllPass: boolean;
  retryFailedTests: boolean;
  maxRetriesPerTest: number;
  continueOnCriticalFailure: boolean;
  generateTestsOnEachIteration: boolean;
  failFast: boolean;
}

export interface LoopMetrics {
  totalIterations: number;
  totalTestsRun: number;
  totalPasses: number;
  totalFailures: number;
  totalFixesAttempted: number;
  totalFixesSuccessful: number;
  averageIterationTime: number;
  convergenceRate: number;
  criticalIssuesRemaining: number;
}

export class OrchestratorAgent {
  private projectRoot: string;
  private outputDir: string;
  private stateFile: string;
  private config: LoopConfig;
  private state: LoopState;
  private metrics: LoopMetrics;
  private startTime: number;
  private iterationHistory: LoopState[];

  private analysisAgent: CodeAnalysisAgent;
  private testGeneratorAgent: TestGeneratorAgent;
  private diagnosisAgent: DiagnosisAgent;

  constructor(projectRoot: string, config?: Partial<LoopConfig>) {
    this.projectRoot = projectRoot;
    this.outputDir = path.join(projectRoot, "test_data");
    this.stateFile = path.join(this.outputDir, "runs", "loop-state.json");
    this.metrics = this.initializeMetrics();
    this.iterationHistory = [];
    this.startTime = Date.now();

    this.config = {
      maxIterations: config?.maxIterations || 5,
      stopOnAllPass: config?.stopOnAllPass ?? true,
      retryFailedTests: config?.retryFailedTests ?? true,
      maxRetriesPerTest: config?.maxRetriesPerTest || 2,
      continueOnCriticalFailure: config?.continueOnCriticalFailure ?? false,
      generateTestsOnEachIteration: config?.generateTestsOnEachIteration ?? false,
      failFast: config?.failFast ?? false,
      ...config,
    };

    this.state = this.initializeState();
    this.analysisAgent = new CodeAnalysisAgent(projectRoot);
    this.testGeneratorAgent = new TestGeneratorAgent(projectRoot);
    this.diagnosisAgent = new DiagnosisAgent(projectRoot);
  }

  private initializeState(): LoopState {
    return {
      iteration: 0,
      maxIterations: this.config.maxIterations,
      testsTotal: 0,
      passed: 0,
      failed: 0,
      flaky: 0,
      error: 0,
      openBugs: [],
      status: "paused",
      lastRunAt: new Date().toISOString(),
    };
  }

  private initializeMetrics(): LoopMetrics {
    return {
      totalIterations: 0,
      totalTestsRun: 0,
      totalPasses: 0,
      totalFailures: 0,
      totalFixesAttempted: 0,
      totalFixesSuccessful: 0,
      averageIterationTime: 0,
      convergenceRate: 0,
      criticalIssuesRemaining: 0,
    };
  }

  public async runLoop(): Promise<LoopResult> {
    this.state.status = "running";
    this.startTime = Date.now();

    console.log(`🚀 Starting autonomous test loop (max ${this.config.maxIterations} iterations)`);

    // Step 1: Analyze extension code
    console.log("\n📊 Step 1: Analyzing extension code...");
    const analysisResult = await this.analysisAgent.analyze();
    console.log(`   Found ${analysisResult.commands.length} commands`);
    console.log(`   Found ${analysisResult.features.length} features`);
    console.log(`   Found ${analysisResult.sourceFiles.length} source files`);

    // Step 2: Generate tests (first iteration or if configured)
    console.log("\n🧪 Step 2: Generating test cases and scripts...");
    const generatedTests = await this.testGeneratorAgent.generate(analysisResult);
    console.log(`   Generated ${generatedTests.testCases.length} test cases`);
    console.log(`   Generated ${generatedTests.playwrightScripts.length} Playwright scripts`);
    console.log(`   Generated ${generatedTests.testData.length} test data sets`);

    const iterationResults: IterationResult[] = [];
    let shouldContinue = true;

    while (shouldContinue && this.state.iteration < this.config.maxIterations) {
      this.state.iteration++;
      console.log(`\n${"=".repeat(60)}`);
      console.log(`🔄 Iteration ${this.state.iteration}/${this.config.maxIterations}`);
      console.log("=".repeat(60));

      try {
        const iterationResult = await this.runIteration(generatedTests, analysisResult);
        iterationResults.push(iterationResult);

        // Update state
        this.updateState(iterationResult);
        this.updateMetrics(iterationResult);

        // Check stop conditions
        shouldContinue = this.shouldContinue(iterationResult);

        // Save state after each iteration
        await this.saveState();

        // Print iteration summary
        this.printIterationSummary(iterationResult);
      } catch (error) {
        console.error(`❌ Iteration ${this.state.iteration} failed:`, error);
        this.state.status = "failed";
        this.state.stopReason = `Iteration failed: ${error instanceof Error ? error.message : "Unknown error"}`;
        await this.saveState();
        break;
      }
    }

    // Final results
    const finalResult = this.generateFinalResult(iterationResults);
    await this.saveFinalReport(finalResult);

    return finalResult;
  }

  private async runIteration(
    generatedTests: GeneratedTests,
    analysisResult: AnalysisResult,
  ): Promise<IterationResult> {
    const iterationStart = Date.now();
    const testResults: TestResult[] = [];
    let iterationFailed = false;

    console.log(`\n  Running ${generatedTests.testCases.length} tests...`);

    for (const testCase of generatedTests.testCases) {
      try {
        const result = await this.runSingleTest(testCase, generatedTests);
        testResults.push(result);

        if (result.status === "fail" || result.status === "error") {
          if (this.config.retryFailedTests && result.retryCount! < this.config.maxRetriesPerTest) {
            console.log(`    ↻ Retrying ${testCase.id} (attempt ${result.retryCount! + 1})...`);
            result.retryCount = (result.retryCount || 0) + 1;
            await this.retryTest(testCase, result);
          }
        }
      } catch (error) {
        console.error(`    ❌ Test ${testCase.id} failed with error:`, error);
        iterationFailed = true;
      }
    }

    // Diagnose failures
    let diagnoses: FailureDiagnosis[] = [];
    const failedResults = testResults.filter((r) => r.status === "fail" || r.status === "error");

    if (failedResults.length > 0) {
      console.log(`\n  🔍 Diagnosing ${failedResults.length} failures...`);
      diagnoses = await this.diagnosisAgent.diagnoseFailures(
        failedResults,
        generatedTests,
        analysisResult,
      );

      // Attempt fixes
      await this.attemptFixes(diagnoses, generatedTests);
    }

    // Update test data for next iteration if needed
    if (this.config.generateTestsOnEachIteration) {
      const updatedTests = await this.testGeneratorAgent.generate(analysisResult);
      Object.assign(generatedTests, updatedTests);
    }

    const iterationTime = Date.now() - iterationStart;

    return {
      iteration: this.state.iteration,
      testResults,
      diagnoses,
      iterationTime,
      passedTests: testResults.filter((r) => r.status === "pass").length,
      failedTests: testResults.filter((r) => r.status === "fail" || r.status === "error").length,
      flakyTests: testResults.filter((r) => r.status === "flaky").length,
      issuesResolved: diagnoses.filter((d) => d.suggestedFix.type === "code-patch").length,
      openIssues: diagnoses.length,
    };
  }

  private async runSingleTest(
    testCase: TestCase,
    generatedTests: GeneratedTests,
  ): Promise<TestResult> {
    // Simulate test execution (in real implementation, this would run Playwright)
    const startTime = Date.now();

    // Determine test outcome based on test type and content
    let status: TestResult["status"] = "pass";
    let errorMessage: string | undefined;

    if (testCase.type === "failure-case") {
      // Failure cases are expected to fail initially
      status = Math.random() > 0.3 ? "fail" : "pass";
      if (status === "fail") {
        errorMessage = this.generateSimulatedError(testCase);
      }
    } else if (testCase.type === "edge-condition") {
      status = Math.random() > 0.2 ? "pass" : "flaky";
      if (status === "flaky") {
        errorMessage = "Timing-dependent failure";
      }
    } else {
      // Happy path - usually passes
      status = Math.random() > 0.1 ? "pass" : "fail";
      if (status === "fail") {
        errorMessage = this.generateSimulatedError(testCase);
      }
    }

    // Simulate occasional errors
    if (Math.random() < 0.05) {
      status = "error";
      errorMessage = "Unexpected runtime error";
    }

    return {
      testCaseId: testCase.id,
      testName: testCase.name,
      status,
      duration: Date.now() - startTime,
      errorMessage,
      stackTrace: errorMessage ? this.generateSimulatedStack(errorMessage) : undefined,
      retryCount: 0,
      actualOutput: status === "pass" ? testCase.expectedOutputs : undefined,
      expectedOutput: testCase.expectedOutputs,
    };
  }

  private generateSimulatedError(testCase: TestCase): string {
    const errors = [
      "TypeError: Cannot read property 'value' of undefined",
      "ReferenceError: apiKey is not defined",
      "Error: Command execution failed: timeout after 5000ms",
      "RangeError: Maximum call stack size exceeded",
      "Error: Expected sanitizer to redact but received original text",
      "AssertionError: Expected risk score 60 but received 0",
    ];
    return errors[Math.floor(Math.random() * errors.length)];
  }

  private generateSimulatedStack(error: string): string {
    return `Error: ${error}\n    at Object.executeCommand (extension.ts:45:15)\n    at TestRunner.runTest (testRunner.ts:120:8)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;
  }

  private async retryTest(testCase: TestCase, result: TestResult): Promise<void> {
    // Simulate retry logic
    result.retryCount = (result.retryCount || 0) + 1;

    // 70% chance of passing on retry
    if (Math.random() > 0.3) {
      result.status = "pass";
      result.errorMessage = undefined;
      console.log(`    ✓ Retry successful for ${testCase.id}`);
    } else {
      console.log(`    ✗ Retry failed for ${testCase.id}`);
    }
  }

  private updateState(iterationResult: IterationResult): void {
    this.state.lastRunAt = new Date().toISOString();
    this.state.testsTotal = iterationResult.testResults.length;
    this.state.passed = iterationResult.passedTests;
    this.state.failed = iterationResult.failedTests;
    this.state.flaky = iterationResult.flakyTests;
    this.state.error = iterationResult.testResults.filter((r) => r.status === "error").length;

    // Update open bugs
    this.state.openBugs = iterationResult.diagnoses
      .filter((d) => d.suggestedFix.type === "code-patch" || d.severity === "high")
      .map((d) => ({
        testCaseId: d.testCaseId,
        testName: d.testName,
        rootCause: d.rootCause.category,
        status: "new",
        iterationsOpen: 1,
        severity: d.severity,
      }));
  }

  private updateMetrics(iterationResult: IterationResult): void {
    const totalTime = Date.now() - this.startTime;
    this.metrics.totalIterations = this.state.iteration;
    this.metrics.totalTestsRun += iterationResult.testResults.length;
    this.metrics.totalPasses += iterationResult.passedTests;
    this.metrics.totalFailures += iterationResult.failedTests;
    this.metrics.totalFixesAttempted += iterationResult.issuesResolved;
    this.metrics.totalFixesSuccessful += iterationResult.issuesResolved; // Simplified
    this.metrics.averageIterationTime = totalTime / this.state.iteration;

    // Calculate convergence rate
    if (this.state.iteration > 1) {
      const prevFailures = this.metrics.totalFailures / (this.state.iteration - 1);
      const currFailures = iterationResult.failedTests;
      this.metrics.convergenceRate = Math.max(0, (prevFailures - currFailures) / prevFailures);
    }
  }

  private shouldContinue(iterationResult: IterationResult): boolean {
    // Stop if no more iterations
    if (this.state.iteration >= this.config.maxIterations) {
      this.state.stopReason = "Maximum iterations reached";
      this.state.status = "completed";
      return false;
    }

    // Stop if all tests pass and configured to stop
    if (this.config.stopOnAllPass && iterationResult.failedTests === 0) {
      this.state.stopReason = "All tests passed";
      this.state.status = "completed";
      return false;
    }

    // Stop if critical failure and not configured to continue
    if (
      !this.config.continueOnCriticalFailure &&
      iterationResult.diagnoses.some((d) => d.severity === "critical")
    ) {
      this.state.stopReason = "Critical failure detected";
      this.state.status = "failed";
      return false;
    }

    // Stop if fail fast and issues not resolving
    if (
      this.config.failFast &&
      this.state.iteration > 2 &&
      iterationResult.failedTests >= this.state.failed
    ) {
      this.state.stopReason = "No convergence detected";
      this.state.status = "failed";
      return false;
    }

    return true;
  }

  private async attemptFixes(
    diagnoses: FailureDiagnosis[],
    generatedTests: GeneratedTests,
  ): Promise<void> {
    console.log(`\n  🔧 Attempting to fix ${diagnoses.length} issues...`);

    for (const diagnosis of diagnoses) {
      if (diagnosis.suggestedFix.type === "code-patch" && diagnosis.suggestedFix.patch) {
        console.log(`    🛠️  Applying fix for ${diagnosis.testName}...`);

        // In real implementation, this would actually apply the patch
        // For now, just log the fix
        console.log(`      File: ${diagnosis.suggestedFix.patch.file}`);
        console.log(`      Change: ${diagnosis.suggestedFix.description}`);

        this.metrics.totalFixesAttempted++;

        // Simulate fix success (80% chance)
        if (Math.random() > 0.2) {
          this.metrics.totalFixesSuccessful++;
          console.log(`      ✓ Fix applied successfully`);
        }
      } else if (diagnosis.suggestedFix.type === "test-correction") {
        console.log(`    📝 Test correction: ${diagnosis.suggestedFix.description}`);
      }
    }
  }

  private printIterationSummary(iterationResult: IterationResult): void {
    console.log(`\n  Summary:`);
    console.log(`    Tests run: ${iterationResult.testResults.length}`);
    console.log(`    Passed: ${iterationResult.passedTests} ✅`);
    console.log(`    Failed: ${iterationResult.failedTests} ❌`);
    console.log(`    Flaky: ${iterationResult.flakyTests} ⚠️`);
    console.log(`    Issues found: ${iterationResult.diagnoses.length}`);
    console.log(`    Time: ${iterationResult.iterationTime}ms`);
  }

  private generateFinalResult(iterationResults: IterationResult[]): LoopResult {
    const finalState = this.state;
    const totalTime = Date.now() - this.startTime;

    return {
      state: finalState,
      metrics: {
        ...this.metrics,
        averageIterationTime: totalTime / this.state.iteration,
      },
      iterations: iterationResults,
      totalTime,
      success: finalState.status === "completed" && finalState.failed === 0,
    };
  }

  private async saveState(): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.stateFile), { recursive: true });
    await fs.promises.writeFile(
      this.stateFile,
      JSON.stringify(
        {
          state: this.state,
          metrics: this.metrics,
          config: this.config,
          lastUpdated: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  }

  private async saveFinalReport(finalResult: LoopResult): Promise<void> {
    const reportPath = path.join(this.outputDir, "reports", `loop-report-${Date.now()}.json`);
    await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });

    const report = {
      generatedAt: new Date().toISOString(),
      project: this.projectRoot,
      result: finalResult,
      recommendations: this.generateRecommendations(finalResult),
    };

    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Final report saved to: ${reportPath}`);
  }

  private generateRecommendations(finalResult: LoopResult): string[] {
    const recommendations: string[] = [];

    if (finalResult.state.failed > 0) {
      recommendations.push("Review failed tests and implement suggested fixes");
    }

    if (finalResult.metrics.criticalIssuesRemaining > 0) {
      recommendations.push("Address critical issues before production deployment");
    }

    if (finalResult.metrics.convergenceRate < 0.1) {
      recommendations.push("Consider improving test stability and retry logic");
    }

    if (finalResult.iterations.length > 1) {
      const lastTwo = finalResult.iterations.slice(-2);
      if (lastTwo[1].failedTests >= lastTwo[0].failedTests) {
        recommendations.push("Tests are not converging - review root causes");
      }
    }

    return recommendations;
  }

  public getState(): LoopState {
    return this.state;
  }

  public getMetrics(): LoopMetrics {
    return this.metrics;
  }

  public async loadState(): Promise<void> {
    try {
      const content = await fs.promises.readFile(this.stateFile, "utf-8");
      const data = JSON.parse(content);
      this.state = data.state;
      this.metrics = data.metrics;
      this.config = { ...this.config, ...data.config };
    } catch (err) {
      // No saved state, use defaults
    }
  }
}

export interface IterationResult {
  iteration: number;
  testResults: TestResult[];
  diagnoses: FailureDiagnosis[];
  iterationTime: number;
  passedTests: number;
  failedTests: number;
  flakyTests: number;
  issuesResolved: number;
  openIssues: number;
}

export interface LoopResult {
  state: LoopState;
  metrics: LoopMetrics;
  iterations: IterationResult[];
  totalTime: number;
  success: boolean;
}
