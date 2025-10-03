import packageJson from "../package.json" with { type: "json" };
import { fastTrackRequirements, json } from "./input.ts";

// HACK: this behavior relies on the json order of the keys.
// This depends on the user ordering the keys in the json file and on JSON.parse being stable.
const takenCourses = new Set<string>();

function printPlan(all: Record<string, string[]>) {
  const lines: string[] = []; // lines of output
  for (const [semester, courses] of Object.entries(all)) {
    // Add all course in this semester to the taken list (in case of
    // co-requisites). The user needs to make sure they don't take a
    // prerequisite in the same semester as the dependent course.
    courses.forEach(c => takenCourses.add(c));
    lines.push(`## ${semester}`);
    for (const course of courses) {
      let output = `  - ${course}: ${json.courses[course]?.name}`;

      if (fastTrackRequirements?.includes(course)) {
        output += " *<u>(Fast Track Benchmark)</u>*";
      }

      const prereqs = json.courses[course]?.reqs; // Minimum prerequisites (from ./input.ts)
      const missing = prereqs?.filter(c => !takenCourses.has(c));
      if (missing?.length) {
        // The user needs to re-order their courses to avoid this
        const warning = `⚠️WARNING⚠️: missing prereqs: ${missing.join(", ")}`;
        output += ` (${warning})`;
        console.error(`${course}: ${warning}`);
      }

      lines.push(output);
    }
  }
  return lines.join("\n");
}

console.log(
  [
    `# ${json.degree}`,
    `_Generated using [CourseGraph](${packageJson.repository})_`,
    "", // Empty line
    printPlan(json.taken),
    `\n----------\n`, // Separate taken from future
    printPlan(json.future),
  ].join("\n")
);
