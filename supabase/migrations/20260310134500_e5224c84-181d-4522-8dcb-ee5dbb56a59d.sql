
-- Add notification_volume to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notification_volume integer DEFAULT 70;

-- Create notification-sounds bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('notification-sounds', 'notification-sounds', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "hr_upload_sounds" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'notification-sounds' AND (SELECT is_hr(auth.uid())));

CREATE POLICY "anyone_read_sounds" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'notification-sounds');

-- Trigger: attendance appeal → notify SA, HR
CREATE OR REPLACE FUNCTION public.trg_attendance_appeal_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _name text;
BEGIN
  SELECT name INTO _name FROM users WHERE id = NEW.user_id;
  PERFORM notify_panel('sa', _name || ' একটি attendance appeal করেছে', NEW.explanation);
  PERFORM notify_panel('hr', _name || ' একটি attendance appeal করেছে', NEW.explanation);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_appeal_ins ON public.attendance_appeals;
CREATE TRIGGER trg_attendance_appeal_ins AFTER INSERT ON public.attendance_appeals
FOR EACH ROW EXECUTE FUNCTION trg_attendance_appeal_notify();

-- Trigger: leave request → notify SA, HR
CREATE OR REPLACE FUNCTION public.trg_leave_request_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _name text; _days int;
BEGIN
  SELECT name INTO _name FROM users WHERE id = NEW.user_id;
  _days := (NEW.end_date - NEW.start_date) + 1;
  PERFORM notify_panel('sa', _name || ' ' || _days || ' দিনের leave request করেছে', COALESCE(NEW.reason, ''));
  PERFORM notify_panel('hr', _name || ' ' || _days || ' দিনের leave request করেছে', COALESCE(NEW.reason, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_request_ins ON public.leave_requests;
CREATE TRIGGER trg_leave_request_ins AFTER INSERT ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION trg_leave_request_notify();

-- Trigger: SA approval → notify SA
CREATE OR REPLACE FUNCTION public.trg_sa_approval_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _title text; _msg text;
BEGIN
  IF NEW.type = 'hire' THEN
    _title := 'নতুন hire approval দরকার';
    _msg := COALESCE((NEW.details->>'name')::text, '') || ' — ' || COALESCE((NEW.details->>'role')::text, '');
  ELSIF NEW.type = 'incentive_config' THEN
    _title := 'Incentive configuration approval দরকার';
    _msg := '';
  ELSE
    _title := 'নতুন approval request';
    _msg := NEW.type;
  END IF;
  PERFORM notify_panel('sa', _title, _msg);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sa_approval_ins ON public.sa_approvals;
CREATE TRIGGER trg_sa_approval_ins AFTER INSERT ON public.sa_approvals
FOR EACH ROW EXECUTE FUNCTION trg_sa_approval_notify();

-- Trigger: maintenance expense → notify SA
CREATE OR REPLACE FUNCTION public.trg_maintenance_expense_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM notify_panel('sa', 'Maintenance expense: BDT ' || NEW.amount, NEW.description);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintenance_expense_ins ON public.maintenance_expenses;
CREATE TRIGGER trg_maintenance_expense_ins AFTER INSERT ON public.maintenance_expenses
FOR EACH ROW EXECUTE FUNCTION trg_maintenance_expense_notify();

-- Lead routing triggers (functions already exist)
DROP TRIGGER IF EXISTS trg_lead_routing_ins ON public.leads;
DROP TRIGGER IF EXISTS trg_lead_routing_upd ON public.leads;
CREATE TRIGGER trg_lead_routing_ins AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION trg_lead_routing();
CREATE TRIGGER trg_lead_routing_upd AFTER UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION trg_lead_routing();

-- Order routing triggers (functions already exist)
DROP TRIGGER IF EXISTS trg_order_routing_ins ON public.orders;
DROP TRIGGER IF EXISTS trg_order_routing_upd ON public.orders;
CREATE TRIGGER trg_order_routing_ins AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION trg_order_routing();
CREATE TRIGGER trg_order_routing_upd AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION trg_order_routing();
