"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Plus,
  User,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { StudentFormModal } from "@/components/modals/student-form-modal";
import { CourseFormModal } from "@/components/modals/course-form-modal";
import { ConfirmDeleteModal } from "@/components/modals/confirm-delete-modal";
import { ViewStudentCoursesModal } from "@/components/modals/view-student-courses-modal";
import { ViewCourseStudentsModal } from "@/components/modals/view-course-students-modal";
import { EnrollModal } from "@/components/modals/enroll-modal";
import { useDataRefresh } from "@/contexts/data-refresh-context";
import { useToast } from "@/contexts/toast-context";
import { apiDeleteCourse, apiDeleteStudent } from "@/lib/api/client";

type DeleteTarget =
  | { kind: "student"; id: string; label: string }
  | { kind: "course"; id: string; label: string };

type EduUi = {
  openStudentCreate: () => void;
  openStudentEdit: (id: string) => void;
  openCourseCreate: () => void;
  openCourseEdit: (id: string) => void;
  openEnrollStudent: (studentId: string, label: string) => void;
  openViewStudentCourses: (studentId: string, label: string) => void;
  openViewCourseStudents: (courseId: string, label: string) => void;
  openDelete: (target: DeleteTarget) => void;
};

const EduUiContext = createContext<EduUi | null>(null);

export function useEduUi() {
  const ctx = useContext(EduUiContext);
  if (!ctx) throw new Error("useEduUi must be used within EduAppFrame");
  return ctx;
}

const adminNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: Users },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/enrollments", label: "Enrollments", icon: GraduationCap },
];

const studentNav = [
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/students", label: "My Profile", icon: User },
  { href: "/enrollments", label: "My Enrollments", icon: GraduationCap },
];

