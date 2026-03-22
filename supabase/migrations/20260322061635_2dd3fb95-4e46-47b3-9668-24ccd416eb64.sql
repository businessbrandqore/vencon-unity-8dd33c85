
-- Add spam transfer tracking columns to leads
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS spam_transferred_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS spam_original_agent uuid DEFAULT NULL REFERENCES public.users(id);

-- Create delete_requests table for SA approval flow
CREATE TABLE public.delete_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.users(id),
  campaign_id uuid REFERENCES public.campaigns(id),
  reason text DEFAULT 'delete_sheet',
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES public.users(id),
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.delete_requests ENABLE ROW LEVEL SECURITY;

-- TL can insert and read own delete requests
CREATE POLICY "tl_insert_delete_requests" ON public.delete_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = get_user_id(auth.uid()));

CREATE POLICY "tl_read_own_delete_requests" ON public.delete_requests
  FOR SELECT TO authenticated
  USING (requested_by = get_user_id(auth.uid()));

-- SA full access
CREATE POLICY "sa_all_delete_requests" ON public.delete_requests
  FOR ALL TO authenticated
  USING (is_sa(auth.uid()))
  WITH CHECK (is_sa(auth.uid()));

-- HR can read
CREATE POLICY "hr_read_delete_requests" ON public.delete_requests
  FOR SELECT TO authenticated
  USING (is_hr(auth.uid()));
