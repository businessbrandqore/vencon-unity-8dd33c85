
-- Fix overly permissive INSERT policy on chat_conversations
DROP POLICY IF EXISTS "insert_conversations" ON public.chat_conversations;
CREATE POLICY "insert_conversations" ON public.chat_conversations FOR INSERT TO authenticated
WITH CHECK (created_by = get_user_id(auth.uid()));
