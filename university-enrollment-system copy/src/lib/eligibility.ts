import { isPassingGrade } from "@/lib/grades";
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
    if (!isPassingGrade(prereq.grade)) {
      return false;
    }
  }

  return true;
}
