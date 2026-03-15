import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get FraudBD API key from app_settings
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settingsRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'fraud_checker_config')
      .maybeSingle();

    const config = settingsRow?.value as Record<string, string> | null;
    const apiKey = config?.fraudbd_api_key;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Fraud checker API key not configured. HR must set it in Settings.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call FraudBD API
    const fraudRes = await fetch('https://fraudbd.com/api/check-courier-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_key': apiKey,
      },
      body: JSON.stringify({ phone_number }),
    });

    const fraudData = await fraudRes.json();

    if (!fraudRes.ok) {
      return new Response(JSON.stringify({ error: 'FraudBD API error', details: fraudData }), {
        status: fraudRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(fraudData), {
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
