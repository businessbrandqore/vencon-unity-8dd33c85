
-- ATL approval requests table
CREATE TABLE public.atl_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  atl_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tl_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type text NOT NULL, -- 'lead_assign', 'data_distribute', 'group_create', 'order_action', 'data_request_respond', etc.
  action_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  rejection_reason text,
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.atl_approvals ENABLE ROW LEVEL SECURITY;

-- ATL can insert their own approvals and read them
CREATE POLICY "atl_insert_own_approvals" ON public.atl_approvals
  FOR INSERT TO authenticated
  WITH CHECK (atl_id = get_user_id(auth.uid()));

CREATE POLICY "atl_read_own_approvals" ON public.atl_approvals
  FOR SELECT TO authenticated
  USING (atl_id = get_user_id(auth.uid()));

-- TL can read and update approvals targeted to them
CREATE POLICY "tl_read_approvals" ON public.atl_approvals
  FOR SELECT TO authenticated
  USING (tl_id = get_user_id(auth.uid()));

CREATE POLICY "tl_update_approvals" ON public.atl_approvals
  FOR UPDATE TO authenticated
  USING (tl_id = get_user_id(auth.uid()));

-- BDO can read all ATL approvals
CREATE POLICY "bdo_read_all_atl_approvals" ON public.atl_approvals
  FOR SELECT TO authenticated
  USING (is_bdo(auth.uid()));

-- SA/HR full access
CREATE POLICY "sa_all_atl_approvals" ON public.atl_approvals
  FOR ALL TO authenticated
  USING (is_sa(auth.uid()))
  WITH CHECK (is_sa(auth.uid()));

CREATE POLICY "hr_read_atl_approvals" ON public.atl_approvals
  FOR SELECT TO authenticated
  USING (is_hr(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.atl_approvals;
