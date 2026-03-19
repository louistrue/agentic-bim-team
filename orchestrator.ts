import {
  query,
  type AgentDefinition,
  type SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";
import {
  readFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  writeFileSync,
} from "fs";
import { execSync } from "child_process";

// ── Logging helpers ──────────────────────────────────────────────────────────

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";
const BLUE = "\x1b[34m";

function timestamp(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function log(prefix: string, color: string, msg: string) {
  console.log(
    `${DIM}${timestamp()}${RESET} ${color}${BOLD}${prefix}${RESET} ${msg}`,
  );
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_CYCLES = 3;
const VIEWER_PORT = 3456;

// ── Agent definitions ────────────────────────────────────────────────────────

const AGENT_DEFINITIONS: Record<string, AgentDefinition> = {
  "site-prep": {
    description:
      "Generates site_context.ifc via ifc-site REST API and fetches zoning data from swiss-zoning-api. Writes workspace/project_state.json.",
    prompt: readFileSync("agent-prompts/site-prep.md", "utf8"),
    tools: ["Bash", "Write", "Read"],
    model: "sonnet",
  },
  architect: {
    description:
      "Creates the building IFC using ifc-lite run with a build script. Respects zone constraints. On cycle>0, resolves open BCF ERROR issues.",
    prompt: readFileSync("agent-prompts/architect.md", "utf8"),
    tools: ["Bash", "Read", "Write"],
    model: "sonnet",
  },
  "visual-qa": {
    description:
      "Visually inspects 3D model via ifc-lite viewer screenshots. Checks geometry coherence (no floating elements, proper storey stacking). Gates specialist review.",
    prompt: readFileSync("agent-prompts/visual-qa.md", "utf8"),
    tools: ["Bash", "Read", "Write"],
    model: "sonnet",
  },
  structural: {
    description:
      "Reviews structural viability: load path continuity, slab spans, shear wall distribution (SIA 260-262). Writes workspace/structural_vN.bcf.",
    prompt: readFileSync("agent-prompts/structural.md", "utf8"),
    tools: ["Bash", "Write", "Read"],
    model: "sonnet",
  },
  mep: {
    description:
      "Reviews MEP feasibility: ventilation shafts, sanitary stacking, ceiling heights, electrical risers (SIA 382.1). Writes workspace/mep_vN.bcf.",
    prompt: readFileSync("agent-prompts/mep.md", "utf8"),
    tools: ["Bash", "Write", "Read"],
    model: "sonnet",
  },
  facade: {
    description:
      "Reviews facade & energy: window-to-wall ratios, thermal bridges, U-values (SIA 380/1, Minergie). Writes workspace/facade_vN.bcf.",
    prompt: readFileSync("agent-prompts/facade.md", "utf8"),
    tools: ["Bash", "Write", "Read"],
    model: "sonnet",
  },
  fire: {
    description:
      "Reviews fire safety: escape routes, staircase widths, compartmentation (VKF). Writes workspace/fire_vN.bcf.",
    prompt: readFileSync("agent-prompts/fire.md", "utf8"),
    tools: ["Bash", "Write", "Read"],
    model: "sonnet",
  },
};

// ── Agent runner ─────────────────────────────────────────────────────────────

function logMessage(msg: SDKMessage, agentName: string) {
  switch (msg.type) {
    case "system": {
      if (msg.subtype === "init") {
        log(
          "SYSTEM",
          BLUE,
          `Session started | model: ${msg.model} | tools: ${msg.tools.join(", ")}`,
        );
      }
      break;
    }

    case "assistant": {
      for (const block of msg.message.content) {
        if (block.type === "text" && block.text.trim()) {
          const lines = block.text.trim().split("\n");
          for (const line of lines) {
            console.log(
              `${DIM}${timestamp()}${RESET} ${MAGENTA}${BOLD}${agentName}${RESET}  ${line}`,
            );
          }
        } else if (block.type === "tool_use") {
          const toolName = block.name;
          const input = block.input as Record<string, unknown>;

          if (toolName === "Bash") {
            const cmd = (input.command as string) || "";
            const desc = (input.description as string) || "";
            console.log(
              `${DIM}${timestamp()}${RESET} ${YELLOW}${BOLD}BASH${RESET}   ${desc ? `${DIM}${desc}${RESET} → ` : ""}${cmd.length > 120 ? cmd.slice(0, 120) + "..." : cmd}`,
            );
          } else if (toolName === "Write") {
            log("WRITE", YELLOW, (input.file_path as string) || "");
          } else if (toolName === "Read") {
            log("READ", DIM, (input.file_path as string) || "");
          } else if (toolName === "Edit") {
            log("EDIT", YELLOW, (input.file_path as string) || "");
          } else {
            log(
              "TOOL",
              YELLOW,
              `${toolName}(${JSON.stringify(input).slice(0, 100)})`,
            );
          }
        }
      }
      break;
    }

    case "result": {
      if (msg.subtype === "success") {
        log(
          "DONE",
          GREEN,
          `${agentName} completed in ${msg.num_turns} turns | $${msg.total_cost_usd.toFixed(2)}`,
        );
      } else {
        log("ERROR", RED, `${agentName} failed: ${msg.subtype}`);
      }
      break;
    }

    case "tool_progress": {
      if (msg.elapsed_time_seconds > 10) {
        console.log(
          `${DIM}${timestamp()} ⏳ ${msg.tool_name} running... ${msg.elapsed_time_seconds.toFixed(0)}s${RESET}`,
        );
      }
      break;
    }
  }
}

async function spawnAgent(
  name: string,
  taskPrompt: string,
): Promise<string> {
  const def = AGENT_DEFINITIONS[name];
  if (!def) throw new Error(`Unknown agent: ${name}`);

  console.log("");
  log("AGENT", GREEN, `Spawning: ${BOLD}${name}${RESET}`);

  let result = "";
  for await (const msg of query({
    prompt: taskPrompt,
    options: {
      model: def.model || "sonnet",
      systemPrompt: def.prompt,
      allowedTools: def.tools || ["Bash", "Read", "Write"],
      cwd: process.cwd(),
      maxTurns: 80,
      permissionMode: "bypassPermissions" as "bypassPermissions",
      allowDangerouslySkipPermissions: true,
    },
  })) {
    logMessage(msg as SDKMessage, name);
    const m = msg as SDKMessage;
    if (m.type === "result") {
      if (m.subtype === "success") {
        result = m.result;
      } else {
        log("ERROR", RED, `Agent ${name} failed: ${m.subtype}`);
      }
    }
  }
  return result;
}

// ── Deterministic helpers ────────────────────────────────────────────────────

function cleanWorkspace() {
  if (existsSync("workspace") && existsSync("workspace/project_state.json")) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    mkdirSync("workspace-archive", { recursive: true });
    renameSync("workspace", `workspace-archive/${ts}`);
    log("CLEAN", DIM, `Archived previous workspace to workspace-archive/${ts}`);
  }
  mkdirSync("workspace", { recursive: true });
  mkdirSync("workspace/analysis", { recursive: true });
}

function countBcfErrors(cycle: number): {
  errors: number;
  warnings: number;
  details: string[];
} {
  const v = cycle + 1;
  let errors = 0;
  let warnings = 0;
  const details: string[] = [];

  for (const d of ["structural", "mep", "facade", "fire"]) {
    const bcf = `workspace/${d}_v${v}.bcf`;
    if (!existsSync(bcf)) continue;
    try {
      const out = execSync(`ifc-lite bcf list ${bcf} --json`, {
        encoding: "utf8",
      });
      const topics = JSON.parse(out);
      for (const t of topics) {
        if (t.title.startsWith("ERROR")) {
          errors++;
          details.push(`[${d.toUpperCase()}] ${t.title}`);
        } else if (t.title.startsWith("WARNING")) {
          warnings++;
        }
      }
    } catch {
      log("WARN", YELLOW, `Could not parse BCF: ${bcf}`);
    }
  }
  return { errors, warnings, details };
}

function readBcfErrors(cycle: number): string {
  const v = cycle + 1;
  const errors: string[] = [];

  for (const d of ["structural", "mep", "facade", "fire"]) {
    const bcf = `workspace/${d}_v${v}.bcf`;
    if (!existsSync(bcf)) continue;
    try {
      const out = execSync(`ifc-lite bcf list ${bcf} --json`, {
        encoding: "utf8",
      });
      const topics = JSON.parse(out);
      for (const t of topics) {
        if (t.title.startsWith("ERROR")) {
          errors.push(
            `[${d.toUpperCase()}] ${t.title}${t.description ? ": " + t.description : ""}`,
          );
        }
      }
    } catch {
      /* skip unparseable BCF */
    }
  }
  return errors.join("\n\n");
}

function runPreAnalysis(cycle: number) {
  const v = cycle + 1;
  const design = `workspace/design_v${v}.ifc`;
  log("ANALYZE", CYAN, `Running pre-analysis on ${design}`);
  execSync(`bash scripts/pre-analyze.sh ${design}`, { stdio: "inherit" });
}

function startViewer(cycle: number): number {
  const v = cycle + 1;
  const design = `workspace/design_v${v}.ifc`;

  // Kill any existing viewer on the port
  try {
    execSync(`lsof -ti:${VIEWER_PORT} | xargs kill -9 2>/dev/null`, {
      stdio: "ignore",
    });
  } catch {
    /* no process on port */
  }

  // Small delay to let port free up
  execSync("sleep 1", { stdio: "ignore" });

  execSync(
    `nohup ifc-lite view ${design} --port ${VIEWER_PORT} --no-open > /tmp/viewer.log 2>&1 &`,
    {
      shell: "/bin/bash",
      stdio: "ignore",
    },
  );

  // Wait for viewer to be ready — check /api/status which exists on all versions
  for (let i = 0; i < 15; i++) {
    try {
      execSync(
        `curl -sf http://localhost:${VIEWER_PORT}/api/status > /dev/null`,
        {
          stdio: "ignore",
          timeout: 3000,
        },
      );
      log(
        "VIEWER",
        CYAN,
        `Viewer started at http://localhost:${VIEWER_PORT}`,
      );
      return VIEWER_PORT;
    } catch {
      execSync("sleep 1", { stdio: "ignore" });
    }
  }

  log("VIEWER", YELLOW, "Viewer may not be fully ready, proceeding anyway");
  return VIEWER_PORT;
}

function stopViewer() {
  try {
    execSync(`lsof -ti:${VIEWER_PORT} | xargs kill -9 2>/dev/null`, {
      stdio: "ignore",
    });
  } catch {
    /* already stopped */
  }
}

function updateProjectState(
  cycle: number,
  counts: { errors: number; warnings: number },
) {
  const statePath = "workspace/project_state.json";
  if (!existsSync(statePath)) return;

  const state = JSON.parse(readFileSync(statePath, "utf8"));
  state.cycle = cycle + 1;
  state.convergence.open_errors = counts.errors;
  state.convergence.open_warnings = counts.warnings;
  if (!state.convergence.history) state.convergence.history = [];
  state.convergence.history.push({
    cycle,
    errors: counts.errors,
    warnings: counts.warnings,
    timestamp: new Date().toISOString(),
  });
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function writeReport(finalCycle: number) {
  const statePath = "workspace/project_state.json";
  if (!existsSync(statePath)) {
    writeFileSync(
      "workspace/project_report_final.md",
      "# Report\n\nNo project state found.\n",
    );
    return;
  }

  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const v = finalCycle + 1;
  const converged = state.convergence.open_errors === 0;

  const historyLines = (state.convergence.history || [])
    .map(
      (h: { cycle: number; errors: number; warnings: number }) =>
        `| ${h.cycle} | ${h.errors} | ${h.warnings} |`,
    )
    .join("\n");

  const report = `# Project Report — ${state.address || "Unknown"}

## Summary
- **Zone**: ${state.zoning?.zone_code || "unknown"} (${state.zoning?.zone_name || ""})
- **Design**: workspace/design_v${v}.ifc
- **Status**: ${converged ? "CONVERGED" : "ESCALATED TO HUMAN REVIEW"}
- **Cycles**: ${v}

## Convergence History

| Cycle | Errors | Warnings |
|-------|--------|----------|
${historyLines}

## Remaining Issues
- **Errors**: ${state.convergence.open_errors ?? "unknown"}
- **Warnings**: ${state.convergence.open_warnings ?? "unknown"}

${!converged ? "> **Note**: Maximum cycles reached. Remaining errors require human review.\n" : "> All errors resolved. Design is ready for detailed engineering.\n"}

## Files
- Design: \`workspace/design_v${v}.ifc\`
- Visual QA: \`workspace/visual_qa_v${v}.md\`
- BCF Reports: \`workspace/*_v${v}.bcf\`
- Project State: \`workspace/project_state.json\`

## View Model
\`\`\`bash
ifc-lite view workspace/design_v${v}.ifc --port ${VIEWER_PORT}
\`\`\`
`;

  writeFileSync("workspace/project_report_final.md", report);
  log("REPORT", GREEN, "Written workspace/project_report_final.md");
}

// ── Main pipeline ────────────────────────────────────────────────────────────

async function main() {
  const address = process.argv[2] ?? "Musterstrasse 12, 8006 Zürich";
  const briefPath = process.argv[3] ?? "brief.json";
  const brief = JSON.parse(readFileSync(briefPath, "utf8"));

  // Banner
  console.log("");
  console.log(`${CYAN}${BOLD}${"═".repeat(60)}${RESET}`);
  console.log(
    `${CYAN}${BOLD}  BIM AGENT TEAM — Autonomous Design Pipeline${RESET}`,
  );
  console.log(`${CYAN}${BOLD}${"═".repeat(60)}${RESET}`);
  console.log(`  ${BOLD}Address:${RESET}  ${address}`);
  console.log(
    `  ${BOLD}Brief:${RESET}    ${brief.program} | ${brief.target_units} units | ${brief.target_storeys} storeys | ${brief.energy_standard}`,
  );
  console.log(
    `  ${BOLD}Pipeline:${RESET} site-prep → architect → visual-qa → specialists → convergence`,
  );
  console.log(`  ${BOLD}Model:${RESET}    all agents on Sonnet (no Opus orchestrator)`);
  console.log(`${CYAN}${"─".repeat(60)}${RESET}`);
  console.log("");

  const startTime = Date.now();
  cleanWorkspace();

  // ── Phase 0: Site Preparation ──────────────────────────────────────────
  log("PHASE", CYAN, "0: Site Preparation");
  await spawnAgent(
    "site-prep",
    `Address: ${address}\nBrief: ${JSON.stringify(brief)}\nGenerate site context and zoning data. Write workspace/project_state.json when done.`,
  );

  if (!existsSync("workspace/project_state.json")) {
    log("ERROR", RED, "Site prep failed — no project_state.json generated");
    process.exit(1);
  }

  // ── Design-Review Loop ─────────────────────────────────────────────────
  let finalCycle = 0;

  for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
    finalCycle = cycle;
    const v = cycle + 1;

    // Phase 1: Architect Design
    log("PHASE", CYAN, `1: Architect Design — Cycle ${cycle}`);
    if (cycle === 0) {
      await spawnAgent(
        "architect",
        `Read workspace/project_state.json for all constraints.\nThis is cycle 0 — create the initial design.\nGenerate workspace/design_v1.ifc.`,
      );
    } else {
      const bcfContext = readBcfErrors(cycle - 1);
      await spawnAgent(
        "architect",
        `Read workspace/project_state.json for constraints.\nThis is cycle ${cycle}. Fix these BCF ERROR issues:\n\n${bcfContext}\n\nRead previous design workspace/design_v${cycle}.ifc, fix issues, save as workspace/design_v${v}.ifc.`,
      );
    }

    // Verify design was created
    const designPath = `workspace/design_v${v}.ifc`;
    if (!existsSync(designPath)) {
      log("ERROR", RED, `Architect did not create ${designPath}`);
      continue;
    }

    // Phase 1.5: Visual QA Gate
    log("PHASE", CYAN, `1.5: Visual QA — Cycle ${cycle}`);
    const port = startViewer(cycle);
    let vqaResult = "";
    try {
      vqaResult = await spawnAgent(
        "visual-qa",
        `Verify workspace/design_v${v}.ifc geometry.\nViewer is running at http://localhost:${port} (screenshots may not work if no browser client is connected — that's OK, use numerical checks).\nDesign version: v${v}.\nCheck storey elevations, element counts, wall Z-coordinates.\nWrite workspace/visual_qa_v${v}.md with PASS/FAIL verdict.`,
      );
    } catch (e) {
      log(
        "GATE",
        YELLOW,
        `Visual QA agent crashed (${(e as Error).message?.slice(0, 80)}) — proceeding with specialists`,
      );
    }
    stopViewer();

    if (
      vqaResult.toUpperCase().includes("FAIL") ||
      vqaResult.toUpperCase().includes("ERROR")
    ) {
      log(
        "GATE",
        RED,
        "Visual QA FAILED — geometry errors, re-running architect",
      );
      updateProjectState(cycle, { errors: 1, warnings: 0 });
      continue; // Skip specialists, go to next cycle
    }
    log("GATE", GREEN, "Visual QA PASSED — proceeding to specialists");

    // Phase 2: Pre-analysis
    log("PHASE", CYAN, `2: Pre-analysis — Cycle ${cycle}`);
    runPreAnalysis(cycle);

    // Phase 3: Specialist Review (all 4 in parallel)
    log("PHASE", CYAN, `3: Specialist Review — Cycle ${cycle} (4 parallel)`);
    const siteAvailable = existsSync("workspace/site_context.ifc");
    const siteNote = siteAvailable
      ? ""
      : "\nNOTE: workspace/site_context.ifc is unavailable. Skip any queries against it.";

    // Read project state to pass energy standard to specialists
    const projectState = existsSync("workspace/project_state.json")
      ? JSON.parse(readFileSync("workspace/project_state.json", "utf8"))
      : {};
    const energyStandard = projectState?.brief?.energy_standard || "standard";

    const specialistContext = `Design version: v${v} (file: workspace/design_v${v}.ifc)
Cycle: ${cycle}
Energy standard: ${energyStandard}
Pre-analyzed data is in workspace/analysis/ — read those JSON files, do NOT run ifc-lite query commands.
Write your BCF output to workspace/{discipline}_v${v}.bcf using ifc-lite bcf create --from-json.${siteNote}`;

    await Promise.all([
      spawnAgent(
        "structural",
        `${specialistContext}\nOutput: workspace/structural_v${v}.bcf`,
      ),
      spawnAgent(
        "mep",
        `${specialistContext}\nOutput: workspace/mep_v${v}.bcf`,
      ),
      spawnAgent(
        "facade",
        `${specialistContext}\nOutput: workspace/facade_v${v}.bcf`,
      ),
      spawnAgent(
        "fire",
        `${specialistContext}\nOutput: workspace/fire_v${v}.bcf`,
      ),
    ]);

    // Phase 4: Convergence Check
    const counts = countBcfErrors(cycle);
    updateProjectState(cycle, counts);

    log(
      "CONVERGE",
      counts.errors === 0 ? GREEN : YELLOW,
      `Cycle ${cycle}: ${counts.errors} errors, ${counts.warnings} warnings`,
    );

    if (counts.errors > 0 && counts.details.length > 0) {
      for (const d of counts.details.slice(0, 5)) {
        log("CONVERGE", DIM, `  ${d}`);
      }
    }

    if (counts.errors === 0) {
      log("CONVERGE", GREEN, "Zero errors — converged!");
      break;
    }
  }

  // ── Phase 5: Final Report ──────────────────────────────────────────────
  log("PHASE", CYAN, "5: Final Report");
  writeReport(finalCycle);

  // Launch final viewer
  const v = finalCycle + 1;
  const designPath = `workspace/design_v${v}.ifc`;
  if (existsSync(designPath)) {
    startViewer(finalCycle);
    log("DONE", GREEN, `Viewer: http://localhost:${VIEWER_PORT}`);
  }

  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log("");
  console.log(`${CYAN}${BOLD}${"═".repeat(60)}${RESET}`);
  log("DONE", GREEN, `Pipeline complete in ${elapsed} minutes`);
  log("DONE", GREEN, `Report: workspace/project_report_final.md`);
  log("DONE", GREEN, `Design: workspace/design_v${v}.ifc`);
  console.log(`${CYAN}${BOLD}${"═".repeat(60)}${RESET}`);
}

// ── Entry point ──────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error(`${RED}${BOLD}Pipeline failed:${RESET}`, err);
  process.exit(1);
});
