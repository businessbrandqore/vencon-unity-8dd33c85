import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get SteadFast API credentials
    let apiKey = Deno.env.get("STEADFAST_API_KEY");
    let secretKey = Deno.env.get("STEADFAST_SECRET_KEY");

    if (!apiKey || !secretKey) {
      const { data: sfSettings } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "steadfast_api")
        .single();

      apiKey = (sfSettings?.value as Record<string, string>)?.api_key;
      secretKey = (sfSettings?.value as Record<string, string>)?.secret_key;
    }

    if (!apiKey || !secretKey) {
      return new Response(JSON.stringify({ error: "SteadFast API not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all dispatched orders with consignment IDs pending status update
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, steadfast_consignment_id, delivery_status, product, quantity, agent_id, tl_id, cs_id")
      .eq("status", "dispatched")
      .not("steadfast_consignment_id", "is", null)
      .in("delivery_status", ["pending", "in_transit"]);

    if (error || !orders?.length) {
      return new Response(JSON.stringify({ processed: 0, updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updated = 0;

    for (const order of orders) {
      try {
        const response = await fetch(
          `https://portal.steadfast.com.bd/api/v1/status_by_cid/${order.steadfast_consignment_id}`,
          {
            headers: { "Api-Key": apiKey, "Secret-Key": secretKey },
          }
        );

        const data = await response.json();
        if (!response.ok) continue;

        const sfStatus = data?.delivery_status;
        let newStatus: string | null = null;

        // Map SteadFast status codes
        if (sfStatus === "delivered" || sfStatus === 1) newStatus = "delivered";
        else if (sfStatus === "partial_delivered") newStatus = "delivered";
        else if (sfStatus === "cancelled" || sfStatus === 2) newStatus = "returned";
        else if (sfStatus === "in_review" || sfStatus === "pending" || sfStatus === "hold")
          newStatus = "in_transit";

        if (!newStatus || newStatus === order.delivery_status) continue;

        // Update delivery status
        await supabase
          .from("orders")
          .update({ delivery_status: newStatus })
          .eq("id", order.id);

        const orderShort = (order.id as string).slice(0, 8);

        // === DELIVERED ===
        if (newStatus === "delivered") {
          // Notify CS Executives (they handle delivered order follow-ups)
          const { data: csUsers } = await supabase
            .from("users")
            .select("id")
            .eq("role", "cs_executive")
            .eq("is_active", true);

          if (csUsers?.length) {
            await supabase.from("notifications").insert(
              csUsers.map((u: { id: string }) => ({
                user_id: u.id,
                title: "Delivered order — follow-up needed",
                message: `Order #${orderShort} delivered. Customer call করুন।`,
                type: "info",
              }))
            );
          }

          // Notify agent
          if (order.agent_id) {
            await supabase.from("notifications").insert({
              user_id: order.agent_id,
              title: "অর্ডার delivered হয়েছে!",
              message: `Order #${orderShort} সফলভাবে delivered।`,
              type: "success",
            });
          }

          // Inventory: dispatched count confirmed (already handled by order trigger)
        }

        // === RETURNED ===
        if (newStatus === "returned") {
          // Inventory: returned +1 (handled by order trigger on delivery_status change)

          // Notify TL and agent
          const notifyIds: string[] = [];
          if (order.tl_id) notifyIds.push(order.tl_id as string);
          if (order.agent_id) notifyIds.push(order.agent_id as string);

          if (notifyIds.length) {
            await supabase.from("notifications").insert(
              notifyIds.map((uid) => ({
                user_id: uid,
                title: "অর্ডার return হয়েছে",
                message: `Order #${orderShort} return হয়েছে। Consignment: ${order.steadfast_consignment_id}`,
                type: "warning",
              }))
            );
          }

          // Notify SA, HR
          const { data: admins } = await supabase
            .from("users")
            .select("id")
            .in("panel", ["sa", "hr"])
            .eq("is_active", true);

          if (admins?.length) {
            await supabase.from("notifications").insert(
              admins.map((a: { id: string }) => ({
                user_id: a.id,
                title: "অর্ডার return",
                message: `Order #${orderShort} return হয়েছে।`,
                type: "warning",
              }))
            );
          }
        }

        updated++;
      } catch (e) {
        console.error(`Error syncing order ${order.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ processed: orders.length, updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Sync error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
