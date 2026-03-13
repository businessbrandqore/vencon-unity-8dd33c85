-- Allow all authenticated users to read basic user info (id, name, role) for complaint filing
CREATE POLICY "authenticated_read_basic_user_info"
ON public.users FOR SELECT
TO authenticated
USING (true);
