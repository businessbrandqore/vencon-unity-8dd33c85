import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const demoUsers = [
      { email: "superadmin@vencon.com", password: "Vencon@SA2026", name: "Super Admin", role: "super_admin", panel: "sa" as const, is_active: true },
      { email: "hr@vencon.com", password: "Vencon@HR2026", name: "HR Manager", role: "hr_manager", panel: "hr" as const, is_active: true },
      { email: "teamleader@vencon.com", password: "Vencon@TL2026", name: "Team Leader", role: "team_leader", panel: "tl" as const, is_active: true },
      { email: "agent@vencon.com", password: "Vencon@EMP2026", name: "Telesales Agent", role: "telesales_executive", panel: "employee" as const, is_active: true, shift_start: "09:00", shift_end: "18:00", basic_salary: 12000 },
      { email: "warehouse@vencon.com", password: "Vencon@WH2026", name: "Warehouse Staff", role: "warehouse_assistant", panel: "employee" as const, is_active: true, basic_salary: 14000 },
      { email: "cs@vencon.com", password: "Vencon@CS2026", name: "CS Executive", role: "cs_executive", panel: "employee" as const, is_active: true, basic_salary: 13000 },
      { email: "security@vencon.com", password: "Vencon@SEC2026", name: "Security Officer", role: "cso", panel: "employee" as const, is_active: true, basic_salary: 13000 },
    ];

    const createdUsers: Record<string, string> = {};

    // Create auth users and insert into users table
    for (const user of demoUsers) {
      // Check if auth user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u: any) => u.email === user.email);
      
      let authId: string;
      if (existing) {
        authId = existing.id;
      } else {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
        });
        if (authError) {
          console.error(`Failed to create auth user ${user.email}:`, authError);
          continue;
        }
        authId = authData.user.id;
      }

      // Check if user record already exists
      const { data: existingRecord } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", authId)
        .maybeSingle();

      if (!existingRecord) {
        const { data: insertedUser, error: insertError } = await supabase
          .from("users")
          .insert({
            auth_id: authId,
            name: user.name,
            email: user.email,
            panel: user.panel,
            role: user.role,
            is_active: user.is_active,
            shift_start: user.shift_start || null,
            shift_end: user.shift_end || null,
            basic_salary: user.basic_salary || null,
          })
          .select("id")
          .single();

        if (insertError) {
          console.error(`Failed to insert user ${user.email}:`, insertError);
          continue;
        }
        createdUsers[user.email] = insertedUser.id;
      } else {
        createdUsers[user.email] = existingRecord.id;
      }

      // Also insert into user_roles
      const userId = createdUsers[user.email];
      await supabase.from("user_roles").upsert({
        user_id: userId,
        role: user.role,
        panel: user.panel,
      }, { onConflict: "user_id,role" });
    }

    // Create Campaign Alpha
    const tlId = createdUsers["teamleader@vencon.com"];
    const agentId = createdUsers["agent@vencon.com"];
    const saId = createdUsers["superadmin@vencon.com"];

    let campaignId: string;
    const { data: existingCampaign } = await supabase
      .from("campaigns")
      .select("id")
      .eq("name", "Campaign Alpha")
      .maybeSingle();

    if (existingCampaign) {
      campaignId = existingCampaign.id;
    } else {
      const { data: campaign, error: campError } = await supabase
        .from("campaigns")
        .insert({
          name: "Campaign Alpha",
          description: "First test campaign for Vencon",
          status: "active",
          created_by: saId,
          start_date: "2026-03-01",
          end_date: "2026-06-30",
        })
        .select("id")
        .single();

      if (campError) {
        return new Response(JSON.stringify({ error: "Campaign creation failed", details: campError }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      campaignId = campaign.id;
    }

    // Create 10 sample leads
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("id")
      .eq("campaign_id", campaignId);

    if (!existingLeads || existingLeads.length === 0) {
      const leadData = [
        { name: "রহিম উদ্দিন", phone: "01711000001", address: "মিরপুর, ঢাকা", status: "fresh", agent_type: "bronze", assigned_to: agentId, tl_id: tlId },
        { name: "করিম হোসেন", phone: "01711000002", address: "গুলশান, ঢাকা", status: "fresh", agent_type: "bronze", assigned_to: agentId, tl_id: tlId },
        { name: "জামাল মিয়া", phone: "01711000003", address: "উত্তরা, ঢাকা", status: "called", agent_type: "bronze", assigned_to: agentId, tl_id: tlId },
        { name: "সালমা বেগম", phone: "01711000004", address: "ধানমন্ডি, ঢাকা", status: "interested", agent_type: "bronze", assigned_to: agentId, tl_id: tlId },
        { name: "নাসরিন আক্তার", phone: "01711000005", address: "মোহাম্মদপুর, ঢাকা", status: "fresh", agent_type: "bronze", assigned_to: agentId, tl_id: tlId },
        { name: "ফারুক আহমেদ", phone: "01711000006", address: "চট্টগ্রাম", status: "fresh", tl_id: tlId },
        { name: "মোস্তফা কামাল", phone: "01711000007", address: "সিলেট", status: "fresh", tl_id: tlId },
        { name: "আয়েশা সিদ্দিকা", phone: "01711000008", address: "রাজশাহী", status: "fresh", tl_id: tlId },
        { name: "তানভীর হাসান", phone: "01711000009", address: "খুলনা", status: "fresh", tl_id: tlId },
        { name: "রুবিনা ইয়াসমিন", phone: "01711000010", address: "বরিশাল", status: "fresh", tl_id: tlId },
      ].map((lead) => ({ ...lead, campaign_id: campaignId }));

      await supabase.from("leads").insert(leadData);
    }

    // Assign agent to TL's group
    await supabase.from("group_members").upsert(
      { group_leader_id: tlId, agent_id: agentId },
      { onConflict: "group_leader_id,agent_id" }
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Demo data seeded successfully",
        users: Object.keys(createdUsers).length,
        campaign: campaignId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
