#!/usr/bin/env tsx
/**
 * CLI entrypoint for the BIM Agent Team.
 *
 * Usage:
 *   tsx scripts/run-project.ts "Letzigraben 89, 8047 Zürich" brief.json
 *   tsx scripts/run-project.ts  # defaults to Musterstrasse 12, 8006 Zürich
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
process.chdir(PROJECT_ROOT);

// Ensure workspace exists
if (!existsSync("workspace")) {
  mkdirSync("workspace", { recursive: true });
}

// Verify ifc-lite is installed
try {
  execSync("ifc-lite --version", { stdio: "pipe" });
} catch {
  console.error(
    "ERROR: ifc-lite CLI not found. Install with: npm install -g @ifc-lite/cli",
  );
  process.exit(1);
}

// Check services are running (warn but don't block)
function checkService(name: string, url: string): boolean {
  try {
    execSync(`curl -sf ${url} > /dev/null 2>&1`, { timeout: 5000 });
    console.log(`✓ ${name} is running`);
    return true;
  } catch {
    console.warn(`⚠ ${name} is NOT running at ${url}`);
    return false;
  }
}

console.log("\nChecking prerequisites...\n");
const ifcSiteUp = checkService("ifc-site", "http://localhost:8000/health");
const zoningUp = checkService(
  "swiss-zoning-api",
  "http://localhost:3000/api/zoning?address=test",
);

if (!ifcSiteUp || !zoningUp) {
  console.warn(
    "\n⚠ One or more services are not running. Start them with: npm run start:services\n",
  );
  console.warn("Proceeding anyway — agents will retry or fail gracefully.\n");
}

// Forward to orchestrator
const address = process.argv[2] ?? "Musterstrasse 12, 8006 Zürich";
const briefPath = process.argv[3] ?? "brief.json";

console.log(`\nStarting orchestrator for: ${address}\n`);

// Dynamic import to run orchestrator in same process
const orchestratorPath = path.join(PROJECT_ROOT, "orchestrator.ts");
process.argv = [process.argv[0], orchestratorPath, address, briefPath];
await import(orchestratorPath);
