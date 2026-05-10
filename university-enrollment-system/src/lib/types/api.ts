import type { EnrollmentStatus } from "@/lib/types/enrollment-status";

export type ApiStudent = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
};

export type ApiCourseListItem = {
  id: string;
  courseCode: string;
  title: string;
  description: string | null;
  capacity: number;
  units: number;
  prerequisiteId: string | null;
  prerequisiteCode: string | null;
  enrolledCount: number;
  createdAt: string;
};

export type ApiEnrollmentRow = {
  id: string;
  studentId: string;
  studentCatalogId: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  status: EnrollmentStatus;
  grade: string | null;
  enrolledAt: string;
};

export type ApiStats = {
  totalStudents: number;
  totalCourses: number;
  activeEnrollments: number;
  completed: number;
};

export type ApiStudentCourse = {
  courseId: string;
  courseCode: string;
  title: string;
  units: number;
  status: EnrollmentStatus;
  grade: string | null;
  enrolledAt: string;
};

export type ApiCourseStudent = {
  enrollmentId: string;
  studentId: string;
  studentCatalogId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: EnrollmentStatus;
  grade: string | null;
};
