import json from "./json.ts";

/**
 * The name of the degree from the input file
 */
export const degreeName = json.degree;

export { default as courses } from "./courses.ts";
export { default as plan } from "./plan.ts";
export type { Course, CourseCode, Plan, Semester } from "./types.ts";
