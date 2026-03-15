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

    const body = await req.json();

    // --- Test connection mode ---
    if (body.test_connection) {
      const { api_key, secret_key } = body;
      if (!api_key || !secret_key) {
        return new Response(JSON.stringify({ success: false, error: "API Key and Secret Key required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const res = await fetch("https://portal.packzy.com/api/v1/get_balance", {
          headers: { "Api-Key": api_key, "Secret-Key": secret_key },
        });
        const data = await res.json();
        if (res.ok && data.status === 200) {
          return new Response(JSON.stringify({ success: true, balance: data.current_balance, message: "Connected successfully" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: false, error: data.message || "Authentication failed" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- Normal dispatch mode ---
    const { order_id } = body;

    if (!order_id) {
      return new Response(JSON.stringify({ success: false, error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch order details
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, customer_name, phone, address, price, product, quantity, tl_id, agent_id, warehouse_sent_by")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ success: false, error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch SteadFast API credentials
    // Try env vars first
    let sfApiKey = Deno.env.get("STEADFAST_API_KEY") || "";
    let sfSecretKey = Deno.env.get("STEADFAST_SECRET_KEY") || "";

    // Fallback: try app_settings api_config (HR saves here)
    if (!sfApiKey || !sfSecretKey) {
      const { data: apiSettings } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "api_config")
        .single();

      if (apiSettings?.value) {
        const val = apiSettings.value as Record<string, string>;
        sfApiKey = val.steadfast_api_key || "";
        sfSecretKey = val.steadfast_secret_key || "";
      }
    }

    // Legacy fallback: steadfast_api key
    if (!sfApiKey || !sfSecretKey) {
      const { data: sfSettings } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "steadfast_api")
        .single();

      if (sfSettings?.value) {
        const val = sfSettings.value as Record<string, string>;
        sfApiKey = val.api_key || "";
        sfSecretKey = val.secret_key || "";
      }
    }

    if (!sfApiKey || !sfSecretKey) {
      await supabase.from("orders").update({ steadfast_send_failed: true }).eq("id", order_id);
      return new Response(JSON.stringify({ success: false, error: "SteadFast API keys not configured. HR Settings → API ট্যাবে কনফিগার করুন।" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return await processDispatch(supabase, order, sfApiKey, sfSecretKey, corsHeaders);
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processDispatch(
  supabase: ReturnType<typeof createClient>,
  order: Record<string, unknown>,
  apiKey: string,
  secretKey: string,
  corsHeaders: Record<string, string>
) {
  const orderId = order.id as string;
  const orderShort = orderId.slice(0, 8);

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
          invoice: orderId,
          recipient_name: order.customer_name || "N/A",
          recipient_phone: order.phone || "",
          recipient_address: order.address || "",
          cod_amount: (order.price as number) || 0,
          note: `Vencon Order ${orderId}`,
        }),
      });

      const data = await response.json();

      if (response.ok && (data.status === 200 || response.status === 200)) {
        const consignmentId =
          data.consignment?.consignment_id || data.consignment_id || `SF-${Date.now()}`;

        await supabase
          .from("orders")
          .update({
            steadfast_consignment_id: consignmentId,
            status: "dispatched",
            delivery_status: "pending",
            warehouse_sent_at: new Date().toISOString(),
            steadfast_send_failed: false,
          })
          .eq("id", orderId);

        // Notify Delivery Coordinator
        const { data: dcUsers } = await supabase
          .from("users")
          .select("id")
          .eq("role", "delivery_coordinator")
          .eq("is_active", true);

        if (dcUsers?.length) {
          await supabase.from("notifications").insert(
            dcUsers.map((u: { id: string }) => ({
              user_id: u.id,
              title: "নতুন dispatch",
              message: `Consignment: ${consignmentId} — Order #${orderShort}`,
              type: "info",
            }))
          );
        }

        await supabase.from("audit_logs").insert({
          action: "steadfast_dispatch_success",
          target_table: "orders",
          target_id: orderId,
          actor_id: order.warehouse_sent_by as string || null,
          details: { consignment_id: consignmentId, attempts: attempt },
        });

        return new Response(
          JSON.stringify({ success: true, consignment_id: consignmentId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      lastError = JSON.stringify(data);
    } catch (e) {
      lastError = (e as Error).message;
    }

    if (attempt < 3) await new Promise((r) => setTimeout(r, 1000));
  }

  // All retries failed
  await supabase.from("orders").update({ steadfast_send_failed: true }).eq("id", orderId);

  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .in("panel", ["sa", "hr"])
    .eq("is_active", true);

  if (admins?.length) {
    await supabase.from("notifications").insert(
      admins.map((a: { id: string }) => ({
        user_id: a.id,
        title: `⚠️ SteadFast send failed — Order ${orderShort}`,
        message: `SteadFast-এ অর্ডার পাঠাতে ব্যর্থ হয়েছে। Error: ${lastError}`,
        type: "error",
      }))
    );
  }

  await supabase.from("audit_logs").insert({
    action: "steadfast_send_failed",
    target_table: "orders",
    target_id: orderId,
    actor_id: order.warehouse_sent_by as string || null,
    details: { error: lastError, attempts: 3 },
  });

  return new Response(
    JSON.stringify({ success: false, error: lastError }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
