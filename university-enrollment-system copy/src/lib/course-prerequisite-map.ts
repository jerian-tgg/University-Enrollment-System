import type { PrereqGraph } from "@/lib/prerequisites";
import { getTransitivePrerequisiteIds } from "@/lib/prerequisites";
import type { CourseRow } from "@/lib/supabase/rows";
import { mapCourseListItem } from "@/lib/supabase/mappers";
import type { ApiCourseListItem } from "@/lib/types/api";

export function directPrerequisitesForCourse(courseId: string, graph: PrereqGraph): string[] {
  return graph.get(courseId) ?? [];
}

export function codesForIds(ids: string[], codeById: Map<string, string>): string[] {
  return ids.map((id) => codeById.get(id)).filter((c): c is string => Boolean(c));
}

export function mapCourseWithPrerequisites(
  row: CourseRow,
  graph: PrereqGraph,
  codeById: Map<string, string>,
  enrolledCount: number
): ApiCourseListItem {
  const directIds = directPrerequisitesForCourse(row.id, graph);
  const directCodes = codesForIds(directIds, codeById);
  const requiredIds = getTransitivePrerequisiteIds(row.id, graph);
  const requiredCodes = codesForIds(requiredIds, codeById);

  return mapCourseListItem(row, directIds, directCodes, requiredIds, requiredCodes, enrolledCount);
}
