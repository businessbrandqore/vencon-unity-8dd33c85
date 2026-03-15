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

async function checkSteadfast(phone: string, apiKey: string, secretKey: string): Promise<CourierResult> {
  try {
    const res = await fetch(`https://portal.steadfast.com.bd/api/v1/fraud_check/${phone}`, {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      return { courier: 'Steadfast', total: 0, success: 0, cancel: 0, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const total = data.Total_parcels ?? data.total_parcels ?? 0;
    const delivered = data.total_delivered ?? 0;
    const cancelled = data.total_cancelled ?? 0;
    return { courier: 'Steadfast', total, success: delivered, cancel: cancelled };
  } catch (err) {
    return { courier: 'Steadfast', total: 0, success: 0, cancel: 0, error: err.message };
  }
}

async function checkPathao(phone: string, username: string, password: string): Promise<CourierResult> {
  try {
    // Step 1: Login
    const loginRes = await fetch('https://merchant.pathao.com/api/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!loginRes.ok) {
      return { courier: 'Pathao', total: 0, success: 0, cancel: 0, error: `Login failed: HTTP ${loginRes.status}` };
    }
    const loginData = await loginRes.json();
    const token = loginData.access_token;
    if (!token) {
      return { courier: 'Pathao', total: 0, success: 0, cancel: 0, error: 'No access token' };
    }

    // Step 2: Check user success
    const checkRes = await fetch('https://merchant.pathao.com/api/v1/user/success', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ phone }),
    });
    if (!checkRes.ok) {
      return { courier: 'Pathao', total: 0, success: 0, cancel: 0, error: `Check failed: HTTP ${checkRes.status}` };
    }
    const checkData = await checkRes.json();
    const customer = checkData?.data?.customer;
    if (!customer) {
      return { courier: 'Pathao', total: 0, success: 0, cancel: 0, error: 'No customer data' };
    }
    const total = customer.total_delivery ?? 0;
    const success = customer.successful_delivery ?? 0;
    return { courier: 'Pathao', total, success, cancel: total - success };
  } catch (err) {
    return { courier: 'Pathao', total: 0, success: 0, cancel: 0, error: err.message };
  }
}

async function checkRedx(phone: string, accessToken: string): Promise<CourierResult> {
  try {
    const res = await fetch(`https://openapi.redx.com.bd/v1.0.0-beta/parcel/tracking?customer_phone=${phone}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      return { courier: 'RedX', total: 0, success: 0, cancel: 0, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    // Parse RedX response - count parcels by status
    const parcels = data?.parcels || data?.data || [];
    if (!Array.isArray(parcels)) {
      // If the response is a single summary object
      return {
        courier: 'RedX',
        total: data.total_parcels ?? data.total ?? 0,
        success: data.total_delivered ?? data.delivered ?? 0,
        cancel: data.total_cancelled ?? data.cancelled ?? data.returned ?? 0,
      };
    }
    let total = parcels.length;
    let success = 0;
    let cancel = 0;
    for (const p of parcels) {
      const status = (p.parcel_status || p.status || '').toLowerCase();
      if (status === 'delivered' || status === 'delivery_completed') success++;
      if (status === 'cancelled' || status === 'returned' || status === 'return_completed') cancel++;
    }
    return { courier: 'RedX', total, success, cancel };
  } catch (err) {
    return { courier: 'RedX', total: 0, success: 0, cancel: 0, error: err.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number } = await req.json();
    if (!phone_number) {
      return new Response(JSON.stringify({ error: 'phone_number required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean phone number
    let phone = phone_number.replace(/\D/g, '');
    if (phone.startsWith('88')) phone = phone.slice(2);
    if (phone.startsWith('+88')) phone = phone.slice(3);
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      return new Response(JSON.stringify({ error: 'Invalid Bangladeshi phone number' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get courier API configs from app_settings
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settingsRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'fraud_checker_config')
      .maybeSingle();

    const config = settingsRow?.value as Record<string, string> | null;

    if (!config) {
      return new Response(JSON.stringify({ error: 'Fraud checker not configured. HR must set courier API keys in Settings.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Run all courier checks in parallel
    const promises: Promise<CourierResult>[] = [];

    if (config.steadfast_api_key && config.steadfast_secret_key) {
      promises.push(checkSteadfast(phone, config.steadfast_api_key, config.steadfast_secret_key));
    }
    if (config.pathao_username && config.pathao_password) {
      promises.push(checkPathao(phone, config.pathao_username, config.pathao_password));
    }
    if (config.redx_access_token) {
      promises.push(checkRedx(phone, config.redx_access_token));
    }

    if (promises.length === 0) {
      return new Response(JSON.stringify({ error: 'No courier API keys configured. HR must set at least one courier API in Settings.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = await Promise.all(promises);

    // Calculate totals
    let totalOrders = 0;
    let totalSuccess = 0;
    let totalCancel = 0;

    const couriers: Record<string, CourierResult> = {};
    for (const r of results) {
      couriers[r.courier] = r;
      if (!r.error) {
        totalOrders += r.total;
        totalSuccess += r.success;
        totalCancel += r.cancel;
      }
    }

    const successRate = totalOrders > 0 ? (totalSuccess / totalOrders) * 100 : 0;
    const cancelRate = totalOrders > 0 ? (totalCancel / totalOrders) * 100 : 0;

    let riskLevel: string;
    let riskMessage: string;
    if (totalOrders === 0) {
      riskLevel = 'new_customer';
      riskMessage = 'New customer — No delivery history found';
    } else if (successRate >= 80) {
      riskLevel = 'safe';
      riskMessage = 'Safe to deliver - High success rate';
    } else if (successRate >= 60) {
      riskLevel = 'moderate';
      riskMessage = 'Moderate risk - Average success rate';
    } else if (successRate >= 40) {
      riskLevel = 'risky';
      riskMessage = 'Risky - Low success rate';
    } else {
      riskLevel = 'dangerous';
      riskMessage = 'High risk - Very low success rate';
    }

    return new Response(JSON.stringify({
      status: true,
      data: {
        phone: phone,
        couriers,
        totalSummary: {
          total: totalOrders,
          success: totalSuccess,
          cancel: totalCancel,
          successRate: Math.round(successRate * 100) / 100,
          cancelRate: Math.round(cancelRate * 100) / 100,
        },
        riskLevel,
        riskMessage,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
