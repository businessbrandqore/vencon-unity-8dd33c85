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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { order_id, recipient_name, recipient_phone, recipient_address, cod_amount, note, sent_by } = await req.json();

    // Get SteadFast API keys from app_settings
    const { data: sfSettings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "steadfast_api")
      .single();

    const apiKey = sfSettings?.value?.api_key;
    const secretKey = sfSettings?.value?.secret_key;

    if (!apiKey || !secretKey) {
      // Mark as failed
      await supabase.from("orders").update({ steadfast_send_failed: true }).eq("id", order_id);
      return new Response(JSON.stringify({ success: false, error: "SteadFast API keys not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Retry up to 3 times
    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch("https://portal.steadfast.com.bd/api/v1/create_order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": apiKey,
            "Secret-Key": secretKey,
          },
          body: JSON.stringify({
            invoice: order_id,
            recipient_name,
            recipient_phone,
            recipient_address,
            cod_amount: cod_amount || 0,
            note: note || "",
          }),
        });

        const data = await response.json();

        if (response.ok && data.status === 200) {
          const consignmentId = data.consignment?.consignment_id || data.consignment_id || `SF-${Date.now()}`;

          // Update order to dispatched
          await supabase.from("orders").update({
            steadfast_consignment_id: consignmentId,
            status: "dispatched",
            delivery_status: "pending",
            warehouse_sent_by: sent_by,
            warehouse_sent_at: new Date().toISOString(),
            steadfast_send_failed: false,
          }).eq("id", order_id);

          return new Response(JSON.stringify({ success: true, consignment_id: consignmentId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        lastError = JSON.stringify(data);
      } catch (e) {
        lastError = e.message;
      }

      // Wait 1 second before retry
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000));
    }

    // All retries failed
    await supabase.from("orders").update({ steadfast_send_failed: true }).eq("id", order_id);

    // Log failure
    await supabase.from("audit_logs").insert({
      action: "steadfast_send_failed",
      target_table: "orders",
      target_id: order_id,
      actor_id: sent_by,
      details: { error: lastError, attempts: 3 },
    });

    // Notify SA and HR
    const { data: admins } = await supabase
      .from("users")
      .select("id")
      .in("panel", ["sa", "hr"]);

    if (admins) {
      const notifications = admins.map((a: { id: string }) => ({
        user_id: a.id,
        title: `SteadFast send failed — Order ${order_id.slice(0, 8)}`,
        message: `SteadFast-এ অর্ডার পাঠাতে ব্যর্থ হয়েছে। Error: ${lastError}`,
        type: "error",
      }));
      await supabase.from("notifications").insert(notifications);
    }

    return new Response(JSON.stringify({ success: false, error: lastError }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
