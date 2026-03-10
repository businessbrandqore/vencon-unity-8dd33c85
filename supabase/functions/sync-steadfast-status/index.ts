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

    // Get SteadFast API keys
    const { data: sfSettings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "steadfast_api")
      .single();

    const apiKey = (sfSettings?.value as Record<string, string>)?.api_key;
    const secretKey = (sfSettings?.value as Record<string, string>)?.secret_key;

    if (!apiKey || !secretKey) {
      return new Response(JSON.stringify({ error: "SteadFast API not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all dispatched orders with consignment IDs
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, steadfast_consignment_id, delivery_status, product, quantity")
      .eq("status", "dispatched")
      .not("steadfast_consignment_id", "is", null)
      .in("delivery_status", ["pending", "in_transit"]);

    if (error || !orders || orders.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updated = 0;

    for (const order of orders) {
      try {
        const response = await fetch(
          `https://portal.steadfast.com.bd/api/v1/status_by_cid/${order.steadfast_consignment_id}`,
          {
            headers: {
              "Api-Key": apiKey,
              "Secret-Key": secretKey,
            },
          }
        );

        const data = await response.json();
        if (!response.ok) continue;

        const sfStatus = data?.delivery_status;
        let newStatus: string | null = null;

        // Map SteadFast statuses
        if (sfStatus === "delivered" || sfStatus === 1) newStatus = "delivered";
        else if (sfStatus === "partial_delivered") newStatus = "delivered";
        else if (sfStatus === "cancelled" || sfStatus === 2) newStatus = "returned";
        else if (sfStatus === "in_review" || sfStatus === "pending") newStatus = "in_transit";
        else if (sfStatus === "hold") newStatus = "in_transit";

        if (newStatus && newStatus !== order.delivery_status) {
          await supabase
            .from("orders")
            .update({ delivery_status: newStatus })
            .eq("id", order.id);
          updated++;
        }
      } catch (e) {
        console.error(`Error checking order ${order.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ processed: orders.length, updated }),
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
