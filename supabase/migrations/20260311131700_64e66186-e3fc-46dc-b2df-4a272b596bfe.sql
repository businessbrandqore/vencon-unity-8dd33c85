-- Helper function to check if user is BDO
CREATE OR REPLACE FUNCTION public.is_bdo(_auth_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_id = _auth_id 
    AND role = 'Business Development And Marketing Manager'
  );
$$;

-- BDO can read all leads
CREATE POLICY "bdo_read_all_leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (is_bdo(auth.uid()));

-- BDO can read all orders  
CREATE POLICY "bdo_read_all_orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (is_bdo(auth.uid()));

-- BDO can read all pre_orders
CREATE POLICY "bdo_read_all_preorders"
  ON public.pre_orders
  FOR SELECT
  TO authenticated
  USING (is_bdo(auth.uid()));

-- BDO can read all users (for agent names etc)
CREATE POLICY "bdo_read_all_users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (is_bdo(auth.uid()));