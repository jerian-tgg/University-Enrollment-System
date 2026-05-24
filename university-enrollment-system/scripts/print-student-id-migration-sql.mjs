/**
 * Prints SQL to run in Supabase Dashboard → SQL Editor when npm migrate cannot connect.
 *
 * Usage: npm run db:migrate:student-id:sql
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const files = [
  "supabase/migrations/20260524130000_student_middle_name.sql",
  "supabase/migrations/20260524150000_student_text_primary_key.sql",
];

console.log("Paste the following into Supabase Dashboard → SQL Editor → Run:\n");
console.log("-- ─── begin migration ───");

for (const file of files) {
  const sql = readFileSync(resolve(root, file), "utf8").trim();
  console.log(`\n-- ${file}\n${sql}\n`);
}

console.log("-- ─── end migration ───\n");
console.log("After it succeeds, add a student again and log in with e.g. 2026-3438-A / user");
