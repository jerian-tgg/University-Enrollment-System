import type { SupabaseClient } from "@supabase/supabase-js";
import { isPassingGrade } from "@/lib/grades";
import type { ApiStudentCourse } from "@/lib/types/api";
import { isPostgrestError } from "@/lib/supabase/errors";

export type PrereqEdge = { courseId: string; prerequisiteCourseId: string };

/** courseId → direct prerequisite course ids */
export type PrereqGraph = Map<string, string[]>;

export function buildPrereqGraph(edges: PrereqEdge[]): PrereqGraph {
  const graph: PrereqGraph = new Map();
  for (const { courseId, prerequisiteCourseId } of edges) {
    const list = graph.get(courseId) ?? [];
    if (!list.includes(prerequisiteCourseId)) list.push(prerequisiteCourseId);
    graph.set(courseId, list);
  }
  return graph;
}

export function graphWithCoursePrerequisites(
  graph: PrereqGraph,
  courseId: string,
  prerequisiteIds: string[]
): PrereqGraph {
  const next = new Map(graph);
  next.set(courseId, [...prerequisiteIds]);
  return next;
}

/** All prerequisites required before enrolling (direct + transitive). */
export function getTransitivePrerequisiteIds(courseId: string, graph: PrereqGraph): string[] {
  const seen = new Set<string>();
  const stack = [...(graph.get(courseId) ?? [])];

  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of graph.get(id) ?? []) {
      if (!seen.has(next)) stack.push(next);
    }
  }

  return [...seen];
}

/** True if adding these prereqs to courseId would create a cycle. */
export function wouldCreatePrerequisiteCycle(
  graph: PrereqGraph,
  courseId: string,
  prerequisiteIds: string[]
): boolean {
  const trial = graphWithCoursePrerequisites(graph, courseId, prerequisiteIds);

  for (const prereqId of prerequisiteIds) {
    if (prereqId === courseId) return true;
    const required = getTransitivePrerequisiteIds(prereqId, trial);
    if (required.includes(courseId)) return true;
  }

  return false;
}

export function validatePrerequisiteSelection(
  courseId: string,
  prerequisiteIds: string[],
  graph: PrereqGraph,
  validCourseIds: Set<string>
): string | null {
  const unique = [...new Set(prerequisiteIds)];

  for (const id of unique) {
    if (!validCourseIds.has(id)) {
      return "One or more prerequisite courses were not found";
    }
    if (id === courseId) {
      return "A course cannot be its own prerequisite";
    }
  }

  if (wouldCreatePrerequisiteCycle(graph, courseId, unique)) {
    return "Prerequisite selection would create a circular dependency";
  }

  return null;
}

export function studentSatisfiesPrerequisites(
  requiredCourseIds: string[],
  studentCourses: ApiStudentCourse[]
): boolean {
  if (requiredCourseIds.length === 0) return true;

  const byCourseId = new Map(studentCourses.map((sc) => [sc.courseId, sc]));

  for (const reqId of requiredCourseIds) {
    const row = byCourseId.get(reqId);
    if (!row || row.status !== "completed") return false;
    if (!isPassingGrade(row.grade)) return false;
  }

  return true;
}

export async function usesCoursePrerequisitesTable(sb: SupabaseClient): Promise<boolean> {
  const { error } = await sb.from("course_prerequisites").select("course_id").limit(1);
  if (!error) return true;
  if (isPostgrestError(error) && (error.code === "42P01" || error.code === "PGRST205")) {
    return false;
  }
  return false;
}

export async function loadPrerequisiteEdges(sb: SupabaseClient): Promise<PrereqEdge[]> {
  if (await usesCoursePrerequisitesTable(sb)) {
    const { data, error } = await sb
      .from("course_prerequisites")
      .select("course_id, prerequisite_course_id");
    if (error) throw error;
    return (data ?? []).map((r) => ({
      courseId: r.course_id as string,
      prerequisiteCourseId: r.prerequisite_course_id as string,
    }));
  }

  const { data, error } = await sb.from("courses").select("id, prerequisite_id");
  if (error) throw error;

  const edges: PrereqEdge[] = [];
  for (const row of data ?? []) {
    const prereqId = (row as { prerequisite_id?: string | null }).prerequisite_id;
    if (prereqId) {
      edges.push({ courseId: row.id as string, prerequisiteCourseId: prereqId });
    }
  }
  return edges;
}

export async function loadPrerequisiteGraph(sb: SupabaseClient): Promise<PrereqGraph> {
  return buildPrereqGraph(await loadPrerequisiteEdges(sb));
}

export async function getDirectPrerequisiteIds(
  sb: SupabaseClient,
  courseId: string
): Promise<string[]> {
  if (await usesCoursePrerequisitesTable(sb)) {
    const { data, error } = await sb
      .from("course_prerequisites")
      .select("prerequisite_course_id")
      .eq("course_id", courseId);
    if (error) throw error;
    return (data ?? []).map((r) => r.prerequisite_course_id as string);
  }

  const { data, error } = await sb
    .from("courses")
    .select("prerequisite_id")
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw error;
  const prereqId = (data as { prerequisite_id?: string | null } | null)?.prerequisite_id;
  return prereqId ? [prereqId] : [];
}

export async function setCoursePrerequisites(
  sb: SupabaseClient,
  courseId: string,
  prerequisiteIds: string[]
): Promise<void> {
  const unique = [...new Set(prerequisiteIds)];

  if (await usesCoursePrerequisitesTable(sb)) {
    const { error: delErr } = await sb.from("course_prerequisites").delete().eq("course_id", courseId);
    if (delErr) throw delErr;

    if (unique.length === 0) return;

    const { error: insErr } = await sb.from("course_prerequisites").insert(
      unique.map((prerequisiteCourseId) => ({
        course_id: courseId,
        prerequisite_course_id: prerequisiteCourseId,
      }))
    );
    if (insErr) throw insErr;
    return;
  }

  const { error } = await sb
    .from("courses")
    .update({ prerequisite_id: unique[0] ?? null })
    .eq("id", courseId);
  if (error) throw error;

  if (unique.length > 1) {
    throw new Error(
      "Multiple prerequisites require migration 20260524120000_course_prerequisites.sql"
    );
  }
}

export async function assertStudentMeetsCoursePrerequisites(
  sb: SupabaseClient,
  studentId: string,
  courseId: string
): Promise<void> {
  const graph = await loadPrerequisiteGraph(sb);
  const required = getTransitivePrerequisiteIds(courseId, graph);

  for (const prereqCourseId of required) {
    const { data: enroll, error } = await sb
      .from("enrollments")
      .select("grade, status")
      .eq("student_id", studentId)
      .eq("course_id", prereqCourseId)
      .eq("status", "completed")
      .maybeSingle();

    if (error) throw error;
    if (!enroll || !isPassingGrade(enroll.grade as string | number | null)) {
      throw new PrerequisiteNotMetError(prereqCourseId);
    }
  }
}

export class PrerequisiteNotMetError extends Error {
  constructor(public prerequisiteCourseId: string) {
    super("Prerequisite requirements not met");
    this.name = "PrerequisiteNotMetError";
  }
}
