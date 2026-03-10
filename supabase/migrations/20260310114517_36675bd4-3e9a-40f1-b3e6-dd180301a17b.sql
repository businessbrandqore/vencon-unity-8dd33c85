
-- VENCON FULL DATABASE SCHEMA

-- ENUM for panel-based roles
CREATE TYPE public.app_panel AS ENUM ('sa', 'hr', 'tl', 'employee');

-- TABLE 1: users
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  panel app_panel NOT NULL,
  role text NOT NULL,
  department text,
  designation text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- TABLE 2: user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL,
  panel app_panel NOT NULL,
  UNIQUE (user_id, role)
);

-- TABLE 3: campaigns
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text DEFAULT 'draft' CHECK (status IN ('draft','pending_sa','active','paused','completed')),
  created_by uuid REFERENCES public.users(id),
  approved_by uuid REFERENCES public.users(id),
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- TABLE 4: leads
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id),
  name text,
  phone text,
  address text,
  source text,
  assigned_to uuid REFERENCES public.users(id),
  tl_id uuid REFERENCES public.users(id),
  status text DEFAULT 'fresh' CHECK (status IN ('fresh','called','interested','not_interested','order','callback','pre_order','duplicate','invalid')),
  agent_type text CHECK (agent_type IN ('bronze','silver','both')),
  called_time integer DEFAULT 0 CHECK (called_time IN (0,1,2,3)),
  called_date timestamptz,
  special_note text,
  sms_status text DEFAULT 'not_sent' CHECK (sms_status IN ('not_sent','sent')),
  requeue_count integer DEFAULT 0,
  requeue_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- TABLE 5: orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id),
  customer_name text,
  phone text,
  address text,
  product text,
  quantity integer DEFAULT 1,
  price numeric(10,2),
  status text DEFAULT 'pending_cso',
  agent_id uuid REFERENCES public.users(id),
  tl_id uuid REFERENCES public.users(id),
  cso_id uuid REFERENCES public.users(id),
  cso_approved_at timestamptz,
  warehouse_sent_by uuid REFERENCES public.users(id),
  warehouse_sent_at timestamptz,
  steadfast_consignment_id text,
  steadfast_send_failed boolean DEFAULT false,
  delivery_status text DEFAULT 'pending',
  cs_id uuid REFERENCES public.users(id),
  cs_note text,
  cs_rating text CHECK (cs_rating IN ('good','average','bad')),
  cs_call_done_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- TABLE 6: attendance
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  date date NOT NULL,
  clock_in timestamptz,
  clock_out timestamptz,
  mood_in text CHECK (mood_in IN ('happy','sad','excited','tired','neutral','angry')),
  mood_out text CHECK (mood_out IN ('happy','sad','excited','tired','neutral','angry')),
  mood_note text,
  is_late boolean DEFAULT false,
  is_early_out boolean DEFAULT false,
  deduction_amount numeric(8,2) DEFAULT 0,
  desk_condition text,
  phone_minutes_remaining integer,
  UNIQUE(user_id, date)
);

-- TABLE 7: leave_requests
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','paid','unpaid','rejected')),
  decided_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

-- TABLE 8: attendance_appeals
CREATE TABLE public.attendance_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  attendance_id uuid REFERENCES public.attendance(id),
  explanation text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

-- TABLE 9: sa_approvals
CREATE TABLE public.sa_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('new_campaign','non_agent_hire','incentive_config','profit_share_config')),
  requested_by uuid REFERENCES public.users(id),
  details jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by uuid REFERENCES public.users(id),
  rejection_reason text,
  created_at timestamptz DEFAULT now()
);

-- TABLE 10: incentive_config
CREATE TABLE public.incentive_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  min_ratio numeric(5,2),
  max_ratio numeric(5,2),
  amount_per_order numeric(8,2),
  minimum_threshold numeric(5,2),
  status text DEFAULT 'draft' CHECK (status IN ('draft','pending_sa','active')),
  created_by uuid REFERENCES public.users(id),
  approved_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

-- TABLE 11: profit_share_config
CREATE TABLE public.profit_share_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL UNIQUE,
  percentage numeric(5,2) NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft','pending_sa','active')),
  created_by uuid REFERENCES public.users(id),
  approved_by uuid REFERENCES public.users(id),
  updated_at timestamptz DEFAULT now()
);

