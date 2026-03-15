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
      .select("name, role, panel, basic_salary, shift_start, shift_end, department, designation, phone, off_days")
      .eq("id", user_id)
      .single();

    if (!userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const msgLower = user_message.toLowerCase();

    // Determine what data to fetch based on the question keywords
    let contextData = "";

    // --- Always fetch user's own attendance ---
    const { data: myAttendance } = await supabase
      .from("attendance")
      .select("date, clock_in, clock_out, is_late, is_early_out, deduction_amount")
      .eq("user_id", user_id)
      .gte("date", `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`)
      .order("date", { ascending: false })
      .limit(31);

    const totalPresent = myAttendance?.length ?? 0;
    const totalLate = myAttendance?.filter(a => a.is_late)?.length ?? 0;
    const totalDeduction = myAttendance?.reduce((s, a) => s + (a.deduction_amount || 0), 0) ?? 0;
    const todayAttendance = myAttendance?.find(a => a.date === today);

    contextData += `\n--- আপনার এই মাসের Attendance ---`;
    contextData += `\nTotal Present: ${totalPresent} দিন`;
    contextData += `\nLate: ${totalLate} দিন`;
    contextData += `\nTotal Deduction: ৳${totalDeduction}`;
    if (todayAttendance) {
      contextData += `\nToday Clock In: ${todayAttendance.clock_in || "Not yet"}`;
      contextData += `\nToday Clock Out: ${todayAttendance.clock_out || "Not yet"}`;
    }

    // --- Own leads & orders ---
    const { data: myLeadsToday } = await supabase
      .from("leads")
      .select("id, status, name, phone")
      .eq("assigned_to", user_id)
      .gte("created_at", `${today}T00:00:00`);

    const { data: myOrdersToday } = await supabase
      .from("orders")
      .select("id, status, delivery_status, price, product, customer_name")
      .eq("agent_id", user_id)
      .gte("created_at", `${today}T00:00:00`);

    const confirmed = myOrdersToday?.filter(o => o.status !== "cancelled")?.length ?? 0;
    const delivered = myOrdersToday?.filter(o => o.delivery_status === "delivered")?.length ?? 0;
    const totalSales = myOrdersToday?.filter(o => o.status !== "cancelled")?.reduce((s, o) => s + (o.price || 0), 0) ?? 0;
    const ratio = confirmed > 0 ? ((delivered / confirmed) * 100).toFixed(1) : "0";

    contextData += `\n\n--- আপনার আজকের Performance ---`;
    contextData += `\nLeads পেয়েছেন: ${myLeadsToday?.length ?? 0}`;
    contextData += `\nOrders: ${confirmed}`;
    contextData += `\nDelivered: ${delivered}`;
    contextData += `\nReceive Ratio: ${ratio}%`;
    contextData += `\nTotal Sales: ৳${totalSales}`;

    // --- Leave requests ---
    const { data: myLeaves } = await supabase
      .from("leave_requests")
      .select("start_date, end_date, status, reason")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (myLeaves && myLeaves.length > 0) {
      contextData += `\n\n--- সাম্প্রতিক Leave ---`;
      myLeaves.forEach(l => {
        contextData += `\n${l.start_date} → ${l.end_date}: ${l.status} (${l.reason || "N/A"})`;
      });
    }

    // --- Monthly offs ---
    const { data: myOffs } = await supabase
      .from("employee_monthly_offs")
      .select("off_date")
      .eq("user_id", user_id)
      .eq("month", currentMonth)
      .eq("year", currentYear);

    if (myOffs && myOffs.length > 0) {
      contextData += `\n\n--- এই মাসের Off Days ---`;
      contextData += `\n${myOffs.map(o => o.off_date).join(", ")}`;
    }

    // --- Salary info ---
    if (userData.basic_salary) {
      contextData += `\n\n--- Salary Info ---`;
      contextData += `\nBasic Salary: ৳${userData.basic_salary}`;

      // Try to get salary calculation
      try {
        const { data: salaryData } = await supabase.rpc("calculate_salary", {
          _user_id: user_id,
          _month: currentMonth,
          _year: currentYear,
        });
        if (salaryData) {
          contextData += `\nCalculated Salary Data: ${JSON.stringify(salaryData)}`;
        }
      } catch (e) {
        // salary function may not exist yet
      }
    }

    // --- Complaints ---
    const { data: myComplaints } = await supabase
      .from("employee_complaints")
      .select("reason, status, created_at")
      .eq("target_id", user_id)
      .order("created_at", { ascending: false })
      .limit(3);

    if (myComplaints && myComplaints.length > 0) {
      contextData += `\n\n--- Complaints Against You ---`;
      myComplaints.forEach(c => {
        contextData += `\n${c.created_at?.split("T")[0]}: ${c.reason} (${c.status})`;
      });
    }

    // --- Notifications ---
    const { data: myNotifs } = await supabase
      .from("notifications")
      .select("title, message, is_read, created_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (myNotifs && myNotifs.length > 0) {
      contextData += `\n\n--- Recent Notifications ---`;
      myNotifs.forEach(n => {
        contextData += `\n${n.is_read ? "✓" : "🔴"} ${n.title}: ${n.message?.substring(0, 80) || ""}`;
      });
    }

    // --- HR/SA ADMIN DATA ---
    if (userData.panel === "sa" || userData.panel === "hr") {
      // Total employees
      const { count: totalEmployees } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

      // Today's company orders
      const { data: companyOrders } = await supabase
        .from("orders")
        .select("id, status, delivery_status, price")
        .gte("created_at", `${today}T00:00:00`);

      const companyConfirmed = companyOrders?.filter(o => o.status !== "cancelled")?.length ?? 0;
      const companyDelivered = companyOrders?.filter(o => o.delivery_status === "delivered")?.length ?? 0;
      const companyRevenue = companyOrders?.filter(o => o.status !== "cancelled")?.reduce((s, o) => s + (o.price || 0), 0) ?? 0;

      // Today's leads
      const { count: todayLeads } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00`);

      // Pending leaves
      const { count: pendingLeaves } = await supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      // Pending complaints
      const { count: pendingComplaints } = await supabase
        .from("employee_complaints")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      // Active campaigns
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id, name, status")
        .eq("status", "active");

      // Today's attendance count
      const { count: todayAttendanceCount } = await supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("date", today);

      // Inventory alerts
      const { data: lowStock } = await supabase
        .from("inventory")
        .select("product_name, stock_in, dispatched, low_stock_threshold");

      const lowStockItems = lowStock?.filter(i => {
        const available = (i.stock_in || 0) - (i.dispatched || 0);
        return available <= (i.low_stock_threshold || 10);
      }) ?? [];

      contextData += `\n\n--- কোম্পানি Overview (Admin) ---`;
      contextData += `\nTotal Active Employees: ${totalEmployees ?? 0}`;
      contextData += `\nToday Attendance: ${todayAttendanceCount ?? 0}`;
      contextData += `\nToday Orders: ${companyConfirmed}`;
      contextData += `\nToday Delivered: ${companyDelivered}`;
      contextData += `\nToday Revenue: ৳${companyRevenue}`;
      contextData += `\nToday New Leads: ${todayLeads ?? 0}`;
      contextData += `\nPending Leave Requests: ${pendingLeaves ?? 0}`;
      contextData += `\nPending Complaints: ${pendingComplaints ?? 0}`;
      contextData += `\nActive Campaigns: ${campaigns?.map(c => c.name).join(", ") || "None"}`;
      if (lowStockItems.length > 0) {
        contextData += `\n⚠️ Low Stock Items: ${lowStockItems.map(i => i.product_name).join(", ")}`;
      }

      // If asking about specific employee
      if (msgLower.includes("employee") || msgLower.includes("কর্মী") || msgLower.includes("staff")) {
        const { data: allEmployees } = await supabase
          .from("users")
          .select("name, role, panel, is_active, department, designation")
          .eq("is_active", true)
          .limit(50);

        if (allEmployees) {
          const byRole: Record<string, number> = {};
          allEmployees.forEach(e => {
            byRole[e.role] = (byRole[e.role] || 0) + 1;
          });
          contextData += `\n\nRole-wise Breakdown:`;
          Object.entries(byRole).forEach(([role, count]) => {
            contextData += `\n  ${role.replace(/_/g, " ")}: ${count}`;
          });
        }
      }
    }

    // --- TL specific data ---
    if (userData.panel === "tl") {
      const { data: teamLeads } = await supabase
        .from("leads")
        .select("id, status, assigned_to")
        .eq("tl_id", user_id)
        .gte("created_at", `${today}T00:00:00`);

      const { data: teamOrders } = await supabase
        .from("orders")
        .select("id, status, delivery_status, price, agent_id")
        .eq("tl_id", user_id)
        .gte("created_at", `${today}T00:00:00`);

      const teamConfirmed = teamOrders?.filter(o => o.status !== "cancelled")?.length ?? 0;
      const teamDelivered = teamOrders?.filter(o => o.delivery_status === "delivered")?.length ?? 0;
      const teamRevenue = teamOrders?.filter(o => o.status !== "cancelled")?.reduce((s, o) => s + (o.price || 0), 0) ?? 0;

      // Pending data requests
      const { count: pendingDataReqs } = await supabase
        .from("data_requests")
        .select("id", { count: "exact", head: true })
        .eq("tl_id", user_id)
        .eq("status", "pending");

      contextData += `\n\n--- আপনার Team Performance ---`;
      contextData += `\nTeam Leads Today: ${teamLeads?.length ?? 0}`;
      contextData += `\nTeam Orders: ${teamConfirmed}`;
      contextData += `\nTeam Delivered: ${teamDelivered}`;
      contextData += `\nTeam Revenue: ৳${teamRevenue}`;
      contextData += `\nPending Data Requests: ${pendingDataReqs ?? 0}`;
    }

    const systemPrompt = `You are "Vencon AI" — the intelligent operations assistant for Vencon company.
Current user: ${userData.name}
Role: ${userData.role.replace(/_/g, " ")}
Panel: ${userData.panel}
Department: ${userData.department || "N/A"}
Designation: ${userData.designation || "N/A"}
Shift: ${userData.shift_start || "N/A"} - ${userData.shift_end || "N/A"}
Today: ${today}

DATA ACCESS RULES (STRICT):
- Telesales agents: ONLY own leads, orders, salary, attendance
- Group Leaders: own data + supervised agents
- TL: campaign-level data for their campaigns
- HR and SA: ALL company data

RESPONSE GUIDELINES:
- Answer in the same language the user writes (Bengali/English)
- Be concise, use bullet points and numbers
- For salary questions, show breakdown if available
- For performance questions, include ratios and comparisons
- Use emoji for better readability (✅ ❌ 📊 💰 📋)
- If data is not available, say so honestly
- Format numbers with ৳ for BDT amounts

DATABASE CONTEXT:
${contextData}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversation_history || []).slice(-10), // Keep last 10 messages for context window
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
          JSON.stringify({ error: "Rate limit exceeded. কিছুক্ষণ পর আবার চেষ্টা করুন।" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits শেষ। অনুগ্রহ করে credits যোগ করুন।" }),
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
