import type { EnrollmentStatus } from "@/lib/types/enrollment-status";
import { parseEnrollmentStatus } from "@/lib/types/enrollment-status";

export type StudentRow = {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
};

export type CourseRow = {
  id: string;
  course_code: string;
  title: string;
  description: string | null;
  capacity: number;
  units: number;
  created_at: string;
};

export type EnrollmentRow = {
  id: string;
  student_id: string;
  course_id: string;
  grade: string | number | null;
  status: string;
  enrolled_at: string;
};

export function enrollmentStatusOrThrow(raw: string): EnrollmentStatus {
  const s = parseEnrollmentStatus(raw);
  if (!s) throw new Error(`Invalid enrollment status: ${raw}`);
  return s;
}
