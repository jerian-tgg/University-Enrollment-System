/**
 * Changes enrollments.grade from DECIMAL to TEXT so values like "INC" work.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_DB_PASSWORD — Supabase Dashboard → Settings → Database
 *
 * Usage: npm run db:migrate:grade
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  try {
    const text = readFileSync(resolve(root, ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const password = process.env.SUPABASE_DB_PASSWORD ?? "";
const refMatch = url.match(/https:\/\/([^.]+)\.supabase\.co/);
const ref = refMatch?.[1];

if (!ref || !password) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local, then re-run.\n" +
      "Password: Supabase Dashboard → Project Settings → Database → Database password"
  );
  process.exit(1);
}

const connectionString =
  process.env.SUPABASE_DB_URL ??
  `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

const sql = readFileSync(
  resolve(root, "supabase/migrations/20260523120000_grade_text.sql"),
  "utf8"
);

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log("Grade column migration applied (enrollments.grade is now TEXT). INC is supported.");
} catch (e) {
  console.error("Migration failed:", e.message);
  console.error(
    "\nYou can also run this SQL manually in Supabase → SQL Editor:\n\n" + sql
  );
  console.error(
    "\nIf the pooler region differs, set SUPABASE_DB_URL to the full URI from the Supabase dashboard."
  );
  process.exit(1);
} finally {
  await client.end();
}
