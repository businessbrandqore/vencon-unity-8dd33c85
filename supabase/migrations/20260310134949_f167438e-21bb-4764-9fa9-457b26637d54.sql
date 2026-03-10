
-- Chat participants table for tracking conversation membership
CREATE TABLE IF NOT EXISTS public.chat_participants (
  conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamptz DEFAULT now(),
  is_admin boolean DEFAULT false,
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_own_participations" ON public.chat_participants FOR SELECT TO authenticated
USING (user_id = get_user_id(auth.uid()));

CREATE POLICY "hr_all_participants" ON public.chat_participants FOR ALL TO authenticated
USING (is_hr(auth.uid())) WITH CHECK (is_hr(auth.uid()));

CREATE POLICY "sa_all_participants" ON public.chat_participants FOR ALL TO authenticated
USING (is_sa(auth.uid())) WITH CHECK (is_sa(auth.uid()));

-- Allow participants to read conversations they're in
DROP POLICY IF EXISTS "authenticated_read_conversations" ON public.chat_conversations;
CREATE POLICY "read_own_conversations" ON public.chat_conversations FOR SELECT TO authenticated
USING (
  id IN (SELECT conversation_id FROM chat_participants WHERE user_id = get_user_id(auth.uid()))
  OR is_hr(auth.uid()) OR is_sa(auth.uid())
);

-- Allow participants to read messages in their conversations
DROP POLICY IF EXISTS "authenticated_read_messages" ON public.chat_messages;
CREATE POLICY "read_participant_messages" ON public.chat_messages FOR SELECT TO authenticated
USING (
  conversation_id IN (SELECT conversation_id FROM chat_participants WHERE user_id = get_user_id(auth.uid()))
  OR is_hr(auth.uid()) OR is_sa(auth.uid())
);

-- Allow any authenticated user to update message reactions/read_by
DROP POLICY IF EXISTS "update_own_messages" ON public.chat_messages;
CREATE POLICY "update_participant_messages" ON public.chat_messages FOR UPDATE TO authenticated
USING (
  conversation_id IN (SELECT conversation_id FROM chat_participants WHERE user_id = get_user_id(auth.uid()))
);

-- Allow participants to insert conversations
DROP POLICY IF EXISTS "authenticated_insert_conversations" ON public.chat_conversations;
CREATE POLICY "insert_conversations" ON public.chat_conversations FOR INSERT TO authenticated
WITH CHECK (true);

-- Allow participants to insert messages
DROP POLICY IF EXISTS "authenticated_insert_messages" ON public.chat_messages;
CREATE POLICY "insert_participant_messages" ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = get_user_id(auth.uid())
  AND conversation_id IN (SELECT conversation_id FROM chat_participants WHERE user_id = get_user_id(auth.uid()))
);

-- Enable realtime for chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
