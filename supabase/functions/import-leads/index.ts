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
    // Support: /import-leads/{campaignId} or /import-leads/{campaignId}/{websiteId}
    const lastPart = pathParts[pathParts.length - 1];
    const secondLast = pathParts[pathParts.length - 2];

    let campaignId: string;
    let websiteId: string | null = null;

    // Detect if path has websiteId (UUID format check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(lastPart) && uuidRegex.test(secondLast)) {
      // /import-leads/{campaignId}/{websiteId}
      campaignId = secondLast;
      websiteId = lastPart;
    } else if (uuidRegex.test(lastPart)) {
      // /import-leads/{campaignId}
      campaignId = lastPart;
    } else {
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
      .select("id, status, webhook_secret, data_mode")
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

    // Determine data_mode and validate secret
    let dataMode: string = campaign.data_mode || "lead";
    let sourceName = "wordpress_webhook";
    let validSecret = false;

    if (websiteId) {
      // Website-level validation
      const { data: website } = await supabase
        .from("campaign_websites")
        .select("id, webhook_secret, is_active, data_mode, site_name")
        .eq("id", websiteId)
        .eq("campaign_id", campaignId)
        .single();

      if (!website) {
        return new Response(
          JSON.stringify({ error: "Website not found for this campaign" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!website.is_active) {
        return new Response(
          JSON.stringify({ error: "Website integration is inactive" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (website.webhook_secret === webhookSecret) {
        validSecret = true;
        dataMode = website.data_mode || campaign.data_mode || "lead";
        sourceName = website.site_name || "wordpress_webhook";
      }
    } else {
      // Try campaign-level secret first
      if (campaign.webhook_secret === webhookSecret) {
        validSecret = true;
      } else {
        // Try matching against any campaign_website secret
        const { data: websites } = await supabase
          .from("campaign_websites")
          .select("id, webhook_secret, is_active, data_mode, site_name")
          .eq("campaign_id", campaignId)
          .eq("is_active", true);

        const matchedSite = (websites || []).find(w => w.webhook_secret === webhookSecret);
        if (matchedSite) {
          validSecret = true;
          dataMode = matchedSite.data_mode || campaign.data_mode || "lead";
          sourceName = matchedSite.site_name || "wordpress_webhook";
        }
      }
    }

    if (!validSecret) {
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

      // Insert lead with proper source/import_source based on data_mode
      const { error: insertError } = await supabase.from("leads").insert({
        name: lead.customer_name,
        phone: phone,
        address: [lead.address, lead.city].filter(Boolean).join(", ") || null,
        campaign_id: campaignId,
        source: dataMode === "processing" ? "processing" : "wordpress_webhook",
        import_source: dataMode === "processing" ? "processing" : "webhook",
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
      source: `webhook_${dataMode}`,
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
        data_mode: dataMode,
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
