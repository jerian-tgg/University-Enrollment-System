-- Support INC and string GPA values (e.g. 1.0, 5.0).
ALTER TABLE "enrollments" ALTER COLUMN "grade" TYPE TEXT USING (
  CASE
    WHEN "grade" IS NULL THEN NULL
    ELSE trim(to_char("grade", 'FM999990.00'))
  END
);
