-- Allow users to read conversations they created (needed for insert...returning)
CREATE POLICY "read_own_created_conversations"
ON public.chat_conversations FOR SELECT
TO authenticated
USING (created_by = get_user_id(auth.uid()));