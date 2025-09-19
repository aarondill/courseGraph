import { execSync } from "node:child_process";
import fs from "node:fs/promises";
type json = {
  courses: Record<string, { name: string; reqs: string[] }>; // course code -> {course name, prerequisite codes}
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

function esc(strings: TemplateStringsArray, ...values: any[]) {
  return String.raw(
    { raw: strings },
    ...values.map(s => String(s).replaceAll('"', '\\"'))
  );
}

const nodes = Object.entries(json.courses).map(([id, name]) => {
  const semester = courseToSemester.has(id)
    ? "\\n" + courseToSemester.get(id)!
    : "";
  const color = semester ? `, fillcolor = "lightgreen"` : "";
  return esc`"${id}" [ label = "\\N\\n${name}${semester}"` + color + ` ];`;
});

const output = `strict digraph graph_name {
  graph [
    label = "sample graph",
    labelloc = "t",
    labeljust = "c",
    rankdir = TB,
    splines = spline,
    ranksep = 1.0,
    nodesep = 0.9
  ];
  node [ style = "solid,filled", fillcolor = "lightblue2", ];
  ${nodes.join("\n")}
}
`;

fs.writeFile("./out.gv", output);
execSync("dot -Tsvg out.gv -o out.svg");
