
-- Logistics items tracking for Maintenance Officer
CREATE TABLE public.logistics_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  type text NOT NULL DEFAULT 'in', -- 'in' or 'out'
  note text,
  officer_id uuid REFERENCES public.users(id),
  item_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.logistics_items ENABLE ROW LEVEL SECURITY;

-- Maintenance officer can manage own items
CREATE POLICY "officer_manage_logistics" ON public.logistics_items
  FOR ALL TO authenticated
  USING (officer_id = get_user_id(auth.uid()))
  WITH CHECK (officer_id = get_user_id(auth.uid()));

-- SA can see all
CREATE POLICY "sa_all_logistics" ON public.logistics_items
  FOR ALL TO authenticated
  USING (is_sa(auth.uid()))
  WITH CHECK (is_sa(auth.uid()));

-- Fund requests table
CREATE TABLE public.fund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id uuid REFERENCES public.users(id) NOT NULL,
  amount numeric NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES public.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fund_requests ENABLE ROW LEVEL SECURITY;

-- Officer can insert and read own
CREATE POLICY "officer_insert_fund_requests" ON public.fund_requests
  FOR INSERT TO authenticated
  WITH CHECK (officer_id = get_user_id(auth.uid()));

CREATE POLICY "officer_read_fund_requests" ON public.fund_requests
  FOR SELECT TO authenticated
  USING (officer_id = get_user_id(auth.uid()));

-- SA can manage all
CREATE POLICY "sa_all_fund_requests" ON public.fund_requests
  FOR ALL TO authenticated
  USING (is_sa(auth.uid()))
  WITH CHECK (is_sa(auth.uid()));
