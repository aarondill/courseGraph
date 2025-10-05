import fs from "node:fs/promises";
import { objectEntries } from "tsafe/objectEntries";

export type CourseCode = `${string} ${string}`;
export type Semester = `${number} ${string}` | "Transfer"; // "2025 Fall"

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
type SemesterCourseMapInput = Record<Semester, CourseCode[]>;
type JSONInput = {
  /** Degree name */
  degree: string;
  courses: Record<CourseCode, CourseInput>;
  taken: SemesterCourseMapInput;
  future: SemesterCourseMapInput;
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

/**
 * The name of the degree from the input file
 */
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
  if (!courseInfo) throw new Error(`Prerequisite course ${course} not found`);
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

type SemesterCourseMap = Map<Semester, Set<CourseCode>>;
const SEMESTER_ORDER = ["Spring", "Summer", "Fall"];
const compareSemester = (a: Semester, b: Semester): number => {
  if (a == b) return 0;
  if (a == "Transfer" || b == "Transfer") return a == "Transfer" ? -1 : 1;
  const [ayear, asem] = a.split(" "),
    [byear, bsem] = b.split(" ");
  if (!asem || !ayear || !bsem || !byear)
    throw new Error(`Invalid semester ${a} or ${b}`);
  if (ayear != byear) return +ayear - +byear;
  const asemi = SEMESTER_ORDER.indexOf(asem),
    bsemi = SEMESTER_ORDER.indexOf(bsem);
  if (asemi == -1 || bsemi == -1)
    throw new Error(`Invalid semester ${a} or ${b}`);
  return asemi - bsemi;
};
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

export type Plan = {
  /**
   * The taken courses for each semester
   * The Map will be correctly ordered by semesters in temporal order
   * Each set of courses will be sorted lexicographically
   */
  taken: SemesterCourseMap;
  /**
   * The courses planned for the future for each semester
   * The Map will be correctly ordered by semesters in temporal order
   * Each set of courses will be sorted lexicographically
   */
  future: SemesterCourseMap;
  /**
   * The courses that are in the catalog of required courses, but not planned
   */
  missing: Set<CourseCode>;
  /**
   * A map from taken courses to the semester they are taken in
   * This is a fast lookup for the semester of a course, or whether it has been taken
   */
  courseToSemester: Map<CourseCode, Semester>;
};
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

export { courses, degreeName, plan };
