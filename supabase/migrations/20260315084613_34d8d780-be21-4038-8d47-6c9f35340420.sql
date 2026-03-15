
-- Add is_muted column to chat_conversations
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS is_muted boolean DEFAULT false;

-- Security definer function: check if user is a participant
CREATE OR REPLACE FUNCTION public.is_chat_participant(_auth_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_participants 
    WHERE conversation_id = _conversation_id 
    AND user_id = (SELECT id FROM users WHERE auth_id = _auth_id LIMIT 1)
  );
$$;

-- Security definer function: check if user is a chat admin
CREATE OR REPLACE FUNCTION public.is_chat_admin_fn(_auth_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_participants 
    WHERE conversation_id = _conversation_id 
    AND user_id = (SELECT id FROM users WHERE auth_id = _auth_id LIMIT 1)
    AND is_admin = true
  );
$$;

-- Fix: Allow conversation creators to add participants
CREATE POLICY "creator_insert_participants" ON public.chat_participants
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_conversations 
    WHERE id = conversation_id 
    AND created_by = get_user_id(auth.uid())
  )
);

-- Fix: Allow users to see co-participants in their conversations
CREATE POLICY "read_co_participants" ON public.chat_participants
FOR SELECT TO authenticated
USING (
  is_chat_participant(auth.uid(), conversation_id)
);

-- Allow group admins to insert participants
CREATE POLICY "admin_insert_participants" ON public.chat_participants
FOR INSERT TO authenticated
WITH CHECK (
  is_chat_admin_fn(auth.uid(), conversation_id)
);

-- Allow group admins to delete participants (remove members)
CREATE POLICY "admin_delete_participants" ON public.chat_participants
FOR DELETE TO authenticated
USING (
  is_chat_admin_fn(auth.uid(), conversation_id)
);

-- Allow group admins to update participants (toggle admin)
CREATE POLICY "admin_update_participants" ON public.chat_participants
FOR UPDATE TO authenticated
USING (is_chat_admin_fn(auth.uid(), conversation_id))
WITH CHECK (is_chat_admin_fn(auth.uid(), conversation_id));

-- Allow HR to update conversations (mute, rename)
CREATE POLICY "hr_update_conversations" ON public.chat_conversations
FOR UPDATE TO authenticated
USING (is_hr(auth.uid()))
WITH CHECK (is_hr(auth.uid()));

-- Allow HR to delete conversations
CREATE POLICY "hr_delete_conversations" ON public.chat_conversations
FOR DELETE TO authenticated
USING (is_hr(auth.uid()));

-- Allow group admins to update conversations (mute, rename) but not delete
CREATE POLICY "admin_update_conversations" ON public.chat_conversations
FOR UPDATE TO authenticated
USING (is_chat_admin_fn(auth.uid(), id))
WITH CHECK (is_chat_admin_fn(auth.uid(), id));

-- Chat calls table
CREATE TABLE IF NOT EXISTS public.chat_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE CASCADE NOT NULL,
  caller_id uuid REFERENCES public.users(id) NOT NULL,
  status text NOT NULL DEFAULT 'ringing',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.chat_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants_all_calls" ON public.chat_calls
FOR ALL TO authenticated
USING (is_chat_participant(auth.uid(), conversation_id))
WITH CHECK (is_chat_participant(auth.uid(), conversation_id));

-- Enable realtime for chat tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_conversations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_calls') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_calls;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_participants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
  END IF;
END $$;
