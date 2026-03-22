import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SETUP_PASSWORD = "BrandQore@2024";
const MAX_ATTEMPTS = 5;
const LOCKOUT_HOURS = 5;

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
    const { action, password, version, clientId, customMessage } = body;

    const checkLockout = async (cid: string) => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', `lockout_${cid}`)
        .single();

      if (!data?.value) return { locked: false, attempts: 0 };

      const val = data.value as { attempts: number; locked_until?: string };
      if (val.locked_until) {
        const until = new Date(val.locked_until);
        if (until > new Date()) {
          const remainMs = until.getTime() - Date.now();
          const remainMin = Math.ceil(remainMs / 60000);
          const remainHrs = Math.floor(remainMin / 60);
          const remainMins = remainMin % 60;
          return {
            locked: true,
            attempts: val.attempts,
            remainText: remainHrs > 0 ? `${remainHrs} ঘন্টা ${remainMins} মিনিট` : `${remainMins} মিনিট`,
          };
        }
        return { locked: false, attempts: 0 };
      }
      return { locked: false, attempts: val.attempts || 0 };
    };

    const recordFailedAttempt = async (cid: string, currentAttempts: number) => {
      const newAttempts = currentAttempts + 1;
      const val: { attempts: number; locked_until?: string; last_attempt: string } = {
        attempts: newAttempts,
        last_attempt: new Date().toISOString(),
      };

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_HOURS * 60 * 60 * 1000);
        val.locked_until = lockUntil.toISOString();
      }

      const { data: existing } = await supabase
        .from('app_settings').select('id').eq('key', `lockout_${cid}`).single();

      if (existing) {
        await supabase.from('app_settings').update({ value: val, updated_at: new Date().toISOString() }).eq('key', `lockout_${cid}`);
      } else {
        await supabase.from('app_settings').insert({ key: `lockout_${cid}`, value: val, updated_at: new Date().toISOString() });
      }

      return newAttempts;
    };

    const clearLockout = async (cid: string) => {
      await supabase.from('app_settings').delete().eq('key', `lockout_${cid}`);
    };

    // ── CHECK ──
    if (action === 'check') {
      const { data: lockData } = await supabase
        .from('app_settings').select('value').eq('key', 'site_locked').single();

      const isLocked = lockData?.value && typeof lockData.value === 'object' && 'locked' in (lockData.value as object)
        ? (lockData.value as { locked: boolean }).locked : false;

      const { data: versionData } = await supabase
        .from('app_settings').select('value').eq('key', 'setup_completed_version').single();

      const storedVersion = versionData?.value && typeof versionData.value === 'object' && 'version' in (versionData.value as object)
        ? (versionData.value as { version: string }).version : null;

      // Check if setup gate is disabled
      const { data: disabledData } = await supabase
        .from('app_settings').select('value').eq('key', 'setup_gate_disabled').single();

      const isDisabled = disabledData?.value && typeof disabledData.value === 'object' && 'disabled' in (disabledData.value as object)
        ? (disabledData.value as { disabled: boolean }).disabled : false;

      const { data: msgData } = await supabase
        .from('app_settings').select('value').eq('key', 'site_lock_message').single();

      const lockMessage = msgData?.value && typeof msgData.value === 'object' && 'message' in (msgData.value as object)
        ? (msgData.value as { message: string }).message : '';

      return new Response(JSON.stringify({
        isComplete: isDisabled ? true : (storedVersion === version),
        isLocked,
        lockMessage,
        isSetupDisabled: isDisabled,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── CHECK LOCKOUT ──
    if (action === 'check_lockout') {
      const cid = clientId || 'unknown';
      const lockout = await checkLockout(cid);
      return new Response(JSON.stringify(lockout), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── VERIFY PASSWORD ──
    if (action === 'verify') {
      const cid = clientId || 'unknown';
      const lockout = await checkLockout(cid);

      if (lockout.locked) {
        return new Response(JSON.stringify({
          success: false,
          blocked: true,
          error: `আপনি ${MAX_ATTEMPTS} বার ভুল পাসওয়ার্ড দিয়েছেন। ${lockout.remainText} পর আবার চেষ্টা করুন।`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (password !== SETUP_PASSWORD) {
        const newAttempts = await recordFailedAttempt(cid, lockout.attempts);
        const remaining = MAX_ATTEMPTS - newAttempts;

        if (remaining <= 0) {
          return new Response(JSON.stringify({
            success: false,
            blocked: true,
            error: `${MAX_ATTEMPTS} বার ভুল পাসওয়ার্ড! আপনি ${LOCKOUT_HOURS} ঘন্টার জন্য ব্লক হয়েছেন।`,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({
          success: false,
          error: `পাসওয়ার্ড ভুল হয়েছে। আর ${remaining} বার চেষ্টা করতে পারবেন।`,
          attemptsLeft: remaining,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      await clearLockout(cid);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── COMPLETE SETUP ──
    if (action === 'complete') {
      const { data: existing } = await supabase
        .from('app_settings').select('id').eq('key', 'setup_completed_version').single();

      const completionData = { version, completed_at: new Date().toISOString() };

      if (existing) {
        await supabase.from('app_settings').update({ value: completionData, updated_at: new Date().toISOString() }).eq('key', 'setup_completed_version');
      } else {
        await supabase.from('app_settings').insert({ key: 'setup_completed_version', value: completionData, updated_at: new Date().toISOString() });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── DISABLE SETUP GATE (password required) ──
    if (action === 'disable_setup_gate') {
      if (password !== SETUP_PASSWORD) {
        return new Response(JSON.stringify({ success: false, error: 'পাসওয়ার্ড ভুল' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const val = { disabled: true, disabled_at: new Date().toISOString() };
      const { data: existing } = await supabase
        .from('app_settings').select('id').eq('key', 'setup_gate_disabled').single();

      if (existing) {
        await supabase.from('app_settings').update({ value: val, updated_at: new Date().toISOString() }).eq('key', 'setup_gate_disabled');
      } else {
        await supabase.from('app_settings').insert({ key: 'setup_gate_disabled', value: val, updated_at: new Date().toISOString() });
      }

      return new Response(JSON.stringify({ success: true, message: 'সেটআপ গেট নিষ্ক্রিয় করা হয়েছে' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── ENABLE SETUP GATE (password required) ──
    if (action === 'enable_setup_gate') {
      if (password !== SETUP_PASSWORD) {
        return new Response(JSON.stringify({ success: false, error: 'পাসওয়ার্ড ভুল' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const val = { disabled: false, enabled_at: new Date().toISOString() };
      const { data: existing } = await supabase
        .from('app_settings').select('id').eq('key', 'setup_gate_disabled').single();

      if (existing) {
        await supabase.from('app_settings').update({ value: val, updated_at: new Date().toISOString() }).eq('key', 'setup_gate_disabled');
      } else {
        await supabase.from('app_settings').insert({ key: 'setup_gate_disabled', value: val, updated_at: new Date().toISOString() });
      }

      // Also reset the completed version so next enable triggers wizard
      await supabase.from('app_settings').update({ value: { version: '__reset__' }, updated_at: new Date().toISOString() }).eq('key', 'setup_completed_version');

      return new Response(JSON.stringify({ success: true, message: 'সেটআপ গেট সক্রিয় করা হয়েছে' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── SET CUSTOM MESSAGE ──
    if (action === 'set_message') {
      if (password !== SETUP_PASSWORD) {
        return new Response(JSON.stringify({ success: false, error: 'পাসওয়ার্ড ভুল' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const msgVal = { message: customMessage || '', updated_at: new Date().toISOString() };
      const { data: existing } = await supabase
        .from('app_settings').select('id').eq('key', 'site_lock_message').single();

      if (existing) {
        await supabase.from('app_settings').update({ value: msgVal, updated_at: new Date().toISOString() }).eq('key', 'site_lock_message');
      } else {
        await supabase.from('app_settings').insert({ key: 'site_lock_message', value: msgVal, updated_at: new Date().toISOString() });
      }

      return new Response(JSON.stringify({ success: true, message: 'মেসেজ সেট হয়েছে' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── LOCK SITE ──
    if (action === 'lock') {
      if (password !== SETUP_PASSWORD) {
        return new Response(JSON.stringify({ success: false, error: 'পাসওয়ার্ড ভুল' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: existing } = await supabase
        .from('app_settings').select('id').eq('key', 'site_locked').single();
      const lockData = { locked: true, locked_at: new Date().toISOString(), locked_by: 'BrandQore' };

      if (existing) {
        await supabase.from('app_settings').update({ value: lockData, updated_at: new Date().toISOString() }).eq('key', 'site_locked');
      } else {
        await supabase.from('app_settings').insert({ key: 'site_locked', value: lockData, updated_at: new Date().toISOString() });
      }

      return new Response(JSON.stringify({ success: true, message: 'সাইট লক করা হয়েছে' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── UNLOCK SITE ──
    if (action === 'unlock') {
      if (password !== SETUP_PASSWORD) {
        return new Response(JSON.stringify({ success: false, error: 'পাসওয়ার্ড ভুল' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: existing } = await supabase
        .from('app_settings').select('id').eq('key', 'site_locked').single();
      const unlockData = { locked: false, unlocked_at: new Date().toISOString() };

      if (existing) {
        await supabase.from('app_settings').update({ value: unlockData, updated_at: new Date().toISOString() }).eq('key', 'site_locked');
      } else {
        await supabase.from('app_settings').insert({ key: 'site_locked', value: unlockData, updated_at: new Date().toISOString() });
      }

      return new Response(JSON.stringify({ success: true, message: 'সাইট আনলক করা হয়েছে' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[SETUP-VERIFICATION] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});