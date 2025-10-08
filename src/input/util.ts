import { assert } from "tsafe/assert";
import type { Semester } from "./types.ts";

const SEMESTER_ORDER = ["Spring", "Summer", "Fall"];
export const compareSemester = (a: Semester, b: Semester): number => {
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

function recursiveDependenciesImpl<T>(
  val: T,
  dependancies: (t: T) => Iterable<T>,
  _cache: Map<T, Set<T>>
): Set<T> {
  if (_cache.has(val)) return _cache.get(val)!;
  const deps = new Set(dependancies(val));
  const subdeps = deps
    .values()
    .map(r => recursiveDependenciesImpl(r, dependancies, _cache))
    .reduce((acc, set) => acc.union(set), new Set<T>());
  const ret = subdeps.union(deps);
  _cache.set(val, ret);
  return ret;
}
// Return the recursive dependencies for a T, excluding the value itself
// dependancies is a function that takes a T and returns an iterable of T's (unique) dependencies
export function recursiveDependencies<T>(
  val: T,
  dependancies: (t: T) => Iterable<T>
): Set<T> {
  return recursiveDependenciesImpl(val, dependancies, new Map<T, Set<T>>());
}

// Suggested usage: const get = getAsserter(map); get(id);
export function getAsserter<K, V>(map: Map<K, V>): (id: K) => V {
  return (id: K) => {
    assert(map.has(id), `Key not found: ${id}`);
    return map.get(id)!;
  };
}
