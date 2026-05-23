/** Incomplete — course not yet graded. */
export const GRADE_INC = "INC";

export type ParsedGrade =
  | { kind: "inc" }
  | { kind: "numeric"; normalized: number };

/** Apply GPA rules: 3.1 → 3.0 (pass); above 3.1 → 5.0 (fail). */
export function normalizeGpa(n: number): number {
  const rounded = Math.round(n * 10) / 10;
  if (rounded > 3.1) return 5.0;
  if (rounded >= 3.1) return 3.0;
  return rounded;
}

export function parseGradeInput(
  raw: string
): { ok: true; stored: string; parsed: ParsedGrade } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a grade" };
  }

  if (trimmed.toUpperCase() === GRADE_INC) {
    return { ok: true, stored: GRADE_INC, parsed: { kind: "inc" } };
  }

  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return { ok: false, error: "Grade must be 1.0–5.0 or INC" };
  }

  if (n < 1 || n > 5) {
    return { ok: false, error: "Grade must be between 1.0 and 5.0, or INC" };
  }

  const normalized = normalizeGpa(n);
  return {
    ok: true,
    stored: normalized.toFixed(1),
    parsed: { kind: "numeric", normalized },
  };
}

export function parseStoredGrade(value: string | number | null | undefined): ParsedGrade | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.toUpperCase() === GRADE_INC) {
    return { kind: "inc" };
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return { kind: "numeric", normalized: normalizeGpa(n) };
}

export function isPassingGrade(value: string | number | null | undefined): boolean {
  const parsed = parseStoredGrade(value);
  if (!parsed || parsed.kind === "inc") return false;
  return parsed.normalized <= 3.0;
}

export function isFailedGrade(value: string | number | null | undefined): boolean {
  const parsed = parseStoredGrade(value);
  if (!parsed || parsed.kind === "inc") return false;
  return parsed.normalized === 5.0;
}

export function isIncompleteGrade(value: string | number | null | undefined): boolean {
  return typeof value === "string" && value.toUpperCase() === GRADE_INC;
}

export function formatGradeDisplay(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.toUpperCase() === GRADE_INC) return GRADE_INC;
  const parsed = parseStoredGrade(value as string | number);
  if (!parsed) return null;
  if (parsed.kind === "inc") return GRADE_INC;
  return parsed.normalized.toFixed(1);
}

export function gradeDisplayClassName(value: unknown, base = "tabular-nums"): string {
  const display = formatGradeDisplay(value);
  if (display && isFailedGrade(display)) {
    return `${base} text-red-600 font-semibold`;
  }
  return base;
}
