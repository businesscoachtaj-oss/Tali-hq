-- 24 Nov 2026 audit fix (speed only, no change to who can see what).
-- The row rules on time_people and saved_quotes called auth.uid() once per row. Wrapping it in
-- a select lets Postgres work it out once per query, which the Supabase performance advisor
-- asks for (auth_rls_initplan). Same rule, same roles, same names.
-- Not applied yet: needs Taj's yes.

alter policy "time_people own rows" on public.time_people
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "saved_quotes own rows" on public.saved_quotes
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
