import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ADMIN_EMAIL = "business.brand.qore@gmail.com";

async function sendOtpEmail(otp: string): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("[SETUP-VERIFICATION] RESEND_API_KEY not configured");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BrandQore <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject: `🔐 BrandQore Setup Verification Code: ${otp}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a2e; padding: 40px; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #ffffff; font-size: 24px; margin: 0;">BrandQore</h1>
              <p style="color: #a78bfa; font-size: 14px; margin: 4px 0 0;">Security Verification</p>
            </div>
            <div style="background: rgba(124,58,237,0.1); border: 1px solid rgba(124,58,237,0.2); border-radius: 12px; padding: 24px; text-align: center;">
              <p style="color: #ffffff; font-size: 14px; margin: 0 0 16px;">Your verification code is:</p>
              <div style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #a78bfa; font-family: monospace; padding: 16px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                ${otp}
              </div>
              <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 16px 0 0;">This code expires in 10 minutes.</p>
            </div>
            <p style="color: rgba(255,255,255,0.3); font-size: 11px; text-align: center; margin-top: 24px;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        `,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`[SETUP-VERIFICATION] OTP email sent successfully to ${ADMIN_EMAIL}`);
      return true;
    } else {
      console.error(`[SETUP-VERIFICATION] Resend API error:`, data);
      return false;
    }
  } catch (err) {
    console.error(`[SETUP-VERIFICATION] Email send error:`, err);
    return false;
  }
}

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

    // Generate OTP and send via email
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
          value: { code: otp, expires_at: expiresAt, email: ADMIN_EMAIL },
          updated_at: new Date().toISOString()
        }).eq('key', 'setup_otp');
      } else {
        await supabase.from('app_settings').insert({
          key: 'setup_otp',
          value: { code: otp, expires_at: expiresAt, email: ADMIN_EMAIL },
          updated_at: new Date().toISOString()
        });
      }

      // Send OTP via Resend
      const emailSent = await sendOtpEmail(otp);

      if (!emailSent) {
        console.log(`[SETUP-VERIFICATION] Email send failed. OTP for fallback: ${otp}`);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: emailSent ? 'Verification code sent to email' : 'Code generated (check logs)',
        emailSent 
      }), {
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
