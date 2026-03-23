import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIREBASE_SERVER_KEY = Deno.env.get("FIREBASE_SERVER_KEY");
    if (!FIREBASE_SERVER_KEY) {
      return new Response(
        JSON.stringify({ error: "FIREBASE_SERVER_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { fcm_token, type, title, body, caller_name, caller_number } = await req.json();

    if (!fcm_token) {
      return new Response(
        JSON.stringify({ error: "fcm_token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let payload: Record<string, unknown>;

    if (type === "call") {
      // Data-only message for calls (so Android handles it in background)
      payload = {
        to: fcm_token,
        data: {
          type: "call",
          caller_name: caller_name || "Unknown",
          caller_number: caller_number || "",
        },
        // High priority to wake device
        priority: "high",
      };
    } else {
      // Chat notification
      payload = {
        to: fcm_token,
        data: {
          type: "chat",
          title: title || "New Message",
          body: body || "",
        },
        notification: {
          title: title || "New Message",
          body: body || "",
          sound: "default",
        },
        priority: "high",
      };
    }

    const fcmResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${FIREBASE_SERVER_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const fcmResult = await fcmResponse.json();

    return new Response(JSON.stringify(fcmResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
