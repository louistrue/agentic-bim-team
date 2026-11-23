// Orchestrator v2 — "the loop closes in code, the agents judge".
// Deterministic: site data, IDS from the AIA, compilation to IFC, checks, renders, issue ledger, BCF, report.
// Agents: architect (designs/revises intent), visual QA (looks at renders), 4 specialists (judgement).
// Run: npx tsx orchestrator-v2.ts "Loorenstrasse 62, 8053 Zürich" brief.json
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "fs";
import { execFileSync } from "child_process";

const MAX_CYCLES = Number(process.env.MAX_CYCLES ?? 4);
const C = { dim: "\x1b[2m", b: "\x1b[1m", r: "\x1b[0m", cy: "\x1b[36m", g: "\x1b[32m", y: "\x1b[33m", red: "\x1b[31m", m: "\x1b[35m" };
const ts = () => new Date().toLocaleTimeString("de-CH", { hour12: false });
const log = (tag: string, col: string, msg: string) => console.log(`${C.dim}${ts()}${C.r} ${col}${C.b}${tag}${C.r} ${msg}`);
const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 256e6, stdio: ["ignore", "pipe", "pipe"] });
const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const state: any = { started: new Date().toISOString(), versions: [], agents: [], costUsd: 0 };
const saveState = () => writeFileSync("workspace/run.json", JSON.stringify(state, null, 1));

const SPECIALISTS: Record<string, { discipline: string; role: string; focus: string }> = {
  structural: { discipline: "Tragwerk", role: "Tragwerksplaner (Holzbau/Beton)", focus: "Lastabtragung über die Geschosse (übereinanderliegende tragende Wände), Spannweiten der Brettsperrholzdecken, Aussteifung (Kern, Scheiben), Öffnungen in tragenden Wänden, Fundation/Bodenplatte." },
  mep: { discipline: "Haustechnik", role: "HLKS-Planer", focus: "Steigzonen/Schächte (übereinander, nahe Bäder/Küchen), Nasszellen-Stapelung, Technikraum, Lüftung Minergie (Platz für Komfortlüftung), Leitungsführung durch Brandabschnitte." },
  facade: { discipline: "Energie/Fassade", role: "Energie- und Fassadenplaner", focus: "Kompaktheit (Gebäudehüllzahl), Fensteranteil und Orientierung (Sommer/Winter), Wärmebrücken (Balkone, Kern, Sockel), Plausibilität der U-Werte zu den Schichtaufbauten, sommerlicher Wärmeschutz." },
  fire: { discipline: "Brandschutz", role: "Brandschutzfachperson (VKF)", focus: "Fluchtwege und Treppenhaus als Brandabschnitt, Wohnungen als Brandabschnitte, Holzbau-spezifische Anforderungen (Gebäude geringer Höhe), Schutzabstände zu Nachbarbauten bei Holzfassade, Feuerwehrzugang." },
};

function logMsg(name: string, msg: SDKMessage) {
  const p = `${C.dim}${ts()}${C.r} ${C.m}${C.b}${name}${C.r}`;
  if (msg.type === "assistant") for (const b of (msg as any).message.content) {
    if (b.type === "text" && b.text.trim()) console.log(`${p}  ${b.text.trim().split("\n").slice(0, 8).join(`\n${p}  `)}`);
    else if (b.type === "tool_use") { const i = b.input as any; console.log(`${p} ${C.y}${b.name}${C.r} ${C.dim}${(i.command ?? i.file_path ?? JSON.stringify(i)).toString().slice(0, 160)}${C.r}`); }
  }
  if (msg.type === "result") log("DONE", C.g, `${name} · ${(msg as any).num_turns} turns · $${((msg as any).total_cost_usd ?? 0).toFixed(2)} · ${msg.subtype}`);
}

async function agent(name: string, systemPrompt: string, task: string, model = "claude-sonnet-5-5", tools = ["Bash", "Read", "Write", "Edit"]) {
  log("AGENT", C.g, `${name} (${model})`);
  const t0 = Date.now(); let result = "", cost = 0, ok = false;
  for await (const msg of query({ prompt: task, options: { model, systemPrompt, allowedTools: tools, cwd: process.cwd(), maxTurns: 120, permissionMode: "bypassPermissions" as any, allowDangerouslySkipPermissions: true, pathToClaudeCodeExecutable: process.env.CLAUDE_BIN ?? `${process.env.HOME}/.local/bin/claude`, settingSources: [] } as any })) {
    logMsg(name, msg as SDKMessage);
    if ((msg as any).type === "result") { ok = (msg as any).subtype === "success"; result = (msg as any).result ?? ""; cost = (msg as any).total_cost_usd ?? 0; }
  }
  state.costUsd += cost; state.agents.push({ name, model, ok, seconds: Math.round((Date.now() - t0) / 1000), costUsd: cost }); saveState();
  return result;
}

