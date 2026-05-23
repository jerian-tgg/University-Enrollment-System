-- Multiple prerequisites per course (replaces single courses.prerequisite_id).
-- Uses UUID to match legacy Supabase courses.id (see align migration).

DROP TABLE IF EXISTS "course_prerequisites";

CREATE TABLE "course_prerequisites" (
    "course_id" UUID NOT NULL,
    "prerequisite_course_id" UUID NOT NULL,
    CONSTRAINT "course_prerequisites_pkey" PRIMARY KEY ("course_id", "prerequisite_course_id"),
    CONSTRAINT "course_prerequisites_course_id_fkey"
        FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "course_prerequisites_prerequisite_course_id_fkey"
        FOREIGN KEY ("prerequisite_course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "course_prerequisites_no_self" CHECK ("course_id" <> "prerequisite_course_id")
);

INSERT INTO "course_prerequisites" ("course_id", "prerequisite_course_id")
SELECT "id", "prerequisite_id"::uuid
FROM "courses"
WHERE "prerequisite_id" IS NOT NULL
  AND trim("prerequisite_id") <> ''
  AND "prerequisite_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ON CONFLICT DO NOTHING;

ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_prerequisite_id_fkey";
ALTER TABLE "courses" DROP COLUMN IF EXISTS "prerequisite_id";
