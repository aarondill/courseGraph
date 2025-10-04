import cp from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { courses, degreeName, plan } from "./input.ts";

function esc(strings: TemplateStringsArray | string, ...values: any[]) {
  if (typeof strings === "string") return strings.replaceAll('"', '\\"');
  return String.raw(
    { raw: strings },
    ...values.map(s => String(s).replaceAll('"', '\\"'))
  );
}

const nodes = courses
  .values()
  .map(c => {
    const semester = plan.courseToSemester.has(c.id)
      ? " - " + plan.courseToSemester.get(c.id)!
      : "";
    const allPrereqsMet = c.reqs
      .values()
      .every(req => plan.courseToSemester.has(req));
    const isFastTrackPrereq = c.isFastTrackBenchmark;
    const outlineColor = isFastTrackPrereq ? "red" : "";
    const color = plan.courseToSemester.has(c.id)
      ? "lightgreen"
      : allPrereqsMet
        ? "yellow"
        : "";
    const ret =
      esc`"${c.id}" [ label = "\\N${semester}\\n${c.name}"` +
      (color ? esc`, fillcolor = "${color}"` : "") +
      (outlineColor ? esc`, color = "${outlineColor}", penwidth = 7` : "") +
      `];`;
    if (c.reqs.size === 0) return ret;
    return (
      ret +
      esc`\n{"` +
      c.reqs.values().map(esc).toArray().join('", "') +
      `"} -> "${c.id}";`
    );
  })
  .toArray()
  .join("\n");

// Course IDs that have no prerequisites - Connect them to the root node
const noPrereqs = courses
  .values()
  .filter(c => c.reqs.size === 0)
  .map(c => c.id)
  .toArray();
const root =
  esc`degree [ label = "${degreeName}", fillcolor = "orangered" ];` +
  `degree -> {"${noPrereqs.map(esc).join('", "')}"};`;

const output = `strict digraph graph_name {
  graph [
    label = "Degree Plan",
    labelloc = "t",
    labeljust = "c",
    rankdir = TB,
    splines = spline,
    ranksep = 2.5,
    nodesep = 0
    fontsize = 30
    size = "11,8.5"
    ratio = "compress"
  ];
  node [
    style = "solid,filled",
    fillcolor = "lightblue2",
    margin = 0.01
  ];
  ${nodes.replaceAll("\n", "\n  ")}
  ${root}
}
`;

const outputFile = process.argv[2] || "Course Graph.svg";
const ext = path.basename(outputFile).split(".").pop();
if (ext == "gv") {
  // if the user wants the graph, give it to them
  await fs.writeFile(outputFile, output);
} else {
  // Otherwise, run dot with the output as it's stdin to create the desired output format
  cp.spawnSync("dot", [`-T${ext}`, "-o", outputFile], {
    input: output,
    stdio: ["pipe", "inherit", "inherit"],
  });
}
