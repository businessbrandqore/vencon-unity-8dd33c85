
-- Ensure SA has DELETE permission on campaigns (the sa_all_campaigns ALL policy should cover this, but let's verify by adding explicit)
-- The existing sa_all_campaigns policy with command ALL already covers DELETE for SA users, so no additional policy needed.
-- Just adding hr_delete_campaigns policy is NOT needed since HR should go through approval.
SELECT 1;
