import { query } from "@anthropic-ai/claude-agent-sdk";
for await (const m of query({ prompt: "Reply with exactly: ok", options: { model: "claude-opus-5-5", maxTurns: 1, pathToClaudeCodeExecutable: "/home/louistrue/.local/bin/claude", allowedTools: [] } as any })) {
  if ((m as any).type === "system" && (m as any).subtype === "init") console.log("model", (m as any).model);
  if ((m as any).type === "result") console.log((m as any).subtype, (m as any).result, (m as any).total_cost_usd);
}
