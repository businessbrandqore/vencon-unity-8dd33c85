
-- Create data_requests table for agents/GLs to request more leads from TL
CREATE TABLE public.data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tl_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  message text,
  response_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;

-- Agents can insert their own requests
CREATE POLICY "agent_insert_data_request" ON public.data_requests
FOR INSERT TO authenticated
WITH CHECK (requested_by = get_user_id(auth.uid()));

-- Agents can read their own requests
CREATE POLICY "agent_read_own_data_requests" ON public.data_requests
FOR SELECT TO authenticated
USING (requested_by = get_user_id(auth.uid()));

-- TL can read requests directed to them
CREATE POLICY "tl_read_data_requests" ON public.data_requests
FOR SELECT TO authenticated
USING (has_panel(auth.uid(), 'tl'::app_panel) AND tl_id = get_user_id(auth.uid()));

-- TL can update requests directed to them (to respond)
CREATE POLICY "tl_update_data_requests" ON public.data_requests
FOR UPDATE TO authenticated
USING (has_panel(auth.uid(), 'tl'::app_panel) AND tl_id = get_user_id(auth.uid()));

-- BDO can read all
CREATE POLICY "bdo_read_all_data_requests" ON public.data_requests
FOR SELECT TO authenticated
USING (is_bdo(auth.uid()));

-- SA/HR can read all
CREATE POLICY "sa_all_data_requests" ON public.data_requests
FOR ALL TO authenticated
USING (is_sa(auth.uid()))
WITH CHECK (is_sa(auth.uid()));

CREATE POLICY "hr_read_data_requests" ON public.data_requests
FOR SELECT TO authenticated
USING (is_hr(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.data_requests;
