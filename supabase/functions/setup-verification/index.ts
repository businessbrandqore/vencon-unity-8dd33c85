import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Fixed admin password for setup verification
const SETUP_PASSWORD = "BrandQore@2024";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { action, password, version } = body;

    // Check if setup is complete for given version
    if (action === 'check') {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'setup_completed_version')
        .single();

      const storedVersion = data?.value && typeof data.value === 'object' && 'version' in (data.value as object)
        ? (data.value as { version: string }).version
        : null;

      return new Response(JSON.stringify({ isComplete: storedVersion === version }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify password
    if (action === 'verify') {
      if (password !== SETUP_PASSWORD) {
        return new Response(JSON.stringify({ success: false, error: 'পাসওয়ার্ড ভুল হয়েছে। আবার চেষ্টা করুন।' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Mark setup as complete
    if (action === 'complete') {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'setup_completed_version')
        .single();

      const completionData = { version, completed_at: new Date().toISOString() };

      if (existing) {
        await supabase.from('app_settings').update({
          value: completionData,
          updated_at: new Date().toISOString()
        }).eq('key', 'setup_completed_version');
      } else {
        await supabase.from('app_settings').insert({
          key: 'setup_completed_version',
          value: completionData,
          updated_at: new Date().toISOString()
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[SETUP-VERIFICATION] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});