
-- Attach trigger functions to their respective tables

-- 1. Order routing: notifications + inventory updates on order INSERT/UPDATE
CREATE TRIGGER on_order_change
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_order_routing();

-- 2. Lead routing: notifications on lead INSERT/UPDATE  
CREATE TRIGGER on_lead_change
  AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_lead_routing();

-- 3. SA approval notifications on new approval request
CREATE TRIGGER on_sa_approval_created
  AFTER INSERT ON public.sa_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sa_approval_notify();

-- 4. Leave request notifications
CREATE TRIGGER on_leave_request_created
  AFTER INSERT ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_leave_request_notify();

-- 5. Attendance appeal notifications
CREATE TRIGGER on_attendance_appeal_created
  AFTER INSERT ON public.attendance_appeals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_attendance_appeal_notify();

-- 6. Maintenance expense notifications
CREATE TRIGGER on_maintenance_expense_created
  AFTER INSERT ON public.maintenance_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_maintenance_expense_notify();