-- TABLE 12: notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  title text NOT NULL,
  message text,
  type text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- TABLE 13: audit_logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.users(id),
  actor_role text,
  action text NOT NULL,
  target_table text,
  target_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- TABLE 14: chat_conversations
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text CHECK (type IN ('group','direct')),
  name text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

-- TABLE 15: chat_messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.chat_conversations(id),
  sender_id uuid REFERENCES public.users(id),
  content text NOT NULL,
  reply_to_id uuid REFERENCES public.chat_messages(id),
  reactions jsonb DEFAULT '{}',
  read_by uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- TABLE 16: inventory
CREATE TABLE public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  stock_in integer DEFAULT 0,
  dispatched integer DEFAULT 0,
  returned integer DEFAULT 0,
  damaged integer DEFAULT 0,
  unit_price numeric(10,2),
  low_stock_threshold integer DEFAULT 10,
  updated_at timestamptz DEFAULT now()
);

-- TABLE 17: maintenance_budget
CREATE TABLE public.maintenance_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocated_by uuid REFERENCES public.users(id),
  amount numeric(10,2),
  note text,
  created_at timestamptz DEFAULT now()
);

-- TABLE 18: maintenance_expenses
CREATE TABLE public.maintenance_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id uuid REFERENCES public.users(id),
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  category text CHECK (category IN ('office_supplies','equipment','repair','transport','other')),
  expense_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- TABLE 19: group_members
CREATE TABLE public.group_members (
  group_leader_id uuid REFERENCES public.users(id),
  agent_id uuid REFERENCES public.users(id),
  PRIMARY KEY (group_leader_id, agent_id)
);

-- TABLE 20: pre_orders
CREATE TABLE public.pre_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id),
  agent_id uuid REFERENCES public.users(id),
  tl_id uuid REFERENCES public.users(id),
  scheduled_date date,
  note text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','converted','deleted')),
  created_at timestamptz DEFAULT now()
);

-- ENABLE RLS ON ALL TABLES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sa_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_share_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_orders ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_user_panel(_auth_id uuid)
RETURNS app_panel
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT panel FROM public.users WHERE auth_id = _auth_id LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.get_user_id(_auth_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.users WHERE auth_id = _auth_id LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.has_panel(_auth_id uuid, _panel app_panel)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.users WHERE auth_id = _auth_id AND panel = _panel); $$;

CREATE OR REPLACE FUNCTION public.is_sa(_auth_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.users WHERE auth_id = _auth_id AND panel = 'sa'); $$;

CREATE OR REPLACE FUNCTION public.is_hr(_auth_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.users WHERE auth_id = _auth_id AND panel = 'hr'); $$;

-- UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profit_share_updated_at BEFORE UPDATE ON public.profit_share_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS POLICIES

-- USERS TABLE
CREATE POLICY "sa_read_all_users" ON public.users FOR SELECT TO authenticated USING (public.is_sa(auth.uid()));
CREATE POLICY "hr_read_all_users" ON public.users FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));
CREATE POLICY "tl_read_group_users" ON public.users FOR SELECT TO authenticated USING (public.has_panel(auth.uid(), 'tl') AND (id = public.get_user_id(auth.uid()) OR id IN (SELECT agent_id FROM public.group_members WHERE group_leader_id = public.get_user_id(auth.uid()))));
CREATE POLICY "employee_read_own_user" ON public.users FOR SELECT TO authenticated USING (auth_id = auth.uid());
CREATE POLICY "sa_manage_users" ON public.users FOR INSERT TO authenticated WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "sa_update_users" ON public.users FOR UPDATE TO authenticated USING (public.is_sa(auth.uid()));
CREATE POLICY "hr_manage_users" ON public.users FOR INSERT TO authenticated WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY "hr_update_users" ON public.users FOR UPDATE TO authenticated USING (public.is_hr(auth.uid()));

-- USER_ROLES TABLE
CREATE POLICY "sa_manage_roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "read_own_roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = public.get_user_id(auth.uid()));

-- CAMPAIGNS TABLE
CREATE POLICY "sa_all_campaigns" ON public.campaigns FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "hr_read_campaigns" ON public.campaigns FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));
CREATE POLICY "tl_read_campaigns" ON public.campaigns FOR SELECT TO authenticated USING (public.has_panel(auth.uid(), 'tl'));
CREATE POLICY "employee_read_active_campaigns" ON public.campaigns FOR SELECT TO authenticated USING (public.has_panel(auth.uid(), 'employee') AND status = 'active');

