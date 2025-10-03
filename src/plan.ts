import packageJson from "../package.json" with { type: "json" };
import { json } from "./input.ts";
function printPlan(all: Record<string, string[]>) {
  for (const [semester, courses] of Object.entries(all)) {
    console.log(`## ${semester}`);
    for (const course of courses) {
      console.log(`  - ${course}: ${json.courses[course]?.name}`);
    }
  }
}

console.log(`# ${json.degree}`);
console.log(`_Generated using [CourseGraph](${packageJson.repository})_`);
console.log(""); // Empty line
printPlan(json.taken);
console.log(`\n----------\n`); // Separate taken from future
printPlan(json.future);
