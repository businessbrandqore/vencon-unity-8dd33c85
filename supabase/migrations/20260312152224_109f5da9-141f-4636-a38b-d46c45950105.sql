
-- ATL can read data_requests where tl_id matches their assigned TL
CREATE POLICY "atl_read_tl_data_requests" ON public.data_requests
FOR SELECT TO authenticated
USING (
  is_atl(auth.uid()) AND tl_id IN (SELECT get_atl_tl_ids(get_user_id(auth.uid())))
);

-- ATL can read campaigns (they need this for data tracker)
-- Already exists via tl_read_campaigns which uses has_panel('tl')

-- ATL can insert data_requests (requesting data from their TL)
CREATE POLICY "atl_insert_data_requests" ON public.data_requests
FOR INSERT TO authenticated
WITH CHECK (
  is_atl(auth.uid()) AND requested_by = get_user_id(auth.uid())
);
