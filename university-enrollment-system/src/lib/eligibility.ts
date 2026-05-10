import type { ApiCourseListItem, ApiStudentCourse } from "@/lib/types/api";

export function isCourseAvailableForStudent(
  course: ApiCourseListItem,
  studentCourses: ApiStudentCourse[]
): boolean {
  if (course.enrolledCount >= course.capacity) {
    return false;
  }

  const byCourseId = new Map(studentCourses.map((sc) => [sc.courseId, sc]));
  const existing = byCourseId.get(course.id);
  if (existing?.status === "enrolled" || existing?.status === "completed") {
    return false;
  }

  if (course.prerequisiteId) {
    const prereq = byCourseId.get(course.prerequisiteId);
    if (!prereq || prereq.status !== "completed") {
      return false;
    }
    const g = prereq.grade ? Number(prereq.grade) : NaN;
    if (Number.isNaN(g) || g < 75) {
      return false;
    }
  }

  return true;
}
