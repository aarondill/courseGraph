import { objectEntries } from "tsafe/objectEntries";
import courses from "./courses.ts";
import json from "./json.ts";
import type { CourseCode, Plan, Semester } from "./types.ts";
import { compareSemester } from "./util.ts";

const taken = objectEntries(json.taken)
    .sort(([a], [b]) => compareSemester(a, b))
    .reduce(
      (acc, [semester, courses]) => acc.set(semester, new Set(courses.sort())),
      new Map<Semester, Set<CourseCode>>()
    ),
  future = objectEntries(json.future)
    .sort(([a], [b]) => compareSemester(a, b))
    .reduce(
      (acc, [semester, courses]) => acc.set(semester, new Set(courses.sort())),
      new Map<Semester, Set<CourseCode>>()
    );

// Warn about missing courses
const plannedCourses = [taken, future]
  .values()
  .flatMap(i => i.values())
  .flatMap(s => s)
  .reduce((acc, c) => acc.add(c), new Set<CourseCode>());

const all = new Set(courses.values().map(c => c.id));

const missing = all.difference(plannedCourses);
if (missing.size > 0) {
  console.warn(`The following courses are in the catalog, but not planned:`);
  for (const c of missing) console.warn(`  ${c} - ${courses.get(c)?.name}`);
  console.warn(``);
}
const extra = plannedCourses.difference(all);
if (extra.size > 0) {
  console.warn(`The following courses are planned, but not in the catalog:`);
  for (const c of extra) console.warn(`  ${c}`);
  console.warn(``);
}

/** The plan for the degree from the input file */
const plan: Plan = {
  taken,
  future,
  missing,
  courseToSemester: objectEntries(json.taken).reduce(
    (acc, [semester, courses]) => {
      courses.forEach(course => acc.set(course, semester));
      return acc;
    },
    new Map<CourseCode, Semester>()
  ),
};

export default plan;
