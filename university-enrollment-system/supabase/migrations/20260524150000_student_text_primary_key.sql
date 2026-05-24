-- Use formatted student IDs (YYYY-NNNN-A|I) as the primary key / login id instead of UUID.
-- Safe to run more than once (Supabase Dashboard → SQL, or npm run db:migrate:student-id).

ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_student_id_fkey";

DO $$ BEGIN
  ALTER TABLE "enrollments" ALTER COLUMN "student_id" TYPE TEXT USING "student_id"::text;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "students" ALTER COLUMN "id" TYPE TEXT USING "id"::text;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Rows created while id was UUID but student_id was formatted: point enrollments at catalog id first.
UPDATE "enrollments" e
SET "student_id" = s."student_id"
FROM "students" s
WHERE e."student_id" = s."id"
  AND s."student_id" IS NOT NULL
  AND s."student_id" <> s."id";

UPDATE "students"
SET "id" = "student_id"
WHERE "student_id" IS NOT NULL
  AND "student_id" <> "id";

UPDATE "students"
SET "student_id" = "id"
WHERE "student_id" IS NULL OR "student_id" = '';

DO $$ BEGIN
  ALTER TABLE "enrollments"
    ADD CONSTRAINT "enrollments_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
