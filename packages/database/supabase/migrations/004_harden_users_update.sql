-- Harden users_update_own + pin trigger search_path.
-- A signed-in user with the public anon key must not be able to SET
-- role, XP, or coin balances via the Data API.

DROP POLICY IF EXISTS "users_update_own" ON public.users;

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

REVOKE UPDATE ON public.users FROM anon, authenticated;
GRANT UPDATE (
  github_username,
  email,
  avatar_url,
  last_login_at
) ON public.users TO authenticated;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
