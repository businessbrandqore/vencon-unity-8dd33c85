
-- Add is_spam flag to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_spam boolean NOT NULL DEFAULT false;

-- Update RLS policy to allow employee to update is_spam on their own leads
DROP POLICY IF EXISTS "employee_update_own_leads" ON public.leads;

CREATE POLICY "employee_update_own_leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  assigned_to = get_user_id(auth.uid())
)
WITH CHECK (
  assigned_to = get_user_id(auth.uid())
  OR (
    assigned_to IS NULL
    AND status IN (
      'order_confirm',
      '_order_confirm',
      'pre_order',
      'pre_order_confirm',
      'pending_tl',
      'pending_cso',
      'tl_delete_sheet'
    )
  )
);

-- Allow employee to read their own spam leads (even if assigned_to is null after spam)
DROP POLICY IF EXISTS "employee_read_own_spam_leads" ON public.leads;
CREATE POLICY "employee_read_own_spam_leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  is_spam = true AND assigned_to = get_user_id(auth.uid())
);

-- Allow employee to delete their own spam leads
DROP POLICY IF EXISTS "employee_delete_own_spam_leads" ON public.leads;
CREATE POLICY "employee_delete_own_spam_leads"
ON public.leads
FOR DELETE
TO authenticated
USING (
  is_spam = true AND assigned_to = get_user_id(auth.uid())
);
