import packageJson from "../package.json" with { type: "json" };
import type { CourseCode, Semester } from "./input/index.ts";
import { courses, degreeName, plan } from "./input/index.ts";

// Used to track pre-requisites
const coursesCurrentSemester = new Set<CourseCode>();
const takenCourses = new Set<CourseCode>();

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

    const missingreqs = course.reqs.difference(takenCourses);
    if (missingreqs.size > 0) {
      // The user needs to re-order their courses to avoid this
      const warning = `⚠️WARNING⚠️: missing prereqs: ${[...missingreqs].join(", ")}`;
      output += ` (${warning})`;
      console.error(`${id}: ${warning}`);
    }
    const missingco = course.coreqs
      .difference(takenCourses)
      .difference(coursesCurrentSemester); // missing = coreqs - taken - current
    if (missingco.size > 0) {
      // The user needs to re-order their courses to avoid this
      const warning = `⚠️WARNING⚠️: missing coreqs: ${[...missingco].join(", ")}`;
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
    lines.push(`## ${semester}`);

    for (const c of totake) coursesCurrentSemester.add(c);
    totake
      .values()
      .map(formatCourse)
      .map(s => indent("- " + s)) // Add a bullet
      .forEach(s => lines.push(s));
    for (const c of coursesCurrentSemester) takenCourses.add(c); // we've taken them all after the semester
    coursesCurrentSemester.clear();
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
