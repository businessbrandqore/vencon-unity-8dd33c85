import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_REQUEUE_STATUSES = [
  "phone_off", "positive", "customer_reschedule",
  "do_not_pick", "no_response", "busy_now", "number_busy",
];
const DEFAULT_THRESHOLD = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Load per-role delete sheet config
    const { data: configRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "delete_sheet_config")
      .maybeSingle();

    const configVal = configRow?.value as any;
    const rules: { role: string; statuses: string[]; threshold: number }[] =
      configVal?.rules && Array.isArray(configVal.rules) ? configVal.rules : [];

    // Collect all statuses from rules, or use defaults
    const allStatuses = rules.length > 0
      ? [...new Set(rules.flatMap((r: any) => r.statuses || []))]
      : (configVal?.statuses || DEFAULT_REQUEUE_STATUSES);

    // Find leads whose requeue time has passed
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, name, assigned_to, tl_id, requeue_count, status, agent_type")
      .in("status", allStatuses)
      .not("requeue_at", "is", null)
      .lte("requeue_at", new Date().toISOString());

    if (error) {
      console.error("Query error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper: get threshold for a lead based on agent_type/role
    const getThreshold = (agentType: string | null): number => {
      if (rules.length > 0 && agentType) {
        const rule = rules.find((r: any) => r.role === agentType);
        if (rule) return rule.threshold;
      }
      return configVal?.threshold || DEFAULT_THRESHOLD;
    };

    let reactivated = 0;
    let movedToDelete = 0;

    for (const lead of leads) {
      const count = lead.requeue_count || 0;
      const leadName = lead.name || "Unknown";
      const threshold = getThreshold(lead.agent_type);

      if (count >= threshold) {
        // Move to TL Delete Sheet
        await supabase
          .from("leads")
          .update({
            status: "tl_delete_sheet",
            requeue_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", lead.id);

        // Notify TL
        if (lead.tl_id) {
          await supabase.from("notifications").insert({
            user_id: lead.tl_id,
            title: `${leadName} — TL Delete Sheet`,
            message: `${leadName} এর lead ${threshold} বার retry হয়েছে। TL Delete Sheet-এ দেখুন।`,
            type: "warning",
          });
        }
        movedToDelete++;
      } else {
        // Reactivate lead
        await supabase
          .from("leads")
          .update({
            requeue_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", lead.id);

        // Notify agent
        if (lead.assigned_to) {
          await supabase.from("notifications").insert({
            user_id: lead.assigned_to,
            title: "Lead আবার available",
            message: `${leadName}-এর lead আবার available হয়েছে`,
            type: "info",
          });
        }
        reactivated++;
      }
    }

    return new Response(
      JSON.stringify({ processed: leads.length, reactivated, movedToDelete }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
