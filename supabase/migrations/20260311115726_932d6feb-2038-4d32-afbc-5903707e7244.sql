
-- Allow TL panel users to insert their own attendance
CREATE POLICY "tl_insert_own_attendance"
ON public.attendance FOR INSERT
TO authenticated
WITH CHECK (
  has_panel(auth.uid(), 'tl') AND user_id = get_user_id(auth.uid())
);

-- Allow TL panel users to update their own attendance
CREATE POLICY "tl_update_own_attendance"
ON public.attendance FOR UPDATE
TO authenticated
USING (
  has_panel(auth.uid(), 'tl') AND user_id = get_user_id(auth.uid())
);
