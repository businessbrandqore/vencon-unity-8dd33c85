
-- Helper function: check if user is an ATL
CREATE OR REPLACE FUNCTION public.is_atl(_auth_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_id = _auth_id 
    AND panel = 'tl' 
    AND role = 'Assistant Team Leader'
  );
$$;

-- Helper function: get TL ids that an ATL is assigned under
CREATE OR REPLACE FUNCTION public.get_atl_tl_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT tl_id FROM public.campaign_agent_roles WHERE agent_id = _user_id;
$$;

-- ATL can read leads where tl_id is their assigned TL
CREATE POLICY "atl_read_tl_leads" ON public.leads
FOR SELECT TO authenticated
USING (
  is_atl(auth.uid()) AND tl_id IN (SELECT get_atl_tl_ids(get_user_id(auth.uid())))
);

-- ATL can update leads where tl_id is their assigned TL
CREATE POLICY "atl_update_tl_leads" ON public.leads
FOR UPDATE TO authenticated
USING (
  is_atl(auth.uid()) AND tl_id IN (SELECT get_atl_tl_ids(get_user_id(auth.uid())))
);

-- ATL can read orders where tl_id is their assigned TL
CREATE POLICY "atl_read_tl_orders" ON public.orders
FOR SELECT TO authenticated
USING (
  is_atl(auth.uid()) AND tl_id IN (SELECT get_atl_tl_ids(get_user_id(auth.uid())))
);

-- ATL can read pre_orders where tl_id is their assigned TL
CREATE POLICY "atl_read_tl_preorders" ON public.pre_orders
FOR SELECT TO authenticated
USING (
  is_atl(auth.uid()) AND tl_id IN (SELECT get_atl_tl_ids(get_user_id(auth.uid())))
);

-- ATL can read campaign_agent_roles for their assigned TL
CREATE POLICY "atl_read_tl_campaign_agent_roles" ON public.campaign_agent_roles
FOR SELECT TO authenticated
USING (
  is_atl(auth.uid()) AND tl_id IN (SELECT get_atl_tl_ids(get_user_id(auth.uid())))
);
