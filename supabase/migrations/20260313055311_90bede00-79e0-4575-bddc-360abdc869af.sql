
-- Function to progress lead after CS call done
-- Bronze → Silver, Silver → Golden
CREATE OR REPLACE FUNCTION public.progress_lead_after_cs(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _lead_id uuid;
  _agent_type text;
BEGIN
  -- Get lead_id and agent_type from the order's associated lead
  SELECT o.lead_id INTO _lead_id FROM orders o WHERE o.id = _order_id;
  IF _lead_id IS NULL THEN RETURN; END IF;

  SELECT l.agent_type INTO _agent_type FROM leads l WHERE l.id = _lead_id;

  IF _agent_type = 'bronze' THEN
    -- Progress to silver: reset lead for reassignment
    UPDATE leads SET 
      agent_type = 'silver',
      status = 'fresh',
      assigned_to = NULL,
      tl_id = NULL,
      called_time = 0,
      called_date = NULL,
      requeue_count = 0,
      requeue_at = NULL,
      updated_at = now()
    WHERE id = _lead_id;
  ELSIF _agent_type = 'silver' THEN
    -- Progress to golden
    UPDATE leads SET 
      agent_type = 'golden',
      status = 'fresh',
      assigned_to = NULL,
      tl_id = NULL,
      called_time = 0,
      called_date = NULL,
      requeue_count = 0,
      requeue_at = NULL,
      updated_at = now()
    WHERE id = _lead_id;
  END IF;
END;
$$;
