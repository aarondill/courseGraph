import cp from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
type json = {
  degree: string; // Degree name
  courses: Record<string, { name: string; reqs?: string[] }>; // course code -> {course name, prerequisite codes}
  taken: Record<string, string[]>; // semester -> course code[]
};
const json = JSON.parse(await fs.readFile("./courses.json", "utf8")) as json;
// Comments are allowed in the properties of "courses". Remove any keys that start with "//"
json.courses = Object.fromEntries(
  Object.entries(json.courses).filter(([k]) => !k.startsWith("//"))
);

const courseToSemester = Object.entries(json.taken).reduce(
  (acc, [semester, courses]) => {
    courses.forEach(course => acc.set(course, semester));
    return acc;
  },
  new Map<string, string>()
);

function esc(strings: TemplateStringsArray | string, ...values: any[]) {
  if (typeof strings === "string") return strings.replaceAll('"', '\\"');
  return String.raw(
    { raw: strings },
    ...values.map(s => String(s).replaceAll('"', '\\"'))
  );
}

const nodes = Object.entries(json.courses)
  .map(([id, { name, reqs }]) => {
    const semester = courseToSemester.has(id)
      ? " - " + courseToSemester.get(id)!
      : "";
    const allPrereqsMet = reqs?.every(req => courseToSemester.has(req)) ?? true;
    const color = courseToSemester.has(id)
      ? `, fillcolor = "lightgreen"`
      : allPrereqsMet
        ? ", fillcolor = yellow"
        : "";
    const ret =
      esc`"${id}" [ label = "\\N${semester}\\n${name}"` + color + ` ];`;
    if (!reqs || reqs.length === 0) return ret;
    return ret + esc`\n{"` + reqs.map(esc).join('", "') + `"} -> "${id}";`;
  })
  .join("\n");

// Course IDs that have no prerequisites - Connect them to the root node
const noPrereqs = Object.keys(json.courses).filter(
  id => !json.courses[id]?.reqs?.length
);
const root =
  esc`degree [ label = "${json.degree}", fillcolor = "orangered" ];` +
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

const outputFile = process.argv[2] || "out.svg";
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
