import fs from "node:fs/promises";
import { objectEntries } from "tsafe/objectEntries";

export type CourseCode = `${string} ${string}`;
export type Semester = `${string} ${number}` | "transfer"; // "Fall 2025"

export type Course = {
  /** The course code */
  id: CourseCode;
  /** The Human-readable name of the course */
  name: string;
  /** The prerequisites for this course */
  reqs: Set<CourseCode>;
  /** If this is a replacement for another course, the name of the course that it is replacing */
  replacementFor?: CourseCode;
  /** If this is a benchmark for the FAST TRACK course, also includes the FAST TRACK course itself */
  isFastTrackBenchmark: boolean;
};

type CourseInput = { name: string; reqs?: CourseCode[] };
type CourseInputFT = CourseInput & { replaces: CourseCode | null };
type JSONInput = {
  /** Degree name */
  degree: string;
  courses: Record<CourseCode, CourseInput>;
  taken: Record<Semester, CourseCode[]>;
  future: Record<Semester, CourseCode[]>;
  /** FAST TRACK course */
  "Fast Track"?: Record<CourseCode, CourseInputFT>;
};
// Comments are allowed in properties. Remove any keys that start with "//"
const filterComments = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj ?? {}).filter(([k]) => !k.startsWith("//"))
  ) as T;

const json = ((contents: string): Required<JSONInput> => {
  const parsed = JSON.parse(contents) as JSONInput;
  const degree = parsed.degree,
    courses = filterComments(parsed.courses),
    taken = filterComments(parsed.taken),
    future = filterComments(parsed.future),
    fastTrack = filterComments(parsed["Fast Track"] ?? {});
  return { degree, courses, taken, future, "Fast Track": fastTrack };
})(await fs.readFile("./courses.json", "utf8"));

export type Plan = {
  taken: Map<Semester, Set<CourseCode>>;
  future: Map<Semester, Set<CourseCode>>;
  courseToSemester: Map<CourseCode, Semester>;
};
const plan: Plan = {
  taken: objectEntries(json.taken).reduce(
    (acc, [semester, courses]) => acc.set(semester, new Set(courses)),
    new Map<Semester, Set<CourseCode>>()
  ),
  future: objectEntries(json.future).reduce(
    (acc, [semester, courses]) => acc.set(semester, new Set(courses)),
    new Map<Semester, Set<CourseCode>>()
  ),
  courseToSemester: objectEntries(json.taken).reduce(
    (acc, [semester, courses]) => {
      courses.forEach(course => acc.set(course, semester));
      return acc;
    },
    new Map<CourseCode, Semester>()
  ),
};
const degreeName = json.degree;

// A copy of the exact requirements for the FAST TRACK course (no deduplication)
const fastTrackBenchmarks = new Set(json["Fast Track"]["FAST TRACK"]?.reqs).add(
  "FAST TRACK"
);
// Passed from Object.entries()
const makeCourse = ([id, course]: [
  CourseCode,
  CourseInput | CourseInputFT,
]): Course => {
  const { name, reqs } = course;
  const replacementFor = ("replaces" in course && course.replaces) || undefined;
  const isFastTrackBenchmark = fastTrackBenchmarks.has(id);
  return {
    id,
    name,
    reqs: new Set(reqs ?? []),
    replacementFor,
    isFastTrackBenchmark,
  };
};

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
      if (!old) throw new Error(`course ${c.replacementFor} not found`);
      c.reqs = c.reqs.union(old.reqs); // Combine and deduplicate requirements
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
    }
  }
}

// Minimum dependency resolution
/** The recursive dependencies for a course */
const allDeps = new Map<CourseCode, Set<CourseCode>>();
// Return the recursive dependencies for a course, excluding the immediate prerequisites
function resolve(course: CourseCode): Set<CourseCode> {
  if (allDeps.has(course)) return allDeps.get(course)!;
  const courseInfo = courses.get(course);
  if (!courseInfo) throw new Error(`Course ${course} not found`);
  const subreqs = courseInfo.reqs
    .values()
    .map(resolve)
    .reduce((acc, set) => acc.union(set), new Set<CourseCode>());
  const res = subreqs.union(courseInfo.reqs);
  allDeps.set(course, res);
  return res;
}
courses.forEach(course => {
  const allSubReqs = course.reqs
    .values()
    .map(resolve)
    .reduce((acc, set) => acc.union(set), new Set<string>());
  const recursiveDeps = resolve(course.id);
  // Remove any prerequisites that are also in the recursive dependencies (We already need them anyways)
  course.reqs = recursiveDeps.difference(allSubReqs);
});

export { courses, degreeName, plan };
