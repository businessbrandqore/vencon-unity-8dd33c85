
-- Add missing columns to users table for employee-specific data
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS shift_start time;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS shift_end time;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS basic_salary numeric(10,2);