-- LEADS TABLE
CREATE POLICY "sa_all_leads" ON public.leads FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "hr_read_leads" ON public.leads FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));
CREATE POLICY "tl_read_leads" ON public.leads FOR SELECT TO authenticated USING (public.has_panel(auth.uid(), 'tl') AND tl_id = public.get_user_id(auth.uid()));
CREATE POLICY "tl_update_leads" ON public.leads FOR UPDATE TO authenticated USING (public.has_panel(auth.uid(), 'tl') AND tl_id = public.get_user_id(auth.uid()));
CREATE POLICY "employee_read_own_leads" ON public.leads FOR SELECT TO authenticated USING (assigned_to = public.get_user_id(auth.uid()));
CREATE POLICY "employee_update_own_leads" ON public.leads FOR UPDATE TO authenticated USING (assigned_to = public.get_user_id(auth.uid()));

-- ORDERS TABLE
CREATE POLICY "sa_all_orders" ON public.orders FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "hr_read_orders" ON public.orders FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));
CREATE POLICY "tl_read_orders" ON public.orders FOR SELECT TO authenticated USING (public.has_panel(auth.uid(), 'tl') AND tl_id = public.get_user_id(auth.uid()));
CREATE POLICY "employee_read_own_orders" ON public.orders FOR SELECT TO authenticated USING (agent_id = public.get_user_id(auth.uid()) OR cs_id = public.get_user_id(auth.uid()) OR cso_id = public.get_user_id(auth.uid()));
CREATE POLICY "employee_insert_orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (agent_id = public.get_user_id(auth.uid()));
CREATE POLICY "employee_update_own_orders" ON public.orders FOR UPDATE TO authenticated USING (agent_id = public.get_user_id(auth.uid()) OR cs_id = public.get_user_id(auth.uid()) OR cso_id = public.get_user_id(auth.uid()));

-- ATTENDANCE TABLE
CREATE POLICY "sa_all_attendance" ON public.attendance FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "hr_all_attendance" ON public.attendance FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY "tl_read_group_attendance" ON public.attendance FOR SELECT TO authenticated USING (public.has_panel(auth.uid(), 'tl') AND (user_id = public.get_user_id(auth.uid()) OR user_id IN (SELECT agent_id FROM public.group_members WHERE group_leader_id = public.get_user_id(auth.uid()))));
CREATE POLICY "employee_read_own_attendance" ON public.attendance FOR SELECT TO authenticated USING (user_id = public.get_user_id(auth.uid()));
CREATE POLICY "employee_insert_own_attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (user_id = public.get_user_id(auth.uid()));
CREATE POLICY "employee_update_own_attendance" ON public.attendance FOR UPDATE TO authenticated USING (user_id = public.get_user_id(auth.uid()));

-- LEAVE_REQUESTS TABLE
CREATE POLICY "sa_all_leave" ON public.leave_requests FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "hr_all_leave" ON public.leave_requests FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY "employee_own_leave" ON public.leave_requests FOR SELECT TO authenticated USING (user_id = public.get_user_id(auth.uid()));
CREATE POLICY "employee_insert_leave" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (user_id = public.get_user_id(auth.uid()));

-- ATTENDANCE_APPEALS TABLE
CREATE POLICY "sa_all_appeals" ON public.attendance_appeals FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "hr_all_appeals" ON public.attendance_appeals FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY "employee_own_appeals" ON public.attendance_appeals FOR SELECT TO authenticated USING (user_id = public.get_user_id(auth.uid()));
CREATE POLICY "employee_insert_appeals" ON public.attendance_appeals FOR INSERT TO authenticated WITH CHECK (user_id = public.get_user_id(auth.uid()));

-- SA_APPROVALS TABLE
CREATE POLICY "sa_all_approvals" ON public.sa_approvals FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "hr_read_approvals" ON public.sa_approvals FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));
CREATE POLICY "hr_insert_approvals" ON public.sa_approvals FOR INSERT TO authenticated WITH CHECK (public.is_hr(auth.uid()));

