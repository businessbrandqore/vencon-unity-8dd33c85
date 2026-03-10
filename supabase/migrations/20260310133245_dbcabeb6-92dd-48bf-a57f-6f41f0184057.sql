
-- Helper function to insert notifications for users by panel
CREATE OR REPLACE FUNCTION public.notify_panel(_panel app_panel, _title text, _message text, _type text DEFAULT 'info')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type)
  SELECT id, _title, _message, _type FROM users WHERE panel = _panel AND is_active = true;
END;
$$;

-- Helper: notify a specific user
CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _title text, _message text, _type text DEFAULT 'info')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type) VALUES (_user_id, _title, _message, _type);
END;
$$;

-- Helper: notify users by role
CREATE OR REPLACE FUNCTION public.notify_role(_role text, _title text, _message text, _type text DEFAULT 'info')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type)
  SELECT id, _title, _message, _type FROM users WHERE role = _role AND is_active = true;
END;
$$;

-- ═══════════════════════════════════════════════════
-- TRIGGER: Lead routing chain notifications
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.trg_lead_routing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _lead_name text;
BEGIN
  _lead_name := COALESCE(NEW.name, 'Unknown');

  -- Step 1: New lead inserted
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_panel('sa', 'নতুন lead এসেছে', _lead_name || ' — ' || COALESCE(NEW.phone, ''));
    PERFORM notify_panel('hr', 'নতুন lead এসেছে', _lead_name || ' — ' || COALESCE(NEW.phone, ''));
    PERFORM notify_role('bdo', 'নতুন lead এসেছে', _lead_name || ' — ' || COALESCE(NEW.phone, ''));
    RETURN NEW;
  END IF;

  -- Step 2: TL assigned
  IF TG_OP = 'UPDATE' AND OLD.tl_id IS DISTINCT FROM NEW.tl_id AND NEW.tl_id IS NOT NULL THEN
    PERFORM notify_user(NEW.tl_id, 'নতুন lead আপনার কাছে assign হয়েছে', _lead_name || ' — ' || COALESCE(NEW.phone, ''));
  END IF;

  -- Step 3: Agent assigned (Bronze)
  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    PERFORM notify_user(NEW.assigned_to, 'নতুন lead assign হয়েছে', _lead_name || ' — ' || COALESCE(NEW.agent_type, 'bronze'));
  END IF;

  -- Step 9: Silver agent assignment
  IF TG_OP = 'UPDATE' AND OLD.agent_type IS DISTINCT FROM NEW.agent_type AND NEW.agent_type = 'silver' AND NEW.assigned_to IS NOT NULL THEN
    PERFORM notify_user(NEW.assigned_to, 'Silver lead assign হয়েছে', _lead_name || ' — re-order opportunity');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lead_routing_trigger ON leads;
CREATE TRIGGER lead_routing_trigger
  AFTER INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trg_lead_routing();

-- ═══════════════════════════════════════════════════
-- TRIGGER: Order chain notifications (Steps 4-8)
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.trg_order_routing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cust text;
  _order_short text;
BEGIN
  _cust := COALESCE(NEW.customer_name, 'Unknown');
  _order_short := LEFT(NEW.id::text, 8);

  -- Step 4: New order (pending_cso)
  IF TG_OP = 'INSERT' AND NEW.status = 'pending_cso' THEN
    -- Notify CSO role, TL, SA, HR
    PERFORM notify_role('cso', 'নতুন অর্ডার CSO review-এর জন্য', _cust || ' — Order #' || _order_short);
    IF NEW.tl_id IS NOT NULL THEN
      PERFORM notify_user(NEW.tl_id, 'Agent অর্ডার confirm করেছে', _cust || ' — Order #' || _order_short);
    END IF;
    PERFORM notify_panel('sa', 'নতুন অর্ডার', _cust || ' — Order #' || _order_short);
    PERFORM notify_panel('hr', 'নতুন অর্ডার', _cust || ' — Order #' || _order_short);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Step 5: CSO sets send_today
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'send_today' THEN
      PERFORM notify_role('warehouse_assistant', 'অর্ডার dispatch-এর জন্য প্রস্তুত', _cust || ' — Order #' || _order_short);
      PERFORM notify_role('warehouse_supervisor', 'অর্ডার dispatch-এর জন্য প্রস্তুত', _cust || ' — Order #' || _order_short);
    END IF;

    -- Step 6: Dispatched
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'dispatched' THEN
      PERFORM notify_role('delivery_coordinator', 'অর্ডার dispatched', _cust || ' — Consignment: ' || COALESCE(NEW.steadfast_consignment_id, ''));
    END IF;

    -- Step 7: Delivered → update inventory dispatched count
    IF OLD.delivery_status IS DISTINCT FROM NEW.delivery_status AND NEW.delivery_status = 'delivered' THEN
      UPDATE inventory SET dispatched = COALESCE(dispatched, 0) + COALESCE(NEW.quantity, 1)
        WHERE product_name = NEW.product;
    END IF;

    -- Step 7b: Returned → update inventory returned count
    IF OLD.delivery_status IS DISTINCT FROM NEW.delivery_status AND NEW.delivery_status = 'returned' THEN
      UPDATE inventory SET returned = COALESCE(returned, 0) + COALESCE(NEW.quantity, 1)
        WHERE product_name = NEW.product;
    END IF;

    -- Step 8: Call Done
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'call_done' AND NEW.tl_id IS NOT NULL THEN
      PERFORM notify_user(NEW.tl_id, 'Call Done — Silver assignment ready', _cust || ' — Order #' || _order_short);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_routing_trigger ON orders;
CREATE TRIGGER order_routing_trigger
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trg_order_routing();
