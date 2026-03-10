import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const campaignId = pathParts[pathParts.length - 1];

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Campaign ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookSecret = req.headers.get("x-webhook-secret");
    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: "X-Webhook-Secret header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate campaign
    const { data: campaign, error: campError } = await supabase
      .from("campaigns")
      .select("id, status, webhook_secret")
      .eq("id", campaignId)
      .single();

    if (campError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (campaign.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Campaign is not active" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (campaign.webhook_secret !== webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Invalid webhook secret" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body — accept single object or array
    const body = await req.json();
    const leads = Array.isArray(body) ? body : [body];

    let imported = 0;
    let skippedDuplicates = 0;

    for (const lead of leads) {
      if (!lead.customer_name || !lead.phone) {
        skippedDuplicates++;
        continue;
      }

      const phone = String(lead.phone).trim();

      // Duplicate check: same phone + campaign within 30 days
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("phone", phone)
        .eq("campaign_id", campaignId)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if ((count ?? 0) > 0) {
        skippedDuplicates++;
        continue;
      }

      // Insert lead
      const { error: insertError } = await supabase.from("leads").insert({
        name: lead.customer_name,
        phone: phone,
        address: [lead.address, lead.city].filter(Boolean).join(", ") || null,
        campaign_id: campaignId,
        source: "wordpress_webhook",
        import_source: "webhook",
        special_note: lead.extra_fields
          ? JSON.stringify(lead.extra_fields)
          : null,
        status: "fresh",
      });

      if (!insertError) {
        imported++;
      }
    }

    // Log the import
    await supabase.from("lead_import_logs").insert({
      campaign_id: campaignId,
      source: "webhook",
      leads_imported: imported,
      duplicates_skipped: skippedDuplicates,
      total_received: leads.length,
      status: imported > 0 ? "success" : skippedDuplicates > 0 ? "all_duplicates" : "failed",
    });

    return new Response(
      JSON.stringify({
        imported,
        skipped_duplicates: skippedDuplicates,
        total: leads.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