-- INCENTIVE_CONFIG TABLE
CREATE POLICY "sa_all_incentive" ON public.incentive_config FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "hr_read_incentive" ON public.incentive_config FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));
CREATE POLICY "hr_manage_incentive" ON public.incentive_config FOR INSERT TO authenticated WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY "hr_update_incentive" ON public.incentive_config FOR UPDATE TO authenticated USING (public.is_hr(auth.uid()));

-- PROFIT_SHARE_CONFIG TABLE
CREATE POLICY "sa_all_profit_share" ON public.profit_share_config FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "hr_read_profit_share" ON public.profit_share_config FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));

-- NOTIFICATIONS TABLE
CREATE POLICY "read_own_notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = public.get_user_id(auth.uid()));
CREATE POLICY "update_own_notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = public.get_user_id(auth.uid()));
CREATE POLICY "sa_hr_insert_notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_sa(auth.uid()) OR public.is_hr(auth.uid()));

-- AUDIT_LOGS TABLE (read-only for SA and HR)
CREATE POLICY "sa_read_audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_sa(auth.uid()));
CREATE POLICY "hr_read_audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));

-- CHAT_CONVERSATIONS TABLE
CREATE POLICY "authenticated_read_conversations" ON public.chat_conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_conversations" ON public.chat_conversations FOR INSERT TO authenticated WITH CHECK (created_by = public.get_user_id(auth.uid()));

-- CHAT_MESSAGES TABLE
CREATE POLICY "authenticated_read_messages" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (sender_id = public.get_user_id(auth.uid()));
CREATE POLICY "update_own_messages" ON public.chat_messages FOR UPDATE TO authenticated USING (sender_id = public.get_user_id(auth.uid()));

-- INVENTORY TABLE
CREATE POLICY "sa_all_inventory" ON public.inventory FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "hr_read_inventory" ON public.inventory FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));
CREATE POLICY "employee_read_inventory" ON public.inventory FOR SELECT TO authenticated USING (true);

-- MAINTENANCE_BUDGET TABLE
CREATE POLICY "sa_all_budget" ON public.maintenance_budget FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));

-- MAINTENANCE_EXPENSES TABLE
CREATE POLICY "sa_all_expenses" ON public.maintenance_expenses FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "officer_own_expenses" ON public.maintenance_expenses FOR SELECT TO authenticated USING (officer_id = public.get_user_id(auth.uid()));
CREATE POLICY "officer_insert_expenses" ON public.maintenance_expenses FOR INSERT TO authenticated WITH CHECK (officer_id = public.get_user_id(auth.uid()));

-- GROUP_MEMBERS TABLE
CREATE POLICY "sa_all_groups" ON public.group_members FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "hr_all_groups" ON public.group_members FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY "tl_read_own_group" ON public.group_members FOR SELECT TO authenticated USING (group_leader_id = public.get_user_id(auth.uid()));
CREATE POLICY "employee_read_own_group" ON public.group_members FOR SELECT TO authenticated USING (agent_id = public.get_user_id(auth.uid()));

-- PRE_ORDERS TABLE
CREATE POLICY "sa_all_preorders" ON public.pre_orders FOR ALL TO authenticated USING (public.is_sa(auth.uid())) WITH CHECK (public.is_sa(auth.uid()));
CREATE POLICY "tl_read_preorders" ON public.pre_orders FOR SELECT TO authenticated USING (public.has_panel(auth.uid(), 'tl') AND tl_id = public.get_user_id(auth.uid()));
CREATE POLICY "employee_own_preorders" ON public.pre_orders FOR SELECT TO authenticated USING (agent_id = public.get_user_id(auth.uid()));
CREATE POLICY "employee_insert_preorders" ON public.pre_orders FOR INSERT TO authenticated WITH CHECK (agent_id = public.get_user_id(auth.uid()));
CREATE POLICY "employee_update_preorders" ON public.pre_orders FOR UPDATE TO authenticated USING (agent_id = public.get_user_id(auth.uid()));

-- INDEXES
CREATE INDEX idx_users_auth_id ON public.users(auth_id);
CREATE INDEX idx_users_panel ON public.users(panel);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_tl_id ON public.leads(tl_id);
CREATE INDEX idx_leads_campaign_id ON public.leads(campaign_id);
CREATE INDEX idx_orders_agent_id ON public.orders(agent_id);
CREATE INDEX idx_orders_tl_id ON public.orders(tl_id);
CREATE INDEX idx_attendance_user_date ON public.attendance(user_id, date);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
