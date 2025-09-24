import fs from "node:fs/promises";
export type Course = { name: string; reqs?: string[] };
type CourseInfo = {
  degree: string; // Degree name
  courses: Record<string, Course>; // course code -> {course name, prerequisite codes}
  taken: Record<string, string[]>; // semester -> course code[]
  "Fast Track"?: Record<string, Course & { replaces: string | null }>; // FAST TRACK course
};
// Comments are allowed in the properties of "courses". Remove any keys that start with "//"
const filterComments = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).filter(([k]) => !k.startsWith("//"))
  ) as T;
const json = JSON.parse(
  await fs.readFile("./courses.json", "utf8")
) as CourseInfo;
json.courses = filterComments(json.courses);
json.taken = filterComments(json.taken);
json["Fast Track"] = filterComments(json["Fast Track"] ?? {});

/** The requirements for the FAST TRACK course, exported because they are modified */
const fastTrackBenchmarks = json["Fast Track"]["FAST TRACK"]?.reqs?.slice();
{
  // Fast Track
  for (const [id, v] of Object.entries(json["Fast Track"] ?? {})) {
    json.courses[id] = v; // merge in the fast track course
    if (!v.replaces) continue;
    const replaced = json.courses[v.replaces];
    if (!replaced) throw new Error(`FAST TRACK course ${v.replaces} not found`);
    v.reqs = [...new Set([...(v.reqs ?? []), ...(replaced.reqs ?? [])])]; // Combine and deduplicate requirements
    for (const course of Object.values(json.courses)) {
      // Replace all instances of the course that is being replaced with the new course
      course.reqs = course.reqs?.map(req => (req == v.replaces ? id : req));
    }
    delete json.courses[v.replaces];
  }
  delete json["Fast Track"];
}

const courseToSemester = Object.entries(json.taken).reduce(
  (acc, [semester, courses]) => {
    courses.forEach(course => acc.set(course, semester));
    return acc;
  },
  new Map<string, string>()
);

// Minimum dependency resolution
/** The recursive dependencies for a course */
const allDeps = new Map<string, Set<string>>();
// Return the recursive dependencies for a course, excluding the immediate prerequisites
function resolve(course: string): Set<string> {
  if (allDeps.has(course)) return allDeps.get(course)!;
  const courseInfo = json.courses[course];
  if (!courseInfo) throw new Error(`Course ${course} not found`);
  const subreqs = (courseInfo.reqs ?? [])
    .map(resolve)
    .reduce((acc, set) => acc.union(set), new Set<string>());
  const prereqs = new Set(courseInfo.reqs);
  const res = subreqs.union(prereqs);
  allDeps.set(course, res);
  return res;
}
Object.entries(json.courses).forEach(([id, course]) => {
  const allSubReqs = (course.reqs ?? [])
    .map(resolve)
    .reduce((acc, set) => acc.union(set), new Set<string>());
  const recursiveDeps = resolve(id);
  // Remove any prerequisites that are also in the recursive dependencies (We already need them anyways)
  course.reqs = [...recursiveDeps.difference(allSubReqs)];
});

export { courseToSemester, fastTrackBenchmarks as fastTrackRequirements, json };
