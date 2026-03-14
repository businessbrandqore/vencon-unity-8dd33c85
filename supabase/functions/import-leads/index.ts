import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// Auto-detect field names dynamically
function findField(obj: Record<string, unknown>, patterns: string[]): string {
  // Exact match first
  for (const pattern of patterns) {
    const p = pattern.toLowerCase();
    for (const [key, val] of Object.entries(obj)) {
      if (key.toLowerCase() === p && val != null && String(val).trim() !== "") {
        return String(val).trim();
      }
    }
  }
  // Fuzzy: check if key contains pattern
  for (const pattern of patterns) {
    const p = pattern.toLowerCase();
    for (const [key, val] of Object.entries(obj)) {
      if (key.toLowerCase().includes(p) && val != null && String(val).trim() !== "") {
        return String(val).trim();
      }
    }
  }
  return "";
}

function extractName(obj: Record<string, unknown>): string {
  // Try direct name field first
  const directName = findField(obj, ["customer_name", "name", "full_name", "billing_name"]);
  if (directName) return directName;

  // Try combining first + last name
  const firstName = findField(obj, ["first_name", "billing_first_name", "fname", "billing.first_name"]);
  const lastName = findField(obj, ["last_name", "billing_last_name", "lname", "billing.last_name"]);
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");

  return "";
}

function extractPhone(obj: Record<string, unknown>): string {
  const raw = findField(obj, [
    "phone", "billing_phone", "billing.phone", "tel", "mobile",
    "phone_number", "contact", "billing_phone_number",
    "wcf_phone", "wcf_billing_phone"
  ]);
  // Clean phone: remove non-digit chars except leading +
  if (raw) {
    const cleaned = raw.replace(/[^\d+]/g, "");
    // Validate: must be at least 7 digits
    if (cleaned.replace(/\D/g, "").length >= 7) {
      return cleaned;
    }
  }
  return raw; // Return raw even if short, let downstream handle
}

function extractAddress(obj: Record<string, unknown>): string {
  // Try direct address
  const direct = findField(obj, ["address", "full_address"]);
  if (direct) return direct;

  // Build from parts - include more WooCommerce/CartFlows patterns
  const parts = [
    findField(obj, ["address_1", "billing_address_1", "billing.address_1", "address1", "street"]),
    findField(obj, ["address_2", "billing_address_2", "billing.address_2", "address2"]),
    findField(obj, ["city", "billing_city", "billing.city", "town"]),
    findField(obj, ["state", "billing_state", "billing.state", "district"]),
    findField(obj, ["postcode", "billing_postcode", "billing.postcode", "zip"]),
    findField(obj, ["country", "billing_country", "billing.country"]),
  ].filter(Boolean);

  return parts.join(", ") || "";
}

function flattenObject(obj: unknown, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (val && typeof val === "object" && !Array.isArray(val)) {
        Object.assign(result, flattenObject(val, newKey));
      } else {
        result[newKey] = val;
      }
    }
  }
  return result;
}

// Extract from WooCommerce-style nested billing object
function extractFromBilling(rawLead: Record<string, unknown>): { name: string; phone: string; address: string } {
  const billing = rawLead.billing as Record<string, unknown> | undefined;
  if (!billing || typeof billing !== "object") return { name: "", phone: "", address: "" };

  const firstName = String(billing.first_name || "").trim();
  const lastName = String(billing.last_name || "").trim();
  const name = [firstName, lastName].filter(Boolean).join(" ");
  const phone = String(billing.phone || "").trim();
  const address = [
    billing.address_1, billing.address_2, billing.city, billing.state, billing.postcode, billing.country
  ].filter(Boolean).map(v => String(v).trim()).join(", ");

  return { name, phone, address };
}

// Extract from extra_fields nested object (our PHP snippet format)
function extractFromExtraFields(rawLead: Record<string, unknown>): Record<string, unknown> {
  const extra = rawLead.extra_fields as Record<string, unknown> | undefined;
  if (!extra || typeof extra !== "object") return {};
  return extra;
}

