import fs from "node:fs/promises";
import { assert } from "tsafe";
import yaml from "yaml";
import type { CourseCode, Semester } from "./types.ts";

// If a string, its the name
export type CourseInput =
  | string
  | {
      name: string;
      reqs?: CourseCode[];
      coreqs?: CourseCode[];
    };
export type CourseInputFT = Exclude<CourseInput, string> & {
  replaces: CourseCode | null;
};
export type SemesterCourseMapInput = { [k in Semester]?: CourseCode[] };
export type JSONInput = {
  /** Degree name */
  degree: string;
  courses: Record<CourseCode, CourseInput>;
  taken?: SemesterCourseMapInput;
  future?: SemesterCourseMapInput;
  /** FAST TRACK course */
  "Fast Track"?: Record<CourseCode, CourseInputFT>;
};
// NOTE: doesn't deeply check the input, only checks the top level
function assertJSONInput(v: unknown): asserts v is JSONInput {
  assert(v && typeof v === "object", "courses file must be an object");
  assert("degree" in v, "degree must be present");
  assert(typeof v.degree === "string", "degree must be a string");
  assert("courses" in v, "courses must be present");
  assert(typeof v.courses === "object", "courses must be an object");
  if ("taken" in v)
    assert(typeof v.taken === "object", "taken must be an object");
  if ("future" in v)
    assert(typeof v.future === "object", "future must be an object");
  if ("Fast Track" in v)
    assert(typeof v["Fast Track"] === "object", "Fast Track must be an object");
}

export const COURSES_FILE_PATH = Object.freeze([
  "courses.yaml",
  "courses.yml",
  "courses.json",
]);
const coursesFile = await Promise.allSettled(
  COURSES_FILE_PATH.map(path =>
    fs.access(path, fs.constants.R_OK).then(() => path)
  )
).then(results => results.find(result => result.status === "fulfilled")?.value);
assert(coursesFile, "Could not find a courses file!");

const contents = await fs.readFile(coursesFile, "utf8");
const json = ((): Required<JSONInput> => {
  const parsed: unknown =
    coursesFile.endsWith(".yaml") || coursesFile.endsWith(".yml")
      ? yaml.parse(contents)
      : JSON.parse(contents);
  assertJSONInput(parsed);
  // Create a (mostly) type-safe version of the input
  return {
    degree: parsed.degree,
    courses: parsed.courses,
    taken: parsed.taken ?? {},
    future: parsed.future ?? {},
    "Fast Track": parsed["Fast Track"] ?? {},
  };
})();

export default json;
