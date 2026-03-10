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
    const { user_id, user_message, conversation_history } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch user details
    const { data: userData } = await supabase
      .from("users")
      .select("name, role, panel, basic_salary, shift_start, shift_end")
      .eq("id", user_id)
      .single();

    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build dynamic context based on role and question
    let contextData = "";
    const today = new Date().toISOString().split("T")[0];

    // Fetch role-scoped data
    if (userData.panel === "sa" || userData.panel === "hr") {
      // Full access
      const { data: orderStats } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00`);

      const { data: leadStats } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00`);

      contextData += `\nToday's total orders: ${orderStats?.length ?? 0}`;
      contextData += `\nToday's total new leads: ${leadStats?.length ?? 0}`;
    } else if (userData.panel === "tl") {
      const { data: teamLeads } = await supabase
        .from("leads")
        .select("id, status", { count: "exact" })
        .eq("tl_id", user_id)
        .gte("created_at", `${today}T00:00:00`);

      contextData += `\nYour team's leads today: ${teamLeads?.length ?? 0}`;
    } else {
      // Employee - own data only
      const { data: myLeads } = await supabase
        .from("leads")
        .select("id, status")
        .eq("assigned_to", user_id)
        .gte("created_at", `${today}T00:00:00`);

      const { data: myOrders } = await supabase
        .from("orders")
        .select("id, status, delivery_status")
        .eq("agent_id", user_id)
        .gte("created_at", `${today}T00:00:00`);

      const confirmed = myOrders?.filter((o) => o.status !== "cancelled")?.length ?? 0;
      const delivered = myOrders?.filter((o) => o.delivery_status === "delivered")?.length ?? 0;
      const ratio = confirmed > 0 ? ((delivered / confirmed) * 100).toFixed(1) : "0";

      contextData += `\nYour leads today: ${myLeads?.length ?? 0}`;
      contextData += `\nYour orders today: ${confirmed}`;
      contextData += `\nYour delivered today: ${delivered}`;
      contextData += `\nYour receive ratio: ${ratio}%`;
    }

    if (userData.basic_salary) {
      contextData += `\nBasic salary: BDT ${userData.basic_salary}`;
    }

    const systemPrompt = `You are the Vencon company operations assistant.
Current user: ${userData.name}, Role: ${userData.role.replace(/_/g, " ")}, Panel: ${userData.panel}.
Today's date: ${today}.

DATA ACCESS RULES:
- Telesales agents can ONLY see their own leads, orders, salary, attendance
- Group Leaders can see their own data + supervised agents' performance
- TL can see campaign-level data for their campaigns
- HR and SA can see all company data

Answer in the same language the user writes (Bengali or English).
Be concise and helpful.

RELEVANT DATA:
${contextData}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversation_history || []),
      { role: "user", content: user_message },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI service unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("AI chat error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
