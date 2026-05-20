-- Align legacy Supabase tables with the EduEnroll app schema.
-- Safe to run more than once (Supabase Dashboard → SQL, or npm run db:migrate).

-- Students: name → first_name / last_name, add student_id
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "student_id" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "first_name" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "last_name" TEXT;

UPDATE "students"
SET
  "first_name" = COALESCE("first_name", NULLIF(split_part("name", ' ', 1), '')),
  "last_name" = COALESCE(
    NULLIF("last_name", ''),
    NULLIF(trim(substring("name" from length(split_part("name", ' ', 1)) + 1)), ''),
    '—'
  ),
  "student_id" = COALESCE("student_id", "id")
WHERE "name" IS NOT NULL;

-- Courses: code → course_code, defaults for optional fields
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "course_code" TEXT;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "units" INTEGER;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "prerequisite_id" TEXT;

UPDATE "courses"
SET
  "course_code" = COALESCE("course_code", "code"),
  "units" = COALESCE("units", 3)
WHERE "code" IS NOT NULL OR "course_code" IS NOT NULL;

ALTER TABLE "courses" ALTER COLUMN "units" SET DEFAULT 3;

DO $$ BEGIN
  ALTER TABLE "courses" ALTER COLUMN "units" SET NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Enrollments: status, grade, enrolled_at

DO $$ BEGIN
  CREATE TYPE "EnrollmentStatus" AS ENUM ('enrolled', 'dropped', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "grade" DECIMAL(5, 2);

ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "status" "EnrollmentStatus";

UPDATE "enrollments"
SET "status" = 'enrolled'
WHERE "status" IS NULL;

ALTER TABLE "enrollments"
  ALTER COLUMN "status" SET DEFAULT 'enrolled';

DO $$ BEGIN
  ALTER TABLE "enrollments" ALTER COLUMN "status" SET NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "enrolled_at" TIMESTAMP(3);

UPDATE "enrollments"
SET "enrolled_at" = COALESCE("enrolled_at", "created_at", CURRENT_TIMESTAMP)
WHERE "enrolled_at" IS NULL;

ALTER TABLE "enrollments"
  ALTER COLUMN "enrolled_at" SET DEFAULT CURRENT_TIMESTAMP;

DO $$ BEGIN
  ALTER TABLE "enrollments" ALTER COLUMN "enrolled_at" SET NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "enrollments"
    ADD CONSTRAINT "enrollments_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "enrollments"
    ADD CONSTRAINT "enrollments_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
