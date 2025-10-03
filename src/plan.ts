import { json } from "./input.ts";
function printPlan(all: Record<string, string[]>) {
  for (const [semester, courses] of Object.entries(all)) {
    console.log(`## ${semester}`);
    for (const course of courses) {
      console.log(`  - ${course}: ${json.courses[course]?.name}`);
    }
  }
}

printPlan(json.taken);
console.log(`\n----------\n`); // Separate taken from future
printPlan(json.future);
