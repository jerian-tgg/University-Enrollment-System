import {
  buildPrereqGraph,
  getTransitivePrerequisiteIds,
  studentSatisfiesPrerequisites,
  type PrereqGraph,
} from "@/lib/prerequisites";
import type { ApiCourseListItem, ApiStudentCourse } from "@/lib/types/api";

export function buildPrereqGraphFromCourses(courses: ApiCourseListItem[]): PrereqGraph {
  return buildPrereqGraph(
    courses.flatMap((c) =>
      c.prerequisiteIds.map((prerequisiteCourseId) => ({
        courseId: c.id,
        prerequisiteCourseId,
      }))
    )
  );
}

export function isCourseAvailableForStudent(
  course: ApiCourseListItem,
  studentCourses: ApiStudentCourse[],
  graph?: PrereqGraph
): boolean {
  if (course.enrolledCount >= course.capacity) {
    return false;
  }

  const byCourseId = new Map(studentCourses.map((sc) => [sc.courseId, sc]));
  const existing = byCourseId.get(course.id);
  if (existing?.status === "enrolled" || existing?.status === "completed") {
    return false;
  }

  const g = graph ?? buildPrereqGraphFromCourses([course]);
  const required = getTransitivePrerequisiteIds(course.id, g);

  return studentSatisfiesPrerequisites(required, studentCourses);
}
