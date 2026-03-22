import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get all employee-panel user IDs (agents)
    const { data: agents, error: agentErr } = await supabase
      .from("users")
      .select("id")
      .eq("panel", "employee");

    if (agentErr) {
      console.error("Error fetching agents:", agentErr);
      return new Response(JSON.stringify({ error: agentErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agentIds = (agents || []).map((a: any) => a.id);
    if (agentIds.length === 0) {
      return new Response(JSON.stringify({ success: true, transferred_count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find spam leads older than 24h from agents that haven't been transferred yet
    const { data: spamLeads, error: fetchErr } = await supabase
      .from("leads")
      .select("id, assigned_to, tl_id, campaign_id")
      .eq("is_spam", true)
      .is("spam_transferred_at", null)
      .lt("updated_at", cutoff)
      .in("assigned_to", agentIds);

    if (fetchErr) {
      console.error("Error fetching spam leads:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!spamLeads || spamLeads.length === 0) {
      return new Response(JSON.stringify({ success: true, transferred_count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let transferredCount = 0;

    // For each spam lead, find the TL and transfer
    for (const lead of spamLeads) {
      let tlId = lead.tl_id;

      // If no tl_id on lead, find TL from campaign_agent_roles
      if (!tlId && lead.assigned_to) {
        const { data: roles } = await supabase
          .from("campaign_agent_roles")
          .select("tl_id")
          .eq("agent_id", lead.assigned_to)
          .limit(1);
        if (roles && roles.length > 0) {
          tlId = roles[0].tl_id;
        }
      }

      // Transfer: save original agent, set spam_transferred_at, keep is_spam=true
      // Set tl_id so TL can see it via RLS, clear assigned_to
      const { error: updateErr } = await supabase
        .from("leads")
        .update({
          spam_original_agent: lead.assigned_to,
          spam_transferred_at: new Date().toISOString(),
          assigned_to: null,
          tl_id: tlId,
        })
        .eq("id", lead.id);

      if (!updateErr) {
        transferredCount++;
      } else {
        console.error(`Error transferring lead ${lead.id}:`, updateErr);
      }
    }

    console.log(`Transferred ${transferredCount} spam leads to TL/ATL`);

    return new Response(
      JSON.stringify({ success: true, transferred_count: transferredCount }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
