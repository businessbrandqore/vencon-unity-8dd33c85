import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { template_id, recipient_phone, lead_name, lead_address } = await req.json();

    if (!template_id || !recipient_phone) {
      return new Response(
        JSON.stringify({ error: "template_id and recipient_phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get template
    const { data: template, error: tplError } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("id", template_id)
      .single();

    if (tplError || !template) {
      return new Response(
        JSON.stringify({ error: "Template not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp API config
    const { data: apiConfig } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "api_config")
      .single();

    const config = apiConfig?.value as Record<string, string> | null;
    const senderNumber = config?.whatsapp_sender;
    const apiKey = config?.whatsapp_api_key;

    // Replace placeholders in template body
    let messageBody = template.body
      .replace(/\{\{name\}\}/g, lead_name || "")
      .replace(/\{\{phone\}\}/g, recipient_phone || "")
      .replace(/\{\{address\}\}/g, lead_address || "");

    // If no WhatsApp Business API configured, return wa.me link
    if (!senderNumber || !apiKey) {
      const encodedMsg = encodeURIComponent(messageBody);
      const cleanPhone = recipient_phone.replace(/[^0-9]/g, "");
      const waLink = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;

      return new Response(
        JSON.stringify({
          success: true,
          method: "wa_link",
          wa_link: waLink,
          message: messageBody,
          image_url: template.image_url,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // WhatsApp Business API sending (Meta Cloud API)
    // The apiKey should be the permanent access token from Meta
    const cleanPhone = recipient_phone.replace(/[^0-9]/g, "");
    const phoneId = senderNumber; // In Meta API, sender is the phone number ID

    // Send text message
    const waResponse = await fetch(
      `https://graph.facebook.com/v18.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: template.image_url ? "image" : "text",
          ...(template.image_url
            ? {
                image: {
                  link: template.image_url,
                  caption: messageBody,
                },
              }
            : {
                text: { body: messageBody },
              }),
        }),
      }
    );

    const waData = await waResponse.json();

    if (!waResponse.ok) {
      console.error("WhatsApp API error:", waData);
      return new Response(
        JSON.stringify({ error: "WhatsApp API error", details: waData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, method: "api", data: waData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