function openIssuesText(discipline?: string): string {
  if (!existsSync("workspace/issues.json")) return "(keine – erste Version)";
  const L = Object.values(json("workspace/issues.json").issues) as any[];
  const sel = L.filter((i) => i.status === "Open" && (!discipline || i.discipline === discipline));
  if (!sel.length) return "(keine)";
  return sel.sort((a, b) => (a.severity > b.severity ? 1 : -1))
    .map((i) => `- [${i.severity}] ${i.id} · ${i.title}\n  Bauteile: ${i.elements.join(", ") || "Modell"}\n  ${i.text}`).join("\n");
}

function mergeReviews(v: number) {
  const K = json(`workspace/design_v${v}.keys.json`);
  const findings: any[] = [], rejected: any[] = [];
  const files = [["visual", `workspace/visual_qa_v${v}.json`, "Visual QA"], ...Object.entries(SPECIALISTS).map(([k, s]) => [k, `workspace/review_v${v}_${k}.json`, s.discipline])];
  const summaries: any = {};
  for (const [k, f, disc] of files) {
    if (!existsSync(f)) { rejected.push({ source: disc, reason: `${f} fehlt` }); continue; }
    let r: any; try { r = json(f); } catch (e) { rejected.push({ source: disc, reason: `${f} ist kein gültiges JSON` }); continue; }
    summaries[disc] = { summary: r.summary, verdict: r.verdict, notCheckable: r.notCheckable ?? [] };
    (r.findings ?? []).forEach((x: any, i: number) => {
      const els = (x.elements ?? []).filter((e: string) => K[e]);
      if (!els.length) { rejected.push({ source: disc, title: x.title, reason: `kein existierendes Bauteil (${(x.elements ?? []).join(", ") || "keins angegeben"})` }); return; }
      const slug = (x.title ?? "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      const known = x.issueId && existsSync("workspace/issues.json") && json("workspace/issues.json").issues[x.issueId];
      findings.push({ id: known ? x.issueId : `${k.toUpperCase()}-${slug}:${els[0]}`, rule: k.toUpperCase(), severity: x.severity ?? "INFO", title: x.title, text: `${x.text}${x.basis ? `\nGrundlage: ${x.basis}` : ""}${x.verify ? `\nPrüfen: ${x.verify}` : ""}`, elements: els, discipline: disc, source: x.basis, who: `${disc}` });
    });
  }
  const resolved: any[] = [];
  for (const [k, f, disc] of files) if (existsSync(f)) { try { for (const r of json(f).resolved ?? []) resolved.push({ ...r, discipline: disc }); } catch {} }
  writeFileSync(`workspace/review_v${v}.json`, JSON.stringify({ version: v, findings, rejected, resolved, summaries }, null, 1));
  return { findings, rejected };
}

async function main() {
  const address = process.argv[2] ?? "Loorenstrasse 62, 8053 Zürich";
  const briefPath = process.argv[3] ?? "brief.json";
  const RESUME = process.env.RESUME === "1" && existsSync("workspace/run.json");
  if (RESUME) Object.assign(state, json("workspace/run.json"));
  else if (existsSync("workspace/run.json")) { const t = new Date().toISOString().replace(/[:.]/g, "-"); mkdirSync("workspace-archive", { recursive: true }); renameSync("workspace", `workspace-archive/${t}`); }
  mkdirSync("workspace/renders", { recursive: true });
  console.log(`\n${C.cy}${C.b}AGENTENTEAM v2 · ${address}${C.r}\n${C.dim}Deterministisch: Standort, IDS, Compiler, Prüfungen, BCF, Bericht · Agenten: Architektur, Visual QA, 4 Fachplaner${C.r}\n`);

  if (!RESUME) {
  log("PHASE", C.cy, "0 Standort + Anforderungen");
  state.site = JSON.parse(run("node", ["scripts/site.mjs", address, briefPath]).trim().split("\n").pop()!);
  state.ids = JSON.parse(run("node", ["scripts/requirements-to-ids.mjs", briefPath, "workspace/requirements.ids"]));
  run("npx", ["ifc-lite", "ids", "audit", "workspace/requirements.ids"]); // throws if the IDS itself is invalid
  log("SITE", C.g, JSON.stringify(state.site)); saveState();
  }

  const archPrompt = readFileSync("agent-prompts-v2/architect.md", "utf8");
  const vqaPrompt = readFileSync("agent-prompts-v2/visual-qa.md", "utf8");
  const specTpl = readFileSync("agent-prompts-v2/specialist.md", "utf8");

  const firstV = RESUME ? Math.max(...state.versions.map((x: any) => x.v)) + 1 : 1;
  for (let v = firstV; v <= MAX_CYCLES; v++) {
    const V: any = { v, started: new Date().toISOString() }; state.versions.push(V);
    log("PHASE", C.cy, `v${v} · 1 Architektur`);
    await agent(`architect v${v}`, archPrompt, `Version N=${v}.\n${v === 1 ? "Erste Version: entwirf das Gebäude." : `Überarbeite workspace/design_v${v - 1}.json. Offene Punkte aus dem Issue-Ledger (alle mit Bauteil-Keys):\n${openIssuesText()}`}\nSchreibe workspace/design_v${v}.json, kompiliere, prüfe, schreibe workspace/design_v${v}_notes.md.`, "claude-opus-5-5");
    if (!existsSync(`workspace/design_v${v}.json`)) { log("STOP", C.red, `design_v${v}.json fehlt`); V.error = "no design"; break; }
    // trust nothing: compile and check again here
    try { V.compile = JSON.parse(run("node", ["scripts/compile.mjs", `workspace/design_v${v}.json`]).trim()); }
    catch (e: any) { V.compile = { ok: false, out: e.stdout }; log("COMPILE", C.red, e.stdout?.slice(0, 600)); await agent(`architect v${v} repair`, archPrompt, `Version N=${v}. Der Compiler lehnt workspace/design_v${v}.json ab:\n${e.stdout}\nKorrigiere die Datei, kompiliere erneut.`, "claude-opus-5-5"); V.compile = JSON.parse(run("node", ["scripts/compile.mjs", `workspace/design_v${v}.json`]).trim()); }
    log("COMPILE", C.g, JSON.stringify(V.compile));
    log("PHASE", C.cy, `v${v} · 2 Prüfungen (IDS, Zonen, Räume, Brandschutz, Hülle)`);
    V.checks = JSON.parse(run("node", ["scripts/check.mjs", String(v)]).trim());
    run("node", ["scripts/render.mjs", String(v)]); run("uv", ["run", "--quiet", "--with", "pillow", "python", "scripts/siteplan.py", String(v)]);
    log("CHECK", V.checks.counts.ERROR ? C.y : C.g, JSON.stringify(V.checks));
    if (v > 1) {
      const d = run("npx", ["ifc-lite", "diff", `workspace/design_v${v - 1}.ifc`, `workspace/design_v${v}.ifc`, "--by-entity"]);
      const m = (k: string) => Number(d.match(new RegExp(`${k}:\\s+(\\d+)`))?.[1] ?? NaN);
      V.identity = { common: m("Common"), added: m("Added"), removed: m("Removed") };
      log("DIFF", C.g, JSON.stringify(V.identity));
    }
    log("PHASE", C.cy, `v${v} · 3 Visual QA + Fachplanung (parallel)`);
    await Promise.all([
      agent(`visual-qa v${v}`, vqaPrompt, `Version N=${v}. Prüfe die Renders (auch v${v}_grundriss_*.png) und schreibe workspace/visual_qa_v${v}.json.\nOffene Visual-QA-Punkte:\n${openIssuesText("Visual QA")}`, "claude-sonnet-5-5", ["Read", "Write", "Bash"]),
      ...Object.entries(SPECIALISTS).map(([k, s]) => agent(`${k} v${v}`, specTpl.replaceAll("{{DISCIPLINE}}", s.discipline).replaceAll("{{ROLE}}", s.role).replaceAll("{{FOCUS}}", s.focus).replaceAll("{{KEY}}", k), `Version N=${v}. Schreibe workspace/review_v${v}_${k}.json.\nOffene Punkte deiner Disziplin aus früheren Versionen:\n${openIssuesText(s.discipline)}\nNotizen der Architektur: workspace/design_v${v}_notes.md`, "claude-sonnet-5-5", ["Read", "Write", "Bash"])),
    ]);
    const merged = mergeReviews(v);
    V.review = { findings: merged.findings.length, rejected: merged.rejected };
    if (merged.rejected.length) log("REVIEW", C.y, `${merged.rejected.length} Befunde abgelehnt (kein existierendes Bauteil)`);
    log("PHASE", C.cy, `v${v} · 4 Issue-Ledger + BCF`);
    V.issues = JSON.parse(run("node", ["scripts/issues.mjs", String(v)]).trim());
    const open = (Object.values(json("workspace/issues.json").issues) as any[]).filter((i) => i.status === "Open");
    V.openErrors = open.filter((i) => i.severity === "ERROR").length; V.openWarnings = open.filter((i) => i.severity === "WARNING").length;
    V.finished = new Date().toISOString(); saveState();
    log("CONVERGE", V.openErrors ? C.y : C.g, `v${v}: ${V.openErrors} ERROR offen, ${V.openWarnings} WARNING offen, ${V.issues.closed} erledigt`);
    // STOP_ON=ERROR (default): stop when no ERROR is open. STOP_ON=WARNING: also work off the warnings.
    if (V.openErrors === 0 && (process.env.STOP_ON !== "WARNING" || V.openWarnings === 0)) break;
  }
  log("PHASE", C.cy, "5 Bericht");
  state.finished = new Date().toISOString(); saveState();
  console.log(run("node", ["scripts/report.mjs"]));
  log("DONE", C.g, `Kosten Agenten: $${state.costUsd.toFixed(2)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
