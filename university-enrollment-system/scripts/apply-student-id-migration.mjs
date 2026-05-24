/**
 * Applies supabase/migrations/20260524150000_student_text_primary_key.sql
 *
 * Requires in .env.local (or env) either:
 *   SUPABASE_DB_URL — full Postgres URI from Supabase Dashboard → Database
 * or:
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD
 *
 * Usage: npm run db:migrate:student-id
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

function hasPlaceholder(value) {
  return /\[.*\]/.test(value);
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const password = process.env.SUPABASE_DB_PASSWORD ?? "";
const refMatch = url.match(/https:\/\/([^.]+)\.supabase\.co/);
const ref = refMatch?.[1];

let connectionString = process.env.SUPABASE_DB_URL ?? "";

if (!connectionString || hasPlaceholder(connectionString)) {
  if (!ref || !password) {
    console.error(
      "Database connection not configured.\n\n" +
        "Option A — set SUPABASE_DB_URL in .env.local to the full URI from:\n" +
        "  Supabase Dashboard → Project Settings → Database → Connection string → URI\n\n" +
        "Option B — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD\n" +
        "  (password: Dashboard → Database → Database password)\n\n" +
        "Do not leave template placeholders like [ref] or [host] in SUPABASE_DB_URL."
    );
    process.exit(1);
  }

  connectionString =
    `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
}

const sql = readFileSync(
  resolve(root, "supabase/migrations/20260524150000_student_text_primary_key.sql"),
  "utf8"
);

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log("Student ID migration applied successfully (students.id is now TEXT).");
} catch (e) {
  console.error("Migration failed:", e.message);
  console.error(
    "\nTips:\n" +
      "  • Use the direct URI (port 5432, host db.<ref>.supabase.co) from the Supabase dashboard.\n" +
      "  • If using the pooler URI, set SUPABASE_DB_URL to the exact string from the dashboard.\n" +
      "  • Reset the database password if you are unsure of the current value."
  );
  process.exit(1);
} finally {
  await client.end();
}
