import type { ApiCourseListItem, ApiStudent } from "@/lib/types/api";
import type { CourseRow, StudentRow } from "@/lib/supabase/rows";

export function mapStudent(row: StudentRow): ApiStudent {
  return {
    id: row.id,
    studentId: row.student_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    createdAt: row.created_at,
  };
}

export function mapCourseListItem(
  row: CourseRow,
  prerequisiteIds: string[],
  prerequisiteCodes: string[],
  requiredPrerequisiteIds: string[],
  requiredPrerequisiteCodes: string[],
  enrolledCount: number
): ApiCourseListItem {
  return {
    id: row.id,
    courseCode: row.course_code,
    title: row.title,
    description: row.description,
    capacity: row.capacity,
    units: row.units,
    prerequisiteIds,
    prerequisiteCodes,
    requiredPrerequisiteIds,
    requiredPrerequisiteCodes,
    enrolledCount,
    createdAt: row.created_at,
  };
}
