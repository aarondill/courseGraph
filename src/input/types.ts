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

export type Plan = {
  /**
   * The taken courses for each semester
   * The Map will be correctly ordered by semesters in temporal order
   * Each set of courses will be sorted lexicographically
   */
  taken: Map<Semester, Set<CourseCode>>;
  /**
   * The courses planned for the future for each semester
   * The Map will be correctly ordered by semesters in temporal order
   * Each set of courses will be sorted lexicographically
   */
  future: Map<Semester, Set<CourseCode>>;
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
