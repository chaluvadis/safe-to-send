#!/usr/bin/env node

/**
 * Safe Send Pre-Commit Hook
 *
 * Scans staged files for sensitive data before allowing a commit.
 * Called by the .git/hooks/pre-commit script installed by the extension.
 */

import { execSync } from "child_process";
import { readFileSync, existsSync, statSync } from "fs";
import { join } from "path";

// Node globals available when compiled to CommonJS
declare const __filename: string;
declare const __dirname: string;

import { buildPatternList } from "./patternRegistry";
import { loadRepoConfig } from "./repoConfig";
import { assessRisk } from "./riskEngine";

const MAX_FILE_SIZE = 200 * 1024; // 200KB
const REPO_ROOT = process.cwd();

try {
  // Get list of staged files (added/modified)
  const stagedOutput = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stagedFiles = stagedOutput.split("\n").filter((f) => f.trim().length > 0);

  if (stagedFiles.length === 0) {
    // Nothing to scan
    process.exit(0);
  }

  // Load custom patterns from repo config
  const customPatternDefs = loadRepoConfig(REPO_ROOT);
  const allPatterns = buildPatternList(customPatternDefs);

  let foundSecrets = false;

  for (const file of stagedFiles) {
    const absPath = join(REPO_ROOT, file);

    // Skip if file doesn't exist (deleted) or is not a file
    if (!existsSync(absPath)) continue;
    try {
      const fileStat = statSync(absPath);
      if (!fileStat.isFile()) continue;
      if (fileStat.size > MAX_FILE_SIZE) continue; // Skip large files
    } catch {
      continue;
    }

    let content: string;
    try {
      content = readFileSync(absPath, "utf8");
    } catch {
      // Skip unreadable files
      continue;
    }

    const result = assessRisk(content, file, allPatterns);

    if (result.findings.length > 0) {
      foundSecrets = true;
      console.error(
        `[Safe Send] ${file}: ${result.level} risk (score ${result.score}) — ${result.findings.join(", ")}`,
      );
    }
  }

  if (foundSecrets) {
    console.error(
      "\n❌ Commit blocked: sensitive data detected. Please sanitize or use `--no-verify` to bypass.",
    );
    process.exit(1);
  } else {
    process.exit(0);
  }
} catch (error) {
  console.error("Safe Send pre-commit hook error:", error);
  // Fail safe: abort commit
  process.exit(1);
}
