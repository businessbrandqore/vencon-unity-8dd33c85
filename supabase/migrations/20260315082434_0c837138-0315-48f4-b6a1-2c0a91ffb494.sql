
-- Remove remaining duplicate triggers
DROP TRIGGER IF EXISTS trg_attendance_appeal_ins ON public.attendance_appeals;
DROP TRIGGER IF EXISTS trg_leave_request_ins ON public.leave_requests;
DROP TRIGGER IF EXISTS trg_maintenance_expense_ins ON public.maintenance_expenses;
DROP TRIGGER IF EXISTS trg_sa_approval_ins ON public.sa_approvals;
