import assert = require("node:assert/strict");
import test = require("node:test");

import { OrchestratorAgent } from "../src/orchestratorAgent";

test("OrchestratorAgent initializes with default config", () => {
  const orchestrator = new OrchestratorAgent(process.cwd());
  const state = orchestrator.getState();
  assert.equal(state.status, "paused");
  assert.equal(state.iteration, 0);
});

test("OrchestratorAgent initializes with custom config", () => {
  const orchestrator = new OrchestratorAgent(process.cwd(), {
    maxIterations: 3,
    stopOnAllPass: false,
  });
  const state = orchestrator.getState();
  assert.equal(state.maxIterations, 3);
});

test("OrchestratorAgent gets state and metrics", () => {
  const orchestrator = new OrchestratorAgent(process.cwd());
  const state = orchestrator.getState();
  const metrics = orchestrator.getMetrics();

  assert.ok(state);
  assert.ok(metrics);
  assert.equal(state.iteration, 0);
  assert.equal(metrics.totalIterations, 0);
});

test("LoopState has correct initial values", () => {
  const orchestrator = new OrchestratorAgent(process.cwd());
  const state = orchestrator.getState();

  assert.equal(state.testsTotal, 0);
  assert.equal(state.passed, 0);
  assert.equal(state.failed, 0);
  assert.equal(state.flaky, 0);
  assert.equal(state.error, 0);
  assert.equal(state.openBugs.length, 0);
});
