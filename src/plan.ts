import packageJson from "../package.json" with { type: "json" };
import type { CourseCode, Semester } from "./input.ts";
import { courses, degreeName, plan } from "./input.ts";

// HACK: this behavior relies on the json order of the keys.
// This depends on the user ordering the keys in the json file and on JSON.parse being stable.
const takenCourses = new Set<string>();

function printPlan(all: Map<Semester, Set<CourseCode>>) {
  const lines: string[] = []; // lines of output
  for (const [semester, totake] of all.entries()) {
    // Add all course in this semester to the taken list (in case of
    // co-requisites). The user needs to make sure they don't take a
    // prerequisite in the same semester as the dependent course.
    totake.forEach(c => takenCourses.add(c));
    lines.push(`## ${semester}`);
    for (const id of totake) {
      const course = courses.get(id);
      if (!course) throw new Error(`Course ${id} not found`);
      let output = `  - ${id}: ${course?.name}`;

      if (course.isFastTrackBenchmark) {
        output += " *<u>(Fast Track Benchmark)</u>*";
      }

      const missing = course.reqs.difference(takenCourses);
      if (missing.size > 0) {
        // The user needs to re-order their courses to avoid this
        const warning = `⚠️WARNING⚠️: missing prereqs: ${[...missing].join(", ")}`;
        output += ` (${warning})`;
        console.error(`${id}: ${warning}`);
      }

      lines.push(output);
    }
  }
  return lines.join("\n");
}

console.log(
  [
    `# ${degreeName}`,
    `_Generated using [CourseGraph](${packageJson.repository})_`,
    "", // Empty line
    printPlan(plan.taken),
    `\n----------\n`, // Separate taken from future
    printPlan(plan.future),
  ].join("\n")
);
