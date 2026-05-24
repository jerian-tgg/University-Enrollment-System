-- Optional middle name on students (safe to re-run).

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "middle_name" TEXT;
