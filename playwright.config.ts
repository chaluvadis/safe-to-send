import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// Set VS Code executable path based on platform
function getCodePath(): string {
  const platform = process.platform;
  switch (platform) {
    case "darwin":
      return "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code";
    case "linux":
      // Try common locations
      if (existsSync("/usr/bin/code")) return "/usr/bin/code";
      if (existsSync("/snap/bin/code")) return "/snap/bin/code";
      return "code";
    case "win32":
      return "C:\\Program Files\\Microsoft VS Code\\Code.exe";
    default:
      return "code";
  }
}

// Check if file exists
function existsSync(p: string): boolean {
  try {
    require("node:fs").statSync(p);
    return true;
  } catch {
    return false;
  }
}

const extensionPath = path.resolve(__dirname, "..", "dist");
const runnerPath = path.resolve(__dirname, "..", "dist-test", "ux", "runner.js");

export default defineConfig({
  testDir: "./test/ux",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    executablePath: getCodePath(),
    args: [
      "--new-window",
      "--disable-extensions",
      `--extensionTestsPath=${runnerPath}`,
      `--extensionDevelopmentPath=${extensionPath}`,
    ],
    userDataDir: path.resolve(__dirname, "..", "test", "workspace"),
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  globalSetup: require.resolve("./test/ux/global-setup"),
  globalTeardown: require.resolve("./test/ux/global-teardown"),
});
