// Applies the Supabase migrations to an in-memory Postgres (PGlite) with a
// minimal stand-in for Supabase's auth schema, then runs a few smoke checks.
// Usage: node scripts/check-migrations.mjs
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readdirSync, readFileSync } from "node:fs";

const db = new PGlite({ extensions: { btree_gist } });

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated; create role anon;
`);

const dir = "supabase/migrations";
for (const file of readdirSync(dir).sort()) {
  await db.exec(readFileSync(`${dir}/${file}`, "utf8"));
  console.log(`applied ${file}`);
}

const one = async (sql, params) => (await db.query(sql, params)).rows[0];

const inst = await one(
  `insert into auth.users (email, raw_user_meta_data) values ('i@example.com', '{"role":"instructor","full_name":"Jane Smith"}') returning id`,
);
const { slug } = await one(`select slug from public.instructors where id = $1`, [inst.id]);
console.log("instructor slug:", slug);

const stu = await one(
  `insert into auth.users (email, raw_user_meta_data) values ('s@example.com', $1) returning id`,
  [JSON.stringify({ role: "student", full_name: "Sam", join_slug: slug })],
);
const linked = await one(`select public.is_student_of($1, $2) as ok`, [inst.id, stu.id]);
if (!linked.ok) throw new Error("student was not linked to instructor");

const book = (start, end) =>
  db.query(
    `insert into public.bookings (instructor_id, student_id, starts_at, ends_at, price_pence, payment_method, terms_version, terms_accepted_at)
     values ($1, $2, $3, $4, 4000, 'cash', 0, now()) returning id`,
    [inst.id, stu.id, start, end],
  );
const first = (await book("2030-01-07T10:00Z", "2030-01-07T11:00Z")).rows[0];
let refused = false;
try {
  await book("2030-01-07T10:30Z", "2030-01-07T11:30Z");
} catch {
  refused = true;
}
if (!refused) throw new Error("overlapping booking was accepted");
await db.query(`update public.bookings set status = 'cancelled' where id = $1`, [first.id]);
await book("2030-01-07T10:30Z", "2030-01-07T11:30Z");

let roleLocked = false;
try {
  await db.query(`update public.profiles set role = 'instructor' where id = $1`, [stu.id]);
} catch {
  roleLocked = true;
}
if (!roleLocked) throw new Error("role change was allowed");

console.log("migration checks passed");
