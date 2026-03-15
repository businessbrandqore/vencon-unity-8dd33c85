import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
    const { action, code, version } = body;

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

    // Generate OTP and store
    if (action === 'generate') {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Upsert OTP into app_settings
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'setup_otp')
        .single();

      if (existing) {
        await supabase.from('app_settings').update({
          value: { code: otp, expires_at: expiresAt, email: 'business.brand.qore@gmail.com' },
          updated_at: new Date().toISOString()
        }).eq('key', 'setup_otp');
      } else {
        await supabase.from('app_settings').insert({
          key: 'setup_otp',
          value: { code: otp, expires_at: expiresAt, email: 'business.brand.qore@gmail.com' },
          updated_at: new Date().toISOString()
        });
      }

      console.log(`[SETUP-VERIFICATION] OTP generated for business.brand.qore@gmail.com: ${otp}`);

      // Try to send OTP via Supabase Auth magic link (will send a real email)
      try {
        await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: 'business.brand.qore@gmail.com',
        });
        // The magic link email is sent by Supabase's built-in email
        // We're using our own OTP code separately
        console.log(`[SETUP-VERIFICATION] Auth email triggered for business.brand.qore@gmail.com`);
      } catch (emailErr) {
        console.log(`[SETUP-VERIFICATION] Auth email failed, OTP available in logs: ${otp}`);
      }

      return new Response(JSON.stringify({ success: true, message: 'Verification code generated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify submitted OTP
    if (action === 'verify') {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'setup_otp')
        .single();

      if (!data?.value) {
        return new Response(JSON.stringify({ success: false, error: 'No verification code found. Please request a new one.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const otpData = data.value as { code: string; expires_at: string };

      if (new Date() > new Date(otpData.expires_at)) {
        return new Response(JSON.stringify({ success: false, error: 'Code expired. Please request a new one.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (otpData.code !== code) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid code. Please try again.' }), {
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

      // Clean up OTP
      await supabase.from('app_settings').delete().eq('key', 'setup_otp');

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
