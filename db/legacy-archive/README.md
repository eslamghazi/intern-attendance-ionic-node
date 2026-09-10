# Archived: the original 72 migrations

These are the Supabase-era migrations, kept for provenance only. They are **not
applied** — `npm run migrate` builds the schema from the models in
`src/db/schema` plus the SQL in `db/functions`.

They were retired only after `npm run verify:schema` reported the two builds
identical across every column, constraint, index, policy expression, function
body, trigger, grant and seed row.

Two things they record that the models cannot:

- `20260630000029a_attendance_status_left_work.sql` is **not** original. It was
  added because the history is incomplete: `attendance_status` never gained the
  `left_work` value any migration used, so the set could not rebuild the schema.
  Production must have had it added by hand.
- The three `20260901*` files fixed real defects found while porting — a member
  password reset that could never work, audit events missing from their enum,
  and a view that had lost `security_invoker` and was exposing every student's
  personal data to any signed-in member.
