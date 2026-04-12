// Build a multi-topic BCF report for a discipline review.
//
// Usage (via `ifc-lite run`):
//   BCF_INPUT=workspace/bcf-input-structural.json \
//     ifc-lite run scripts/bcf-build.js workspace/design_vN.ifc
//
// The input JSON path comes from the BCF_INPUT environment variable so that
// specialist agents running in parallel never race on a shared file. If
// BCF_INPUT is not set, it defaults to workspace/bcf-input.json.
//
// Input JSON shape:
//   {
//     "discipline": "structural",
//     "version": 1,
//     "projectName": "Structural Review v1",
//     "author": "structural@bim",
//     "outPath": "workspace/structural_v1.bcf",
//     "idsReport": {...optional IDS report JSON as produced by `ifc-lite ids --json`'s .report field...},
//     "findings": [
//       {
//         "severity": "ERROR" | "WARNING" | "INFO",
//         "title": "Short headline (no ERROR: prefix needed)",
//         "description": "Full explanation with fix suggestion",
//         "globalIds": ["0ab7INhk...", "..."],
//         "labels": ["SIA 262", "Structural"],
//         "priority": "High" | "Normal" | "Low"
//       }
//     ]
//   }
//
// Output: BCF 2.1 file written to input.outPath. Each finding becomes a
// topic with topicType set from severity and a viewpoint that selects and
// colours the affected elements so a human opening the BCF can jump
// straight to the problem.

async function run() {
  const fs = await import("fs");
  const inputPath = process.env.BCF_INPUT ?? "workspace/bcf-input.json";
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing ${inputPath} — write the findings JSON first (set BCF_INPUT to change path)`);
  }
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));

  const severityToTopicType = {
    ERROR: "Error",
    WARNING: "Warning",
    INFO: "Info",
  };
  const severityToPriority = {
    ERROR: "High",
    WARNING: "Normal",
    INFO: "Low",
  };
  const COLOR_ERROR = "FFFF3333";
  const COLOR_WARNING = "FFFFCC00";
  const COLOR_INFO = "FF3399FF";
  const severityToColor = {
    ERROR: COLOR_ERROR,
    WARNING: COLOR_WARNING,
    INFO: COLOR_INFO,
  };

  // Seed the project from an IDS report if provided — this gives us one topic
  // per failing entity with viewpoints already wired up. Otherwise start empty.
  let project;
  if (input.idsReport) {
    project = await bim.bcf.createFromIDSReport(input.idsReport, {
      projectName: input.projectName ?? `${input.discipline} v${input.version}`,
      author: input.author ?? `${input.discipline}@bim`,
    });
  } else {
    project = await bim.bcf.createProject({
      name: input.projectName ?? `${input.discipline} v${input.version}`,
    });
  }

  // Append semantic findings that IDS cannot express (spans, WFR ratios,
  // escape routes, etc.). Each becomes its own topic with a viewpoint
  // highlighting the affected elements.
  for (const f of input.findings ?? []) {
    const severity = String(f.severity ?? "INFO").toUpperCase();
    const topicType = severityToTopicType[severity] ?? "Info";
    const priority = f.priority ?? severityToPriority[severity] ?? "Normal";
    const labels = Array.isArray(f.labels) ? f.labels : [];

    const topic = await bim.bcf.createTopic({
      title: f.title,
      description: f.description,
      author: input.author ?? `${input.discipline}@bim`,
      topicType,
      priority,
      labels,
    });

    const gids = Array.isArray(f.globalIds)
      ? f.globalIds.filter((g) => typeof g === "string" && g.length > 0)
      : [];
    if (gids.length > 0) {
      const color = severityToColor[severity] ?? COLOR_INFO;
      // A camera is mandatory — bim.bcf.createViewpoint dereferences
      // camera.isOrthographic without null-checking. Default to an isometric
      // perspective camera looking at the origin; authors can replace it
      // from inside the viewer later.
      const viewpoint = await bim.bcf.createViewpoint({
        camera: {
          mode: "perspective",
          position: [30, 20, 15],
          target: [0, 0, 3],
          up: [0, 0, 1],
        },
        components: {
          selection: gids.map((g) => ({ GlobalId: g })),
          coloring: [
            { color, components: gids.map((g) => ({ GlobalId: g })) },
          ],
        },
      });
      await bim.bcf.addViewpoint(topic, viewpoint);
    }

    await bim.bcf.addTopic(project, topic);
  }

  const blob = await bim.bcf.write(project);
  const buf = Buffer.from(await blob.arrayBuffer());
  const outPath = input.outPath ?? `workspace/${input.discipline}_v${input.version}.bcf`;
  fs.writeFileSync(outPath, buf);

  // Summary to stdout for the specialist agent to log.
  const topics = project?.topics ?? {};
  const topicCount = Array.isArray(topics)
    ? topics.length
    : Object.keys(topics).length;
  console.log(
    JSON.stringify({
      ok: true,
      outPath,
      topicCount,
      findingsAppended: (input.findings ?? []).length,
      hadIdsReport: Boolean(input.idsReport),
    }),
  );
}

run().catch((e) => {
  console.error("bcf-build error:", e?.message ?? e);
  if (e?.stack) console.error(e.stack.split("\n").slice(0, 5).join("\n"));
  process.exit(1);
});
