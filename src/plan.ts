import packageJson from "../package.json" with { type: "json" };
import type { CourseCode, Semester } from "./input/index.ts";
import { courses, degreeName, plan } from "./input/index.ts";

const takenCourses = new Set<string>();

const indent = (str: string, depth = 1, indent = "  ") =>
  str
    .split("\n")
    .map(l => indent.repeat(depth) + l)
    .join("\n");

/**
 * Format a course code for printing
 * NOTE: Assumes takenCourses is updated from outside
 */
function formatCourse(id: CourseCode) {
  let output = `${id}:`;

  const course = courses.get(id);
  if (course) {
    if (course.replacementFor) output += ` (${course.replacementFor})`;

    output += ` ${course?.name}`;

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
  } else {
    output += ` <u>🚨MISSING from catalog!🚨</u>`;
  }

  return output;
}
function printPlan(all: Map<Semester, Set<CourseCode>>): string {
  const lines: string[] = []; // lines of output
  for (const [semester, totake] of all.entries()) {
    // Add all course in this semester to the taken list (in case of
    // co-requisites). The user needs to make sure they don't take a
    // prerequisite in the same semester as the dependent course.
    totake.forEach(c => takenCourses.add(c));
    lines.push(`## ${semester}`);
    totake
      .values()
      .map(formatCourse)
      .map(s => "- " + s) // Add a bullet
      .map(indent)
      .forEach(s => lines.push(s));
  }
  return lines.join("\n");
}

const output = [
  `# ${degreeName}`,
  `_Generated using [CourseGraph](${packageJson.repository})_`,
  "", // Empty line
  printPlan(plan.taken),
  `\n----------\n`, // Separate taken from future
  printPlan(plan.future),
  `\n----------\n`, // Separate plan from missing
  `## Missing courses from plan`,
  ...plan.missing
    .values()
    .map(formatCourse)
    .map(s => indent("- " + s)),
].join("\n");
console.log(output);
