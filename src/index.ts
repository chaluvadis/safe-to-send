import { CodeAnalysisAgent } from "./codeAnalysisAgent";
import { type LoopConfig, OrchestratorAgent } from "./orchestratorAgent";
import { TestGeneratorAgent } from "./testGeneratorAgent";

async function main() {
  const projectRoot = process.cwd();

  console.log("🚀 Safe Send - Autonomous QA System");
  console.log("=".repeat(60));

  // Initialize orchestrator with configuration
  const config: LoopConfig = {
    maxIterations: 5,
    stopOnAllPass: true,
    retryFailedTests: true,
    maxRetriesPerTest: 2,
    continueOnCriticalFailure: false,
    generateTestsOnEachIteration: false,
    failFast: false,
  };

  const orchestrator = new OrchestratorAgent(projectRoot, config);

  // Run the autonomous loop
  try {
    const result = await orchestrator.runLoop();

    console.log("\n" + "=".repeat(60));
    console.log("🏁 Loop Complete");
    console.log("=".repeat(60));
    console.log(`Total iterations: ${result.state.iteration}`);
    console.log(`Total tests run: ${result.metrics.totalTestsRun}`);
    console.log(`Total passes: ${result.metrics.totalPasses}`);
    console.log(`Total failures: ${result.metrics.totalFailures}`);
    console.log(`Total fixes attempted: ${result.metrics.totalFixesAttempted}`);
    console.log(`Total fixes successful: ${result.metrics.totalFixesSuccessful}`);
    console.log(`Total time: ${result.totalTime}ms`);
    console.log(`Success: ${result.success ? "✅" : "❌"}`);

    if (result.state.openBugs.length > 0) {
      console.log(`\n🔍 Open bugs: ${result.state.openBugs.length}`);
      result.state.openBugs.forEach((bug) => {
        console.log(`  - ${bug.testName}: ${bug.rootCause} (${bug.severity})`);
      });
    }

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error("❌ Loop failed:", error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

// Export for programmatic use
export { CodeAnalysisAgent, OrchestratorAgent, TestGeneratorAgent };
