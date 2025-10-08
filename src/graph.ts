import cp from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { courses, degreeName, plan, type Course } from "./input/index.ts";
import { getAsserter } from "./input/util.ts";

function esc(strings: TemplateStringsArray | string, ...values: any[]) {
  if (typeof strings === "string") return strings.replaceAll('"', '\\"');
  return String.raw(
    { raw: strings },
    ...values.map(s => String(s).replaceAll('"', '\\"'))
  );
}
// We can take a course if it's prerequisites are met *and* all it's co-requisites' prerequisites are met
const get = getAsserter(courses);
const canTakeCourse = (c: Course) =>
  c.reqs.values().every(req => plan.courseToSemester.has(req)) &&
  c.coreqs.values().map(get).every(canTakeCourse);

const nodes = courses
  .values()
  .map(c => {
    const semester = plan.courseToSemester.has(c.id)
      ? " - " + plan.courseToSemester.get(c.id)!
      : "";
    const allPrereqsMet = canTakeCourse(c);
    const isFastTrackPrereq = c.isFastTrackBenchmark;
    const outlineColor = isFastTrackPrereq ? "red" : "";
    const color = plan.courseToSemester.has(c.id)
      ? "lightgreen"
      : allPrereqsMet
        ? "yellow"
        : "";
    const replacementFor = c.replacementFor ? ` (${c.replacementFor})` : "";
    let ret =
      esc`"${c.id}" [ label = "\\N${replacementFor}${semester}\\n${c.name}"` +
      (color ? esc`, fillcolor = "${color}"` : "") +
      (outlineColor ? esc`, color = "${outlineColor}", penwidth = 7` : "") +
      `];`;
    if (c.reqs.size > 0) {
      ret +=
        esc`\n{"` +
        c.reqs.values().map(esc).toArray().join('", "') +
        `"} -> "${c.id}";`;
    }
    if (c.coreqs.size > 0) {
      ret +=
        esc`\n{ rank=same; { "` +
        c.coreqs.values().map(esc).toArray().join('", "') +
        `"} -> "${c.id}" [ style = "dashed" ]; }`;
    }
    return ret;
  })
  .toArray()
  .join("\n");

// Course IDs that have no prerequisites - Connect them to the root node
const noPrereqs = courses
  .values()
  .filter(c => c.reqs.size === 0 && c.coreqs.size === 0)
  .map(c => c.id)
  .toArray();
const root =
  esc`degree [ label = "${degreeName}", fillcolor = "orangered" ];` +
  `degree -> { rank=same; "${noPrereqs.map(esc).join('", "')}"};`;

const output = `strict digraph graph_name {
  graph [
    label = "Degree Plan\\n\\n",
    labelloc = "t",
    labeljust = "c",
    rankdir = TB,
    splines = spline,
    ranksep = 1.5,
    nodesep = .25
    fontsize = 30
    margin="0.5,0.75";
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
