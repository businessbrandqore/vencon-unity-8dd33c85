-- Fix existing leads that have source='processing' — update to actual website name
UPDATE leads l
SET source = cw.site_name
FROM campaign_websites cw
WHERE l.source = 'processing'
  AND cw.campaign_id = l.campaign_id
  AND cw.data_mode = 'processing';

-- Fallback: remaining leads with source='processing' set to wordpress_webhook
UPDATE leads
SET source = 'wordpress_webhook'
WHERE source = 'processing';