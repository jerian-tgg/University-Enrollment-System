import type {
  ApiCourseListItem,
  ApiEnrollmentRow,
  ApiStats,
  ApiStudent,
  ApiStudentCourse,
  ApiCourseStudent,
} from "@/lib/types/api";

function errorMessageFromBody(data: unknown, res: Response): string {
  if (data && typeof data === "object" && data !== null && "error" in data) {
    const msg = String((data as { error: unknown }).error).trim();
    if (msg) return msg;
  }
  const statusText = res.statusText.trim();
  if (statusText) return statusText;
  return `Request failed (${res.status})`;
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      if (!res.ok) {
        throw new Error(text.trim().slice(0, 200) || `Request failed (${res.status})`);
      }
      throw new Error("Invalid JSON response from server");
    }
  }
  if (!res.ok) {
    throw new Error(errorMessageFromBody(data, res));
  }
  return data as T;
}

export async function apiGetStudents(): Promise<ApiStudent[]> {
  const res = await fetch("/api/students", { cache: "no-store" });
  return parseResponse<ApiStudent[]>(res);
}

export async function apiGetStudent(id: string): Promise<ApiStudent> {
  const res = await fetch(`/api/students/${id}`, { cache: "no-store" });
  return parseResponse<ApiStudent>(res);
}

export async function apiCreateStudent(body: {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
}): Promise<ApiStudent> {
  const res = await fetch("/api/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<ApiStudent>(res);
}

export async function apiUpdateStudent(
  id: string,
  body: Partial<{ studentId: string; firstName: string; middleName: string; lastName: string; email: string }>
): Promise<ApiStudent> {
  const res = await fetch(`/api/students/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<ApiStudent>(res);
}

export async function apiDeleteStudent(id: string): Promise<void> {
  const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
  await parseResponse<void>(res);
}

export async function apiGetStudentCourses(studentId: string): Promise<ApiStudentCourse[]> {
  const res = await fetch(`/api/students/${studentId}/courses`, { cache: "no-store" });
  return parseResponse<ApiStudentCourse[]>(res);
}

export async function apiGetCourses(): Promise<ApiCourseListItem[]> {
  const res = await fetch("/api/courses", { cache: "no-store" });
  return parseResponse<ApiCourseListItem[]>(res);
}

export async function apiGetCourse(id: string): Promise<ApiCourseListItem> {
  const res = await fetch(`/api/courses/${id}`, { cache: "no-store" });
  return parseResponse<ApiCourseListItem>(res);
}

export async function apiCreateCourse(body: {
  courseCode: string;
  title: string;
  description?: string | null;
  capacity: number;
  units: number;
  prerequisiteIds?: string[];
}): Promise<ApiCourseListItem> {
  const res = await fetch("/api/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<ApiCourseListItem>(res);
}

export async function apiUpdateCourse(
  id: string,
  body: Partial<{
    courseCode: string;
    title: string;
    description: string | null;
    capacity: number;
    units: number;
    prerequisiteIds: string[];
  }>
): Promise<ApiCourseListItem> {
  const res = await fetch(`/api/courses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<ApiCourseListItem>(res);
}

export async function apiDeleteCourse(id: string): Promise<void> {
  const res = await fetch(`/api/courses/${id}`, { method: "DELETE" });
  await parseResponse<void>(res);
}

export async function apiGetCourseStudents(courseId: string): Promise<ApiCourseStudent[]> {
  const res = await fetch(`/api/courses/${courseId}/students`, { cache: "no-store" });
  return parseResponse<ApiCourseStudent[]>(res);
}

export async function apiEnroll(body: { studentId: string; courseId: string }): Promise<unknown> {
  const res = await fetch("/api/enroll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<unknown>(res);
}

export async function apiDropEnrollment(body: { studentId: string; courseId: string }): Promise<void> {
  const res = await fetch("/api/enroll", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await parseResponse<void>(res);
}

export async function apiGetEnrollments(): Promise<ApiEnrollmentRow[]> {
  const res = await fetch("/api/enrollments", { cache: "no-store" });
  const rows = await parseResponse<
    {
      id: string;
      studentId: string;
      studentCatalogId: string;
      studentName: string;
      studentEmail: string;
      courseId: string;
      courseCode: string;
      courseTitle: string;
      status: ApiEnrollmentRow["status"];
      grade: string | null;
      enrolledAt: string;
    }[]
  >(res);
  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    studentCatalogId: r.studentCatalogId,
    studentName: r.studentName,
    studentEmail: r.studentEmail,
    courseId: r.courseId,
    courseCode: r.courseCode,
    courseTitle: r.courseTitle,
    status: r.status,
    grade: r.grade,
    enrolledAt: r.enrolledAt,
  }));
}

export async function apiUpdateGrade(enrollmentId: string, grade: string): Promise<ApiEnrollmentRow> {
  const res = await fetch(`/api/enrollments/${enrollmentId}/grade`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grade }),
  });
  const row = await parseResponse<{
    id: string;
    studentId: string;
    studentCatalogId: string;
    studentName: string;
    studentEmail: string;
    courseId: string;
    courseCode: string;
    courseTitle: string;
    status: ApiEnrollmentRow["status"];
    grade: string | null;
    enrolledAt: string;
  }>(res);
  return {
    id: row.id,
    studentId: row.studentId,
    studentCatalogId: row.studentCatalogId,
    studentName: row.studentName,
    studentEmail: row.studentEmail,
    courseId: row.courseId,
    courseCode: row.courseCode,
    courseTitle: row.courseTitle,
    status: row.status,
    grade: row.grade,
    enrolledAt: row.enrolledAt,
  };
}

export async function apiGetStats(): Promise<ApiStats> {
  const res = await fetch("/api/stats", { cache: "no-store" });
  return parseResponse<ApiStats>(res);
}
