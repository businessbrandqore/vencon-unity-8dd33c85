import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CourierResult {
  courier: string;
  total: number;
  success: number;
  cancel: number;
  error?: string;
}

interface LocalDbResult {
  total_orders: number;
  delivered: number;
  cancelled: number;
  returned: number;
  pending: number;
  total_value: number;
  addresses: string[];
  names: string[];
  first_order: string | null;
  last_order: string | null;
  campaigns: string[];
}

// --- Courier API checks ---

async function checkSteadfast(phone: string, apiKey: string, secretKey: string): Promise<CourierResult> {
  try {
    const res = await fetch(`https://portal.packzy.com/api/v1/fraud_check/${phone}`, {
      method: 'GET',
      headers: { 'Api-Key': apiKey, 'Secret-Key': secretKey, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return { courier: 'Steadfast', total: 0, success: 0, cancel: 0, error: `HTTP ${res.status}` };
    const data = await res.json();
    return {
      courier: 'Steadfast',
      total: data.Total_parcels ?? data.total_parcels ?? 0,
      success: data.total_delivered ?? 0,
      cancel: data.total_cancelled ?? 0,
    };
  } catch (err) {
    return { courier: 'Steadfast', total: 0, success: 0, cancel: 0, error: (err as Error).message };
  }
}

async function checkPathao(phone: string, username: string, password: string): Promise<CourierResult> {
  try {
    const loginRes = await fetch('https://merchant.pathao.com/api/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!loginRes.ok) return { courier: 'Pathao', total: 0, success: 0, cancel: 0, error: `Login failed: HTTP ${loginRes.status}` };
    const loginData = await loginRes.json();
    const token = loginData.access_token;
    if (!token) return { courier: 'Pathao', total: 0, success: 0, cancel: 0, error: 'No access token' };

    const checkRes = await fetch('https://merchant.pathao.com/api/v1/user/success', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ phone }),
    });
    if (!checkRes.ok) return { courier: 'Pathao', total: 0, success: 0, cancel: 0, error: `Check failed: HTTP ${checkRes.status}` };
    const checkData = await checkRes.json();
    const customer = checkData?.data?.customer;
    if (!customer) return { courier: 'Pathao', total: 0, success: 0, cancel: 0, error: 'No customer data' };
    const total = customer.total_delivery ?? 0;
    const success = customer.successful_delivery ?? 0;
    return { courier: 'Pathao', total, success, cancel: total - success };
  } catch (err) {
    return { courier: 'Pathao', total: 0, success: 0, cancel: 0, error: (err as Error).message };
  }
}

async function checkRedx(phone: string, accessToken: string): Promise<CourierResult> {
  try {
    const res = await fetch(`https://openapi.redx.com.bd/v1.0.0-beta/parcel/tracking?customer_phone=${phone}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return { courier: 'RedX', total: 0, success: 0, cancel: 0, error: `HTTP ${res.status}` };
    const data = await res.json();
    const parcels = data?.parcels || data?.data || [];
    if (!Array.isArray(parcels)) {
      return {
        courier: 'RedX',
        total: data.total_parcels ?? data.total ?? 0,
        success: data.total_delivered ?? data.delivered ?? 0,
        cancel: data.total_cancelled ?? data.cancelled ?? data.returned ?? 0,
      };
    }
    let total = parcels.length, success = 0, cancel = 0;
    for (const p of parcels) {
      const status = (p.parcel_status || p.status || '').toLowerCase();
      if (status === 'delivered' || status === 'delivery_completed') success++;
      if (status === 'cancelled' || status === 'returned' || status === 'return_completed') cancel++;
    }
    return { courier: 'RedX', total, success, cancel };
  } catch (err) {
    return { courier: 'RedX', total: 0, success: 0, cancel: 0, error: (err as Error).message };
  }
}

// --- Local DB check ---

async function checkLocalDb(phone: string, supabase: ReturnType<typeof createClient>): Promise<LocalDbResult> {
  const phoneSuffix = phone.slice(-10);

  const { data: orders } = await supabase
    .from('orders')
    .select('id, customer_name, phone, address, district, delivery_status, status, price, created_at, campaign_id')
    .ilike('phone', `%${phoneSuffix}%`)
    .order('created_at', { ascending: false })
    .limit(200);

  if (!orders || orders.length === 0) {
    return { total_orders: 0, delivered: 0, cancelled: 0, returned: 0, pending: 0, total_value: 0, addresses: [], names: [], first_order: null, last_order: null, campaigns: [] };
  }

  let delivered = 0, cancelled = 0, returned = 0, pending = 0, totalValue = 0;
  const addressSet = new Set<string>();
  const nameSet = new Set<string>();
  const campaignSet = new Set<string>();

  for (const o of orders) {
    const ds = (o.delivery_status || '').toLowerCase();
    if (ds === 'delivered') delivered++;
    else if (ds === 'cancelled') cancelled++;
    else if (ds === 'returned') returned++;
    else pending++;

    totalValue += Number(o.price || 0);
    if (o.address) addressSet.add(o.address);
    if (o.customer_name) nameSet.add(o.customer_name);
    if (o.campaign_id) campaignSet.add(o.campaign_id);
  }

  return {
    total_orders: orders.length,
    delivered,
    cancelled,
    returned,
    pending,
    total_value: totalValue,
    addresses: Array.from(addressSet).slice(0, 5),
    names: Array.from(nameSet).slice(0, 5),
    first_order: orders[orders.length - 1]?.created_at || null,
    last_order: orders[0]?.created_at || null,
    campaigns: Array.from(campaignSet),
  };
}

// --- Main handler ---

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number } = await req.json();
    if (!phone_number) {
      return new Response(JSON.stringify({ error: 'phone_number required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let phone = phone_number.replace(/\D/g, '');
    if (phone.startsWith('88')) phone = phone.slice(2);
    if (phone.startsWith('+88')) phone = phone.slice(3);
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      return new Response(JSON.stringify({ error: 'Invalid Bangladeshi phone number' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Run local DB check + courier config fetch in parallel
    const [localResult, settingsRes] = await Promise.all([
      checkLocalDb(phone, supabase),
      supabase.from('app_settings').select('value').eq('key', 'fraud_checker_config').maybeSingle(),
    ]);

    const config = settingsRes.data?.value as Record<string, string> | null;

    // Run courier checks in parallel (if configured)
    const courierPromises: Promise<CourierResult>[] = [];
    if (config) {
      if (config.steadfast_api_key && config.steadfast_secret_key) {
        courierPromises.push(checkSteadfast(phone, config.steadfast_api_key, config.steadfast_secret_key));
      }
      if (config.pathao_username && config.pathao_password) {
        courierPromises.push(checkPathao(phone, config.pathao_username, config.pathao_password));
      }
      if (config.redx_access_token) {
        courierPromises.push(checkRedx(phone, config.redx_access_token));
      }
    }

    const courierResults = courierPromises.length > 0 ? await Promise.all(courierPromises) : [];

    // Calculate courier totals
    let courierTotal = 0, courierSuccess = 0, courierCancel = 0;
    const couriers: Record<string, CourierResult> = {};
    for (const r of courierResults) {
      couriers[r.courier] = r;
      if (!r.error) {
        courierTotal += r.total;
        courierSuccess += r.success;
        courierCancel += r.cancel;
      }
    }

    // Combined intelligence: courier API + local DB
    const combinedTotal = courierTotal + localResult.total_orders;
    const combinedSuccess = courierSuccess + localResult.delivered;
    const combinedCancel = courierCancel + localResult.cancelled + localResult.returned;
    const combinedSuccessRate = combinedTotal > 0 ? (combinedSuccess / combinedTotal) * 100 : 0;
    const combinedCancelRate = combinedTotal > 0 ? (combinedCancel / combinedTotal) * 100 : 0;

    // Risk assessment based on combined data
    let riskLevel: string;
    let riskMessage: string;
    if (combinedTotal === 0) {
      riskLevel = 'new_customer';
      riskMessage = 'New customer — No delivery history found';
    } else if (combinedSuccessRate >= 80) {
      riskLevel = 'safe';
      riskMessage = 'Safe to deliver - High success rate';
    } else if (combinedSuccessRate >= 60) {
      riskLevel = 'moderate';
      riskMessage = 'Moderate risk - Average success rate';
    } else if (combinedSuccessRate >= 40) {
      riskLevel = 'risky';
      riskMessage = 'Risky - Low success rate';
    } else {
      riskLevel = 'dangerous';
      riskMessage = 'High risk - Very low success rate';
    }

    // Extra flags
    const multipleAddresses = localResult.addresses.length > 2;
    const multipleNames = localResult.names.length > 2;
    const flags: string[] = [];
    if (multipleAddresses) flags.push('multiple_addresses');
    if (multipleNames) flags.push('multiple_names');
    if (localResult.returned > 2) flags.push('frequent_returns');

    return new Response(JSON.stringify({
      status: true,
      data: {
        phone,
        couriers,
        courierSummary: {
          total: courierTotal,
          success: courierSuccess,
          cancel: courierCancel,
          successRate: Math.round((courierTotal > 0 ? (courierSuccess / courierTotal) * 100 : 0) * 100) / 100,
        },
        localDb: localResult,
        totalSummary: {
          total: combinedTotal,
          success: combinedSuccess,
          cancel: combinedCancel,
          successRate: Math.round(combinedSuccessRate * 100) / 100,
          cancelRate: Math.round(combinedCancelRate * 100) / 100,
        },
        riskLevel,
        riskMessage,
        flags,
      },
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
