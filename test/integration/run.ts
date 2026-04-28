import * as path from "node:path";
import * as fs from "node:fs";
import { exec } from "node:child_process";

const extensionDevelopmentPath = path.resolve(__dirname, "..", "..", "..");
const extensionTestsPath = path.resolve(__dirname, "suite", "index.js");
const testWorkspace = path.resolve(__dirname, "..", "..", "test", "workspace");

async function main() {
  try {
    // Ensure test workspace directory exists
    if (!fs.existsSync(testWorkspace)) {
      fs.mkdirSync(testWorkspace, { recursive: true });
    }

    console.log("Launching VS Code for integration tests...");
    console.log("Extension path:", extensionDevelopmentPath);
    console.log("Tests path:", extensionTestsPath);
    console.log("Workspace path:", testWorkspace);

    // Note: This file is invoked by @vscode/test-electron
    // The actual test runner setup is handled by the test runner
  } catch (err) {
    console.error("Integration tests setup failed:", err);
    process.exit(1);
  }
}

main();
