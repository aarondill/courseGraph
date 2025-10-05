import fs from "node:fs/promises";
import type { CourseCode, Semester } from "./types.ts";

export type CourseInput = { name: string; reqs?: CourseCode[] };
export type CourseInputFT = CourseInput & { replaces: CourseCode | null };
export type SemesterCourseMapInput = Record<Semester, CourseCode[]>;
export type JSONInput = {
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

export default json;
