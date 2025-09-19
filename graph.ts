import { execSync } from "node:child_process";
import fs from "node:fs/promises";
type json = {
  degree: string; // Degree name
  courses: Record<string, { name: string; reqs?: string[] }>; // course code -> {course name, prerequisite codes}
  taken: Record<string, string[]>; // semester -> course code[]
};
const json = JSON.parse(await fs.readFile("./courses.json", "utf8")) as json;
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
    const color = semester ? `, fillcolor = "lightgreen"` : "";
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
  esc`"${json.degree}" -> {"` + noPrereqs.map(esc).join('", "') + `"};`;

const output = `strict digraph graph_name {
  graph [
    label = "Degree Plan",
    labelloc = "t",
    labeljust = "c",
    rankdir = TB,
    splines = spline,
    ranksep = 1.0,
    nodesep = 0.9
  ];
  node [ style = "solid,filled", fillcolor = "lightblue2", ];
  ${nodes.replaceAll("\n", "\n  ")}
  ${root}
}
`;

await fs.writeFile("./out.gv", output);
execSync("dot -Tsvg out.gv -o out.svg", { stdio: "inherit" });
