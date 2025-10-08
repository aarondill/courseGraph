import { objectEntries } from "tsafe/objectEntries";
import type { CourseInput, CourseInputFT } from "./json.ts";
import json from "./json.ts";
import type { Course, CourseCode } from "./types.ts";
import { getAsserter, recursiveDependencies } from "./util.ts";

// A copy of the exact requirements for the FAST TRACK course (no deduplication)
const fastTrackBenchmarks = new Set(json["Fast Track"]["FAST TRACK"]?.reqs).add(
  "FAST TRACK"
);
// Passed from Object.entries()
const makeCourse = ([id, course]: [
  CourseCode,
  CourseInput | CourseInputFT,
]): Course => {
  const { name, reqs, coreqs } = course;
  const replacementFor = ("replaces" in course && course.replaces) || undefined;
  const isFastTrackBenchmark = fastTrackBenchmarks.has(id);
  return {
    id,
    name,
    reqs: new Set(reqs ?? []),
    coreqs: new Set(coreqs ?? []),
    replacementFor,
    isFastTrackBenchmark,
  };
};

/**
 * The list of all courses listed in the input file
 * This is a map from the course code to the course
 * Fast track replacement courses are merged in here
 * This list has an undefined order
 */
const courses = objectEntries(json.courses)
  .map(makeCourse)
  .reduce(
    (acc, course) => acc.set(course.id, course),
    new Map<string, Course>()
  );

// Fast Track
{
  const replacementCourses = new Set<Course>();
  for (const c of objectEntries(json["Fast Track"]).map(makeCourse)) {
    if (c.replacementFor) {
      replacementCourses.add(c);
      const old = courses.get(c.replacementFor);
      if (!old)
        throw new Error(`replaced course ${c.replacementFor} not found`);
      // TODO: Is this actually needed? are the requisites just the replacement?
      c.reqs = c.reqs.union(old.reqs); // Combine and deduplicate requirements
      c.coreqs = c.coreqs.union(old.coreqs);
      courses.delete(c.replacementFor);
    }
    courses.set(c.id, c); // merge in the fast track course
  }
  // Delay this in case one of the replacements depends on another.
  for (const c of replacementCourses) {
    // Replace all instances of id with the replacement
    for (const course of courses.values()) {
      if (!c.replacementFor)
        throw new Error("No replacementfor found! This is a bug");
      if (course.reqs.delete(c.replacementFor)) course.reqs.add(c.id);
      if (course.coreqs.delete(c.replacementFor)) course.coreqs.add(c.id);
    }
  }
}

const get = getAsserter(courses);
const deps = (c: Course) =>
  c.reqs
    .values()
    .map(get)
    .flatMap(c => [c, ...c.coreqs.values().map(get)]); // Dependancies are requisites and corequisites of subclasses (not our own coreqs!)
courses.forEach(course => {
  const allSubReqs = deps(course)
    .map(r => recursiveDependencies(r, deps))
    .reduce((acc, set) => acc.union(set), new Set<Course>());

  // Remove any prerequisites that are also in the recursive dependencies (We already need them anyways)
  course.reqs = recursiveDependencies(course, deps)
    .difference(allSubReqs)
    .values()
    .map(c => c.id)
    .reduce((acc, c) => acc.add(c), new Set<CourseCode>());
});
export default courses;
