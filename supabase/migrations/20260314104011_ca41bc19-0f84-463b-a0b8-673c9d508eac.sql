-- The lead status flow is dynamic (configured by HR), so a hardcoded CHECK list blocks valid transitions.
-- Remove outdated status constraint to allow configured workflow statuses.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;