function extractOrderId(rawLead: Record<string, unknown>): string | null {
  const merged: Record<string, unknown> = {
    ...flattenObject(rawLead),
    ...rawLead,
    ...extractFromExtraFields(rawLead),
  };

  const orderId = findField(merged, [
    "order_id",
    "extra_fields.order_id",
    "wc_order_id",
    "woocommerce_order_id",
    "wcf_order_id",
  ]);

  if (!orderId) return null;
  const normalized = orderId.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return normalized || null;
}

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
    const lastPart = pathParts[pathParts.length - 1];
    const secondLast = pathParts[pathParts.length - 2];

    let campaignId: string;
    let websiteId: string | null = null;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(lastPart) && uuidRegex.test(secondLast)) {
      campaignId = secondLast;
      websiteId = lastPart;
    } else if (uuidRegex.test(lastPart)) {
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
      if (campaign.webhook_secret === webhookSecret) {
        validSecret = true;
      } else {
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

    console.log(`[import-leads] Received ${leads.length} lead(s) for campaign ${campaignId}, mode: ${dataMode}`);
    if (leads.length > 0) {
      console.log("[import-leads] Sample payload keys:", Object.keys(leads[0]));
      console.log("[import-leads] Sample payload:", JSON.stringify(leads[0]).slice(0, 500));
    }

    let imported = 0;
    let skippedDuplicates = 0;

    for (const rawLead of leads) {
      // Strategy 1: Check for our PHP snippet format (customer_name, phone, address, extra_fields)
      let name = "";
      let phone = "";
      let address = "";

      if (rawLead.customer_name || rawLead.phone) {
        // Our PHP snippet sends data in this format
        name = String(rawLead.customer_name || "").trim();
        phone = String(rawLead.phone || "").trim();
        address = String(rawLead.address || "").trim();
        console.log("[import-leads] Using direct fields: name=", name, "phone=", phone);
      }

      // Strategy 2: Check for WooCommerce REST API / nested billing object
      if (!phone && rawLead.billing && typeof rawLead.billing === "object") {
        const billingData = extractFromBilling(rawLead as Record<string, unknown>);
        name = name || billingData.name;
        phone = phone || billingData.phone;
        address = address || billingData.address;
        console.log("[import-leads] Using billing object: name=", name, "phone=", phone);
      }

      // Strategy 3: Flatten and fuzzy match
      if (!phone && !name) {
        const lead = { ...flattenObject(rawLead) };
        for (const [k, v] of Object.entries(rawLead)) {
          if (!(k in lead)) lead[k] = v;
        }
        // Also merge extra_fields into flat object for searching
        const extraFields = extractFromExtraFields(rawLead as Record<string, unknown>);
        for (const [k, v] of Object.entries(extraFields)) {
          if (!(k in lead)) lead[k] = v;
        }

        name = extractName(lead);
        phone = extractPhone(lead);
        address = address || extractAddress(lead);
        console.log("[import-leads] Using fuzzy match: name=", name, "phone=", phone);
      }

      // Must have at least phone or name
      if (!phone && !name) {
        console.log("[import-leads] Skipped - no name or phone found in:", JSON.stringify(rawLead).slice(0, 200));
        skippedDuplicates++;
        continue;
      }

      const phoneClean = phone ? String(phone).trim() : "";
      const orderId = extractOrderId(rawLead as Record<string, unknown>);

      // Duplicate check priority:
      // 1) If order_id exists -> dedupe by order_id in recent payloads
      // 2) Else fallback to short-window phone dedupe (15 minutes)
      if (orderId) {
        const numericPattern = `%\"order_id\":${orderId}%`;
        const stringPattern = `%\"order_id\":\"${orderId}\"%`;

        const { count: orderDupCount } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .or(`special_note.ilike.${numericPattern},special_note.ilike.${stringPattern}`)
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        if ((orderDupCount ?? 0) > 0) {
          skippedDuplicates++;
          continue;
        }
      } else if (phoneClean) {
        const { count: phoneDupCount } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("phone", phoneClean)
          .eq("campaign_id", campaignId)
          .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

        if ((phoneDupCount ?? 0) > 0) {
          skippedDuplicates++;
          continue;
        }
      }

      // Store ALL raw data as JSON in special_note — nothing is lost
      const specialNote = JSON.stringify(rawLead);

      const { error: insertError } = await supabase.from("leads").insert({
        name: name || null,
        phone: phoneClean || null,
        address: address || null,
        campaign_id: campaignId,
        source: dataMode === "processing" ? "processing" : sourceName,
        import_source: dataMode === "processing" ? "processing" : "webhook",
        special_note: specialNote,
        status: "fresh",
      });

      if (!insertError) {
        imported++;
      } else {
        console.error("Insert error:", insertError);
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
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
