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

    // Delete spam leads older than 24 hours — only those assigned to employee-panel agents
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
      return new Response(JSON.stringify({ success: true, deleted_count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: deleted, error } = await supabase
      .from("leads")
      .delete()
      .eq("is_spam", true)
      .lt("updated_at", cutoff)
      .in("assigned_to", agentIds)
      .select("id");

    if (error) {
      console.error("Error deleting spam leads:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const count = deleted?.length || 0;
    console.log(`Cleaned up ${count} spam leads older than 24h`);

    return new Response(
      JSON.stringify({ success: true, deleted_count: count }),
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
