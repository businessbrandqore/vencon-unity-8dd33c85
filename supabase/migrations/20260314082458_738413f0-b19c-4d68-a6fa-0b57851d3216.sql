
-- Update existing pending_cso orders to pending_tl so TL can see them
UPDATE public.orders SET status = 'pending_tl' WHERE status = 'pending_cso';

-- Update the order routing trigger to handle pending_tl
CREATE OR REPLACE FUNCTION public.trg_order_routing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cust text;
  _order_short text;
BEGIN
  _cust := COALESCE(NEW.customer_name, 'Unknown');
  _order_short := LEFT(NEW.id::text, 8);

  -- Step 4: New order (pending_tl) - agent confirmed, goes to TL first
  IF TG_OP = 'INSERT' AND NEW.status = 'pending_tl' THEN
    IF NEW.tl_id IS NOT NULL THEN
      PERFORM notify_user(NEW.tl_id, 'Agent অর্ডার confirm করেছে — রিভিউ করুন', _cust || ' — Order #' || _order_short);
    END IF;
    PERFORM notify_panel('sa', 'নতুন অর্ডার', _cust || ' — Order #' || _order_short);
    PERFORM notify_panel('hr', 'নতুন অর্ডার', _cust || ' — Order #' || _order_short);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- TL approved → sent to CSO
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'pending_cso' THEN
      PERFORM notify_role('cso', 'নতুন অর্ডার CSO review-এর জন্য', _cust || ' — Order #' || _order_short);
    END IF;

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
$function$;
