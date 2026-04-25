import * as fs from "node:fs";
import * as path from "node:path";
import type { PatternDefinition } from "./patternRegistry";

/** Expected shape of a .safe-send.json file. */
type RepoConfigFile = {
  patterns?: unknown[];
};

/**
 * Reads and parses a .safe-send.json file from the given workspace folder.
 * Returns an empty array if the file does not exist or is invalid.
 */
export function loadRepoConfig(
  workspaceFolderPath: string,
  filename = ".safe-send.json",
): PatternDefinition[] {
  const configPath = path.join(workspaceFolderPath, filename);
  try {
    const content = fs.readFileSync(configPath, "utf8");
    return parseRepoConfig(content);
  } catch {
    return [];
  }
}

/**
 * Parses the contents of a .safe-send.json file.
 * Returns only well-formed pattern definitions; silently drops malformed entries.
 */
export function parseRepoConfig(json: string): PatternDefinition[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  const config = parsed as RepoConfigFile;
  if (!Array.isArray(config?.patterns)) {
    return [];
  }

  return config.patterns.filter(isValidPatternDefinition);
}

function isValidPatternDefinition(value: unknown): value is PatternDefinition {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.label === "string" &&
    v.label.length > 0 &&
    typeof v.regex === "string" &&
    v.regex.length > 0
  );
}
