
-- Drop the existing type check constraint and recreate with campaign_delete included
ALTER TABLE sa_approvals DROP CONSTRAINT IF EXISTS sa_approvals_type_check;

ALTER TABLE sa_approvals ADD CONSTRAINT sa_approvals_type_check 
CHECK (type IN ('hire', 'non_agent_hire', 'new_campaign', 'campaign_delete', 'incentive_config', 'profit_share_config', 'group_creation', 'gl_campaign_assignment', 'member_reassignment'));
