
CREATE OR REPLACE FUNCTION public.calculate_salary(_user_id uuid, _year integer, _month integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user RECORD;
  _basic numeric;
  _incentive numeric := 0;
  _att_deductions numeric := 0;
  _unpaid_deduction numeric := 0;
  _month_start date;
  _month_end date;
  _confirmed_count int;
  _delivered_count int;
  _receive_ratio numeric;
  _threshold numeric;
  _tier RECORD;
  _pool numeric := 0;
  _role_pct numeric := 0;
  _role_count int := 0;
  _profit_share numeric := 0;
  _agent RECORD;
  _agent_ratio numeric;
  _agent_delivered int;
  _sum_ratios numeric := 0;
  _agent_count int := 0;
  _total_delivered int := 0;
  _gl_avg numeric;
  _gl_count int := 0;
  _gl_sum_ratios numeric := 0;
  _gl_total_delivered int := 0;
BEGIN
  _month_start := make_date(_year, _month, 1);
  _month_end := (_month_start + interval '1 month - 1 day')::date;

  SELECT * INTO _user FROM users WHERE id = _user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'user_not_found'); END IF;
  _basic := COALESCE(_user.basic_salary, 0);

  -- Attendance deductions
  SELECT COALESCE(SUM(deduction_amount), 0) INTO _att_deductions
  FROM attendance
  WHERE user_id = _user_id
    AND date >= _month_start AND date <= _month_end;

  -- Unpaid leave deductions
  SELECT COUNT(*) INTO _unpaid_deduction
  FROM leave_requests
  WHERE user_id = _user_id
    AND status = 'unpaid'
    AND start_date >= _month_start AND start_date <= _month_end;
  _unpaid_deduction := _unpaid_deduction * (_basic / 26.0);

  -- Determine salary type
  IF _user.role IN ('telesales_executive', 'assistant_team_leader') THEN
    -- Individual incentive calculation
    SELECT COUNT(*) INTO _confirmed_count FROM orders
    WHERE agent_id = _user_id
      AND created_at >= _month_start::timestamp AND created_at < (_month_end + 1)::timestamp
      AND status NOT IN ('rejected');

    SELECT COUNT(*) INTO _delivered_count FROM orders
    WHERE agent_id = _user_id
      AND created_at >= _month_start::timestamp AND created_at < (_month_end + 1)::timestamp
      AND delivery_status = 'delivered';

    IF _confirmed_count > 0 THEN
      _receive_ratio := (_delivered_count::numeric / _confirmed_count) * 100;
    ELSE
      _receive_ratio := 0;
    END IF;

    -- Only telesales_executive has the threshold rule (salary becomes 0 below threshold)
    IF _user.role = 'telesales_executive' THEN
      SELECT COALESCE(minimum_threshold, 0) INTO _threshold
      FROM incentive_config
      WHERE role = _user.role AND status = 'approved'
      LIMIT 1;

      IF _receive_ratio >= COALESCE(_threshold, 0) THEN
        SELECT * INTO _tier FROM incentive_config
        WHERE role = _user.role AND status = 'approved'
          AND _receive_ratio >= COALESCE(min_ratio, 0)
          AND _receive_ratio <= COALESCE(max_ratio, 100)
        LIMIT 1;
        IF FOUND THEN
          _incentive := _delivered_count * COALESCE(_tier.amount_per_order, 0);
        END IF;
      END IF;
    ELSE
      -- ATL: get incentive based on ratio tier without threshold zeroing
      SELECT * INTO _tier FROM incentive_config
      WHERE role = _user.role AND status = 'approved'
        AND _receive_ratio >= COALESCE(min_ratio, 0)
        AND _receive_ratio <= COALESCE(max_ratio, 100)
      LIMIT 1;
      IF FOUND THEN
        _incentive := _delivered_count * COALESCE(_tier.amount_per_order, 0);
      END IF;
    END IF;

  ELSIF _user.role = 'group_leader' THEN
    -- Group leader: average of agents' ratios
    FOR _agent IN
      SELECT gm.agent_id FROM group_members gm WHERE gm.group_leader_id = _user_id
    LOOP
      SELECT COUNT(*) INTO _confirmed_count FROM orders
      WHERE agent_id = _agent.agent_id
        AND created_at >= _month_start::timestamp AND created_at < (_month_end + 1)::timestamp
        AND status NOT IN ('rejected');

      SELECT COUNT(*) INTO _delivered_count FROM orders
      WHERE agent_id = _agent.agent_id
        AND created_at >= _month_start::timestamp AND created_at < (_month_end + 1)::timestamp
        AND delivery_status = 'delivered';

      IF _confirmed_count > 0 THEN
        _agent_ratio := (_delivered_count::numeric / _confirmed_count) * 100;
      ELSE
        _agent_ratio := 0;
      END IF;

      _sum_ratios := _sum_ratios + _agent_ratio;
      _agent_count := _agent_count + 1;
      _total_delivered := _total_delivered + _delivered_count;
    END LOOP;

    IF _agent_count > 0 THEN
      _receive_ratio := _sum_ratios / _agent_count;
    ELSE
      _receive_ratio := 0;
    END IF;

    SELECT COALESCE(minimum_threshold, 0) INTO _threshold
    FROM incentive_config WHERE role = 'group_leader' AND status = 'approved' LIMIT 1;

    IF _receive_ratio >= COALESCE(_threshold, 0) THEN
      SELECT * INTO _tier FROM incentive_config
      WHERE role = 'group_leader' AND status = 'approved'
        AND _receive_ratio >= COALESCE(min_ratio, 0)
        AND _receive_ratio <= COALESCE(max_ratio, 100)
      LIMIT 1;
      IF FOUND THEN
        _incentive := _total_delivered * COALESCE(_tier.amount_per_order, 0);
      END IF;
    END IF;

  ELSIF _user.role = 'team_leader' THEN
    -- TL: average of group leaders' average ratios
    FOR _agent IN
      SELECT DISTINCT gm.group_leader_id as gl_id
      FROM campaign_tls ct
      JOIN campaign_agent_roles car ON car.campaign_id = ct.campaign_id AND car.tl_id = ct.tl_id
      JOIN group_members gm ON gm.agent_id = car.agent_id
      WHERE ct.tl_id = _user_id
    LOOP
      _sum_ratios := 0; _agent_count := 0; _total_delivered := 0;
      FOR _agent IN
        SELECT gm2.agent_id FROM group_members gm2 WHERE gm2.group_leader_id = _agent.gl_id
      LOOP
        SELECT COUNT(*) INTO _confirmed_count FROM orders
        WHERE agent_id = _agent.agent_id
          AND created_at >= _month_start::timestamp AND created_at < (_month_end + 1)::timestamp
          AND status NOT IN ('rejected');
        SELECT COUNT(*) INTO _delivered_count FROM orders
        WHERE agent_id = _agent.agent_id
          AND created_at >= _month_start::timestamp AND created_at < (_month_end + 1)::timestamp
          AND delivery_status = 'delivered';
        IF _confirmed_count > 0 THEN _agent_ratio := (_delivered_count::numeric / _confirmed_count) * 100;
        ELSE _agent_ratio := 0; END IF;
        _sum_ratios := _sum_ratios + _agent_ratio;
        _agent_count := _agent_count + 1;
        _total_delivered := _total_delivered + _delivered_count;
      END LOOP;
      IF _agent_count > 0 THEN _gl_avg := _sum_ratios / _agent_count;
      ELSE _gl_avg := 0; END IF;
      _gl_sum_ratios := _gl_sum_ratios + _gl_avg;
      _gl_count := _gl_count + 1;
      _gl_total_delivered := _gl_total_delivered + _total_delivered;
    END LOOP;

    IF _gl_count > 0 THEN _receive_ratio := _gl_sum_ratios / _gl_count;
    ELSE _receive_ratio := 0; END IF;

    SELECT COALESCE(minimum_threshold, 0) INTO _threshold
    FROM incentive_config WHERE role = 'team_leader' AND status = 'approved' LIMIT 1;

    IF _receive_ratio >= COALESCE(_threshold, 0) THEN
      SELECT * INTO _tier FROM incentive_config
      WHERE role = 'team_leader' AND status = 'approved'
        AND _receive_ratio >= COALESCE(min_ratio, 0)
        AND _receive_ratio <= COALESCE(max_ratio, 100)
      LIMIT 1;
      IF FOUND THEN
        _incentive := _gl_total_delivered * COALESCE(_tier.amount_per_order, 0);
      END IF;
    END IF;

  ELSE
    -- Fixed salary roles: profit share
    SELECT COALESCE(SUM(sub.inc), 0) INTO _pool
    FROM (
      SELECT u.id,
        (SELECT COUNT(*) FROM orders o WHERE o.agent_id = u.id
          AND o.created_at >= _month_start::timestamp AND o.created_at < (_month_end + 1)::timestamp
          AND o.delivery_status = 'delivered') as del_count,
        (SELECT COUNT(*) FROM orders o WHERE o.agent_id = u.id
          AND o.created_at >= _month_start::timestamp AND o.created_at < (_month_end + 1)::timestamp
          AND o.status NOT IN ('rejected')) as conf_count
      FROM users u
      WHERE u.role IN ('telesales_executive', 'assistant_team_leader') AND u.is_active = true
    ) agents
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN agents.conf_count = 0 THEN 0
        ELSE (
          SELECT COALESCE(ic.amount_per_order, 0) * agents.del_count
          FROM incentive_config ic
          WHERE ic.role = 'telesales_executive' AND ic.status = 'approved'
            AND (agents.del_count::numeric / agents.conf_count * 100) >= COALESCE(ic.min_ratio, 0)
            AND (agents.del_count::numeric / agents.conf_count * 100) <= COALESCE(ic.max_ratio, 100)
            AND (agents.del_count::numeric / agents.conf_count * 100) >= COALESCE(ic.minimum_threshold, 0)
          LIMIT 1
        )
      END as inc
    ) sub;

    SELECT COALESCE(percentage, 0) INTO _role_pct
    FROM profit_share_config WHERE role = _user.role AND status = 'approved' LIMIT 1;

    SELECT COUNT(*) INTO _role_count FROM users WHERE role = _user.role AND is_active = true;
    IF _role_count > 0 THEN
      _profit_share := (_pool * _role_pct / 100.0) / _role_count;
    END IF;
    _incentive := _profit_share;
    _receive_ratio := 0;
  END IF;

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'name', _user.name,
    'role', _user.role,
    'basic_salary', _basic,
    'incentive', round(_incentive, 2),
    'attendance_deductions', _att_deductions,
    'unpaid_deductions', round(_unpaid_deduction, 2),
    'total_deductions', round(_att_deductions + _unpaid_deduction, 2),
    'net_salary', round(_basic + _incentive - _att_deductions - _unpaid_deduction, 2),
    'receive_ratio', round(COALESCE(_receive_ratio, 0), 2),
    'month', _month,
    'year', _year
  );
END;
$function$;