export function EduAppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { bump } = useDataRefresh();
  const toast = useToast();
  const { isAdmin, isStudent, studentId, session, loading: authLoading } = useAuth();
  const nav = isAdmin ? adminNav : studentNav;

  const [studentFormOpen, setStudentFormOpen] = useState(false);
  const [studentEditingId, setStudentEditingId] = useState<string | null>(null);

  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [courseEditingId, setCourseEditingId] = useState<string | null>(null);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState<string | null>(null);
  const [enrollStudentLabel, setEnrollStudentLabel] = useState("");

  const [viewStudentCoursesOpen, setViewStudentCoursesOpen] = useState(false);
  const [viewStudentCoursesId, setViewStudentCoursesId] = useState<string | null>(null);
  const [viewStudentCoursesLabel, setViewStudentCoursesLabel] = useState("");

  const [viewCourseStudentsOpen, setViewCourseStudentsOpen] = useState(false);
  const [viewCourseStudentsId, setViewCourseStudentsId] = useState<string | null>(null);
  const [viewCourseStudentsLabel, setViewCourseStudentsLabel] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const title = useMemo(() => {
    if (pathname === "/" || pathname === "") return "Dashboard";
    if (pathname.startsWith("/students")) return isStudent ? "My Profile" : "Students";
    if (pathname.startsWith("/courses")) return "Courses";
    if (pathname.startsWith("/enrollments")) return isStudent ? "My Enrollments" : "Enrollments";
    return "EduEnroll";
  }, [pathname, isStudent]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      toast.push({ title: "Logout failed", variant: "error" });
    }
  }

  const ui = useMemo<EduUi>(
    () => ({
      openStudentCreate: () => {
        setStudentEditingId(null);
        setStudentFormOpen(true);
      },
      openStudentEdit: (id: string) => {
        setStudentEditingId(id);
        setStudentFormOpen(true);
      },
      openCourseCreate: () => {
        setCourseEditingId(null);
        setCourseFormOpen(true);
      },
      openCourseEdit: (id: string) => {
        setCourseEditingId(id);
        setCourseFormOpen(true);
      },
      openEnrollStudent: (studentId: string, label: string) => {
        setEnrollStudentId(studentId);
        setEnrollStudentLabel(label);
        setEnrollOpen(true);
      },
      openViewStudentCourses: (studentId: string, label: string) => {
        setViewStudentCoursesId(studentId);
        setViewStudentCoursesLabel(label);
        setViewStudentCoursesOpen(true);
      },
      openViewCourseStudents: (courseId: string, label: string) => {
        setViewCourseStudentsId(courseId);
        setViewCourseStudentsLabel(label);
        setViewCourseStudentsOpen(true);
      },
      openDelete: (target: DeleteTarget) => setDeleteTarget(target),
    }),
    []
  );

  const closeStudentForm = useCallback(() => setStudentFormOpen(false), []);
  const closeCourseForm = useCallback(() => setCourseFormOpen(false), []);
  const closeEnroll = useCallback(() => setEnrollOpen(false), []);
  const closeViewStudentCourses = useCallback(() => setViewStudentCoursesOpen(false), []);
  const closeViewCourseStudents = useCallback(() => setViewCourseStudentsOpen(false), []);
  const closeDelete = useCallback(() => setDeleteTarget(null), []);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      if (deleteTarget.kind === "student") {
        await apiDeleteStudent(deleteTarget.id);
        toast.push({ title: "Student deleted", variant: "success" });
      } else {
        await apiDeleteCourse(deleteTarget.id);
        toast.push({ title: "Course deleted", variant: "success" });
      }
      bump();
      closeDelete();
    } catch (e: unknown) {
      toast.push({
        title: "Delete failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "error",
      });
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <EduUiContext.Provider value={ui}>
      <div className="flex min-h-screen bg-[#f8f9fc] text-[#2d3748]">
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-[230px] flex-col border-r border-[#e2e8f0] bg-[#1a3a6b] text-white max-[899px]:w-[60px]">
          <div className="flex items-center gap-3 px-4 py-5 max-[899px]:justify-center max-[899px]:px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c9a227] text-[#1a3a6b]">
              <GraduationCap className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0 max-[899px]:hidden">
              <p className="text-sm font-semibold tracking-wide text-white">EduEnroll</p>
              <p className="text-xs text-blue-100/80">Course administration</p>
            </div>
          </div>

          <nav className="mt-2 flex flex-1 flex-col gap-1 px-2 pb-4">
            {!authLoading &&
              nav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/" || pathname === ""
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-white/10 text-[#c9a227]"
                      : "text-blue-100/90 hover:bg-white/5 hover:text-white"
                  } max-[899px]:justify-center max-[899px]:px-2`}
                  title={item.label}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  <span className="max-[899px]:hidden">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 px-2 py-3">
            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-blue-100/90 transition hover:bg-white/5 hover:text-white max-[899px]:justify-center max-[899px]:px-2"
              title="Sign out"
            >
              <LogOut className="h-5 w-5 shrink-0" aria-hidden />
              <span className="max-[899px]:hidden">Sign out</span>
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pl-[230px] max-[899px]:pl-[60px]">
          <header className="sticky top-0 z-30 border-b border-[#e2e8f0] bg-white/90 backdrop-blur">
            <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-[#1a3a6b]">{title}</h1>
                <p className="text-xs text-[#2d3748]/70">
                  {isStudent
                    ? "Browse courses and manage your enrollments"
                    : "Manage students, courses, and enrollments"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isAdmin ? (
                  <>
                    <button
                      type="button"
                      onClick={() => ui.openStudentCreate()}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#1e4d8c] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1a3a6b]"
                    >
                      <Plus className="h-4 w-4" />
                      Add Student
                    </button>
                    <button
                      type="button"
                      onClick={() => ui.openCourseCreate()}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#c9a227] bg-[#c9a227] px-3 py-2 text-sm font-semibold text-[#1a3a6b] hover:bg-[#b08f1f]"
                    >
                      <Plus className="h-4 w-4" />
                      Add Course
                    </button>
                  </>
                ) : null}
                {isStudent && studentId ? (
                  <button
                    type="button"
                    onClick={() => ui.openEnrollStudent(studentId, "Me")}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#1e4d8c] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1a3a6b]"
                  >
                    <Plus className="h-4 w-4" />
                    Enroll in Course
                  </button>
                ) : null}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>

      <StudentFormModal
        open={studentFormOpen}
        onClose={closeStudentForm}
        editingId={studentEditingId}
        onSaved={() => {
          bump();
          toast.push({ title: studentEditingId ? "Student updated" : "Student created", variant: "success" });
        }}
      />

      {isAdmin ? (
        <CourseFormModal
          open={courseFormOpen}
          onClose={closeCourseForm}
          editingId={courseEditingId}
          onSaved={() => {
            bump();
            toast.push({ title: courseEditingId ? "Course updated" : "Course created", variant: "success" });
          }}
        />
      ) : null}

      <EnrollModal
        open={enrollOpen}
        onClose={closeEnroll}
        studentId={enrollStudentId}
        studentLabel={enrollStudentLabel}
        onEnrolled={() => {
          bump();
          toast.push({ title: "Student enrolled", variant: "success" });
        }}
      />

      <ViewStudentCoursesModal
        open={viewStudentCoursesOpen}
        onClose={closeViewStudentCourses}
        studentId={viewStudentCoursesId}
        studentLabel={viewStudentCoursesLabel}
      />

      {isAdmin ? (
        <ViewCourseStudentsModal
          open={viewCourseStudentsOpen}
          onClose={closeViewCourseStudents}
          courseId={viewCourseStudentsId}
          courseLabel={viewCourseStudentsLabel}
        />
      ) : null}

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title={deleteTarget?.kind === "student" ? "Delete student?" : "Delete course?"}
        message={
          deleteTarget
            ? `This will permanently remove ${deleteTarget.label} and related enrollment records.`
            : ""
        }
        onClose={closeDelete}
        onConfirm={confirmDelete}
        busy={deleteBusy}
      />
    </EduUiContext.Provider>
  );
}
