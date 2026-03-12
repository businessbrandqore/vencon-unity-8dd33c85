import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Activity, Target, ShoppingCart, Search, Phone, User, Package, Truck,
  MapPin, Clock, ArrowRight, CircleDot, Database, Send,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// Pipeline position mapping
const getLeadPosition = (lead: any, isBn: boolean): { label: string; color: string; step: number } => {
  const s = lead.status || "fresh";
  if (s === "fresh" && !lead.assigned_to) return { label: isBn ? "TL — অ্যাসাইন হয়নি" : "TL — Unassigned", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", step: 1 };
  if (s === "fresh" || s === "assigned") return { label: isBn ? "এজেন্ট — কল হয়নি" : "Agent — Not Called", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", step: 2 };
  if (["called", "callback", "busy_now", "number_busy", "no_response", "do_not_pick", "customer_reschedule", "call_back_later", "follow_up", "positive"].includes(s))
    return { label: isBn ? "এজেন্ট — ফলো আপ" : "Agent — Follow Up", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", step: 2 };
  if (s === "order_confirmed" || s === "order_confirm") return { label: isBn ? "CSO — রিভিউ পেন্ডিং" : "CSO — Review Pending", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", step: 3 };
  if (s === "pre_order") return { label: isBn ? "প্রি-অর্ডার" : "Pre-Order", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400", step: 2 };
  if (["not_interested", "negative", "wrong_number", "duplicate", "cancelled", "already_ordered", "out_of_coverage", "switch_off", "not_reachable", "phone_off"].includes(s))
    return { label: isBn ? "বাদ দেওয়া হয়েছে" : "Dropped", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", step: 0 };
  if (s === "processing_assigned") return { label: isBn ? "এজেন্ট — প্রসেসিং" : "Agent — Processing", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400", step: 2 };
  return { label: s, color: "bg-muted text-muted-foreground", step: 0 };
};

const getOrderPosition = (order: any, isBn: boolean): { label: string; color: string; step: number } => {
  const s = order.status || "pending_cso";
  const ds = order.delivery_status || "pending";
  if (s === "pending_cso") return { label: isBn ? "CSO — অনুমোদন পেন্ডিং" : "CSO — Approval Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", step: 3 };
  if (s === "send_today") return { label: isBn ? "ওয়্যারহাউস — প্যাকিং" : "Warehouse — Packing", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", step: 4 };
  if (s === "dispatched" && ds === "pending") return { label: isBn ? "স্টিডফাস্ট — পিকআপ পেন্ডিং" : "Steadfast — Pickup Pending", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", step: 5 };
  if (ds === "in_transit") return { label: isBn ? "রাইডার — ডেলিভারি চলছে" : "Rider — In Transit", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400", step: 6 };
  if (ds === "delivered") return { label: isBn ? "✅ ডেলিভার্ড" : "✅ Delivered", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", step: 7 };
  if (ds === "returned") return { label: isBn ? "↩ রিটার্নড" : "↩ Returned", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", step: 7 };
  if (s === "call_done") return { label: isBn ? "CS কল সম্পন্ন — Silver পেন্ডিং" : "CS Call Done — Silver Pending", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", step: 8 };
  if (s === "rejected") return { label: isBn ? "❌ প্রত্যাখ্যাত" : "❌ Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", step: 0 };
  return { label: s, color: "bg-muted text-muted-foreground", step: 0 };
};

const statusColorMap: Record<string, string> = {
  fresh: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  assigned: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  called: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  interested: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  not_interested: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  callback: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  order_confirmed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  order_confirm: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  processing_assigned: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
};

const DataTracker = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const isBn = t("vencon") === "VENCON";
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [dataMode, setDataMode] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("raw_data");
  const [search, setSearch] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkAgent, setBulkAgent] = useState("");

  const panel = user?.panel;
  const isBDO = user?.role === "bdo" || user?.role === "business_development_officer" || user?.role === "Business Development And Marketing Manager";
  const isATL = user?.role === "Assistant Team Leader";
  const isTL = panel === "tl" && !isBDO; // BDO uses TL panel but gets global access
  const canAssign = panel === "tl" && !isBDO && !isATL; // Only actual TL can assign raw data

  // ATL → TL mapping per campaign
  const [atlTlMap, setAtlTlMap] = useState<Record<string, string>>({});

  const getEffectiveTlId = () => {
    if (!isATL || !user) return user?.id || "";
    if (selectedCampaign !== "all" && atlTlMap[selectedCampaign]) return atlTlMap[selectedCampaign];
    // If "all", return first TL id (best effort)
    const vals = Object.values(atlTlMap);
    return vals.length > 0 ? vals[0] : user?.id || "";
  };

  // Fetch campaigns
  const { data: campaigns } = useQuery({
    queryKey: ["tracker-campaigns", user?.id, isTL, isATL],
    queryFn: async () => {
      if (isTL && !isATL && user) {
        const { data } = await supabase
          .from("campaign_tls")
          .select("campaign_id, campaigns(id, name, data_mode)")
          .eq("tl_id", user.id);
        return (data || []).map((d: any) => d.campaigns).filter(Boolean);
      }
      if (isATL && user) {
        const { data } = await supabase
          .from("campaign_agent_roles")
          .select("campaign_id, tl_id, campaigns(id, name, data_mode)")
          .eq("agent_id", user.id);
        if (data) {
          const tlMap: Record<string, string> = {};
          const seen = new Set<string>();
          const list = data
            .filter((d: any) => d.campaigns)
            .filter((d: any) => { if (seen.has(d.campaigns.id)) return false; seen.add(d.campaigns.id); return true; })
            .map((d: any) => { tlMap[d.campaigns.id] = d.tl_id; return d.campaigns; });
          setAtlTlMap(tlMap);
          return list;
        }
        return [];
      }
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, data_mode")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch ALL leads (for all tabs)
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["tracker-leads", selectedCampaign, dataMode, user?.id, isTL],
    queryFn: async () => {
      let q = supabase
        .from("leads")
        .select("id, name, phone, address, status, agent_type, source, import_source, campaign_id, created_at, assigned_to, tl_id, updated_at, called_time")
        .order("created_at", { ascending: false })
        .limit(500);
      if (selectedCampaign !== "all") q = q.eq("campaign_id", selectedCampaign);
      if (isTL && user) q = q.eq("tl_id", user.id);
      const { data, error } = await q;
      if (error) throw error;
      let result = data || [];
      if (dataMode === "lead") result = result.filter(l => l.source !== "processing" && l.import_source !== "processing");
      if (dataMode === "processing") result = result.filter(l => l.source === "processing" || l.import_source === "processing");
      return result;
    },
    enabled: !!user,
  });

  // Fetch orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["tracker-orders", selectedCampaign, user?.id, isTL],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, customer_name, phone, address, product, price, quantity, status, delivery_status, steadfast_consignment_id, created_at, agent_id, tl_id, lead_id, rider_name, rider_phone")
        .order("created_at", { ascending: false })
        .limit(500);
      if (isTL && user) q = q.eq("tl_id", user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch Silver data: orders delivered from Bronze agents → original lead info
  const { data: silverLeads, isLoading: silverLoading } = useQuery({
    queryKey: ["tracker-silver", selectedCampaign, user?.id, isTL],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, lead_id, customer_name, phone, address, product, price, created_at, delivery_status, leads!orders_lead_id_fkey(id, name, phone, address, source, created_at, campaign_id)")
        .eq("delivery_status", "delivered")
        .order("created_at", { ascending: false })
        .limit(500);
      if (isTL && user) q = q.eq("tl_id", user.id);
      const { data, error } = await q;
      if (error) throw error;
      // Filter to only bronze-origin leads
      const result = (data || []).filter((o: any) => o.leads);
      // Further filter by campaign if selected
      if (selectedCampaign !== "all") {
        return result.filter((o: any) => o.leads?.campaign_id === selectedCampaign);
      }
      return result;
    },
    enabled: !!user,
  });

  // Fetch Golden data: orders from Silver agents that got delivered again
  // Golden = leads that have agent_type = 'silver' AND their order is delivered
  const { data: goldenLeads, isLoading: goldenLoading } = useQuery({
    queryKey: ["tracker-golden", selectedCampaign, user?.id, isTL],
    queryFn: async () => {
      // Get leads assigned as silver that have delivered orders
      let q = supabase
        .from("leads")
        .select("id, name, phone, address, source, created_at, campaign_id, agent_type")
        .eq("agent_type", "silver")
        .order("created_at", { ascending: false })
        .limit(500);
      if (selectedCampaign !== "all") q = q.eq("campaign_id", selectedCampaign);
      if (isTL && user) q = q.eq("tl_id", user.id);
      const { data: silverAssigned, error: sErr } = await q;
      if (sErr) throw sErr;
      if (!silverAssigned || silverAssigned.length === 0) return [];

      // Check which of these silver leads have delivered orders
      const silverIds = silverAssigned.map(l => l.id);
      const { data: deliveredOrders, error: oErr } = await supabase
        .from("orders")
        .select("lead_id")
        .in("lead_id", silverIds)
        .eq("delivery_status", "delivered");
      if (oErr) throw oErr;

      const deliveredLeadIds = new Set((deliveredOrders || []).map(o => o.lead_id));
      return silverAssigned.filter(l => deliveredLeadIds.has(l.id));
    },
    enabled: !!user,
  });

  // Fetch agents for TL assignment
  const { data: agents } = useQuery({
    queryKey: ["tracker-agents", user?.id, selectedCampaign],
    queryFn: async () => {
      if (!user || !selectedCampaign || selectedCampaign === "all") {
        // Get all agents under this TL across campaigns
        const { data } = await supabase
          .from("campaign_agent_roles")
          .select("agent_id, is_bronze, is_silver, users!campaign_agent_roles_agent_id_fkey(id, name)")
          .eq("tl_id", user!.id);
        if (!data) return { bronze: [], silver: [], all: [] };
        const seen = new Set<string>();
        const bronze: { id: string; name: string }[] = [];
        const silver: { id: string; name: string }[] = [];
        const all: { id: string; name: string }[] = [];
        data.forEach((r: any) => {
          const agent = { id: r.users.id, name: r.users.name };
          if (!seen.has(agent.id)) { all.push(agent); seen.add(agent.id); }
          if (r.is_bronze && !bronze.find(b => b.id === agent.id)) bronze.push(agent);
          if (r.is_silver && !silver.find(s => s.id === agent.id)) silver.push(agent);
        });
        return { bronze, silver, all };
      }
      const { data } = await supabase
        .from("campaign_agent_roles")
        .select("agent_id, is_bronze, is_silver, users!campaign_agent_roles_agent_id_fkey(id, name)")
        .eq("campaign_id", selectedCampaign)
        .eq("tl_id", user!.id);
      if (!data) return { bronze: [], silver: [], all: [] };
      const bronze: { id: string; name: string }[] = [];
      const silver: { id: string; name: string }[] = [];
      const all: { id: string; name: string }[] = [];
      data.forEach((r: any) => {
        const agent = { id: r.users.id, name: r.users.name };
        all.push(agent);
        if (r.is_bronze) bronze.push(agent);
        if (r.is_silver) silver.push(agent);
      });
      return { bronze, silver, all };
    },
    enabled: !!user && isTL,
  });

  const allLeads = leads || [];
  const allOrders = orders || [];

  // Raw data = leads that came in but not yet operated on (fresh + unassigned)
  const rawLeads = allLeads.filter(l => l.status === "fresh" && !l.assigned_to);
  const rawLeadLeads = rawLeads.filter(l => l.source !== "processing" && l.import_source !== "processing");
  const rawProcessingLeads = rawLeads.filter(l => l.source === "processing" || l.import_source === "processing");

  // Agent status-changed leads
  const agentChangedLeads = allLeads.filter(l => l.status !== "fresh" && l.assigned_to);

  // Operated leads (assigned or status changed)
  const operatedLeads = allLeads.filter(l => l.assigned_to || l.status !== "fresh");

  // Pipeline summary
  const pipelineSummary = {
    rawData: rawLeads.length,
    agentPending: allLeads.filter(l => (l.status === "fresh" || l.status === "assigned") && l.assigned_to).length,
    agentFollowUp: allLeads.filter(l => ["called", "callback", "busy_now", "follow_up", "positive", "customer_reschedule"].includes(l.status || "")).length,
    csoPending: allOrders.filter(o => o.status === "pending_cso").length,
    warehousePending: allOrders.filter(o => o.status === "send_today").length,
    steadfastPending: allOrders.filter(o => o.status === "dispatched" && o.delivery_status === "pending").length,
    inTransit: allOrders.filter(o => o.delivery_status === "in_transit").length,
    delivered: allOrders.filter(o => o.delivery_status === "delivered").length,
    returned: allOrders.filter(o => o.delivery_status === "returned").length,
  };

  const filterBySearch = <T extends Record<string, any>>(items: T[]) => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) =>
      (item.name || item.customer_name || "").toLowerCase().includes(q) ||
      (item.phone || "").includes(q)
    );
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["tracker-leads"] });
    queryClient.invalidateQueries({ queryKey: ["tracker-orders"] });
  };

  // TL assignment functions
  const assignLead = async (leadId: string, agentId: string, isProcessing: boolean) => {
    if (isProcessing) {
      await supabase.from("leads").update({ assigned_to: agentId, status: "processing_assigned" }).eq("id", leadId);
    } else {
      await supabase.from("leads").update({ assigned_to: agentId, status: "assigned", agent_type: "bronze" }).eq("id", leadId);
    }
    toast.success(isBn ? "Lead assign করা হয়েছে" : "Lead assigned");
    setAssignments(prev => { const n = { ...prev }; delete n[leadId]; return n; });
    invalidateAll();
  };

  const bulkAssignLeads = async (isProcessing: boolean) => {
    if (!bulkAgent || selectedLeads.size === 0) return;
    const ids = Array.from(selectedLeads);
    for (const id of ids) {
      if (isProcessing) {
        await supabase.from("leads").update({ assigned_to: bulkAgent, status: "processing_assigned" }).eq("id", id);
      } else {
        await supabase.from("leads").update({ assigned_to: bulkAgent, status: "assigned", agent_type: "bronze" }).eq("id", id);
      }
    }
    toast.success(isBn ? `${ids.length}টি lead assign হয়েছে` : `${ids.length} leads assigned`);
    setSelectedLeads(new Set());
    setBulkAgent("");
    invalidateAll();
  };

  const pipelineSteps = [
    { label: isBn ? "র ডাটা" : "Raw Data", value: pipelineSummary.rawData, color: "text-rose-500", icon: Database },
    { label: isBn ? "এজেন্ট পেন্ডিং" : "Agent Pending", value: pipelineSummary.agentPending, color: "text-amber-500", icon: Phone },
    { label: isBn ? "ফলো আপ" : "Follow Up", value: pipelineSummary.agentFollowUp, color: "text-purple-500", icon: Clock },
    { label: isBn ? "CSO পেন্ডিং" : "CSO Pending", value: pipelineSummary.csoPending, color: "text-orange-500", icon: Target },
    { label: isBn ? "ওয়্যারহাউস" : "Warehouse", value: pipelineSummary.warehousePending, color: "text-cyan-500", icon: Package },
    { label: isBn ? "স্টিডফাস্ট" : "Steadfast", value: pipelineSummary.steadfastPending, color: "text-indigo-500", icon: Truck },
    { label: isBn ? "ট্রানজিট" : "In Transit", value: pipelineSummary.inTransit, color: "text-violet-500", icon: Truck },
    { label: isBn ? "ডেলিভার্ড" : "Delivered", value: pipelineSummary.delivered, color: "text-green-500", icon: CircleDot },
    { label: isBn ? "রিটার্নড" : "Returned", value: pipelineSummary.returned, color: "text-red-500", icon: CircleDot },
  ];

  // Determine which raw leads to show based on dataMode filter within raw tab
  const [rawSubTab, setRawSubTab] = useState<"lead" | "processing">("lead");
  const displayRawLeads = rawSubTab === "processing" ? rawProcessingLeads : rawLeadLeads;
  const agentList = rawSubTab === "processing" ? (agents?.all || []) : (agents?.bronze || []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            {isBn ? "ডাটা ট্র্যাকার" : "Data Tracker"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isBn ? "সব ডাটার বর্তমান অবস্থান ও স্ট্যাটাস দেখুন — সব কিছু ডাইনামিক ও পরস্পর সম্পর্কিত" : "Track current position & status of all data — everything is dynamic & interconnected"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={isBn ? "সব ক্যাম্পেইন" : "All Campaigns"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isBn ? "সব ক্যাম্পেইন" : "All Campaigns"}</SelectItem>
              {campaigns?.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.data_mode === "processing" ? "⚙️" : "🎯"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dataMode} onValueChange={setDataMode}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isBn ? "সব মোড" : "All Modes"}</SelectItem>
              <SelectItem value="lead">🎯 {isBn ? "লিড" : "Lead"}</SelectItem>
              <SelectItem value="processing">⚙️ {isBn ? "প্রসেসিং" : "Processing"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pipeline Position Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <p className="text-xs font-heading text-muted-foreground mb-3">{isBn ? "📍 পাইপলাইন অবস্থান সারাংশ — সব সংখ্যা রিয়েলটাইম" : "📍 Pipeline Position Summary — All counts are realtime"}</p>
          <div className="flex flex-wrap items-center gap-2">
            {pipelineSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="flex flex-col items-center bg-card border border-border rounded-lg px-3 py-2 min-w-[80px]">
                  <step.icon className={`h-3.5 w-3.5 ${step.color} mb-0.5`} />
                  <span className="text-lg font-heading font-bold text-foreground">{step.value}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight text-center">{step.label}</span>
                </div>
                {i < pipelineSteps.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="raw_data" className="text-xs">
              📦 {isBn ? "র ডাটা" : "Raw Data"} ({rawLeads.length})
            </TabsTrigger>
            <TabsTrigger value="silver_data" className="text-xs">
              🥈 {isBn ? "সিলভার" : "Silver"} ({(silverLeads || []).length})
            </TabsTrigger>
            <TabsTrigger value="golden_data" className="text-xs">
              🥇 {isBn ? "গোল্ডেন" : "Golden"} ({(goldenLeads || []).length})
            </TabsTrigger>
            <TabsTrigger value="all_leads" className="text-xs">
              🎯 {isBn ? "সব ডাটা" : "All Data"} ({allLeads.length})
            </TabsTrigger>
            <TabsTrigger value="agent_changed" className="text-xs">
              📝 {isBn ? "স্ট্যাটাস পরিবর্তিত" : "Status Changed"} ({agentChangedLeads.length})
            </TabsTrigger>
            <TabsTrigger value="orders" className="text-xs">
              🛒 {isBn ? "অর্ডার ট্র্যাকিং" : "Order Tracking"} ({allOrders.length})
            </TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isBn ? "নাম বা ফোন দিয়ে খুঁজুন..." : "Search by name or phone..."}
              className="pl-9 text-sm"
            />
          </div>
        </div>

        {/* ========== RAW DATA TAB — READ ONLY ========== */}
        <TabsContent value="raw_data">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg font-heading flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  {isBn ? "র ডাটা — ইন হয়েছে কিন্তু অপারেশন হয়নি" : "Raw Data — Imported but not operated"}
                </CardTitle>
                {/* Lead / Processing sub-filter */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={rawSubTab === "lead" ? "default" : "outline"}
                    onClick={() => setRawSubTab("lead")}
                    className="text-xs"
                  >
                    🎯 {isBn ? "লিড" : "Lead"} ({rawLeadLeads.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={rawSubTab === "processing" ? "default" : "outline"}
                    onClick={() => setRawSubTab("processing")}
                    className="text-xs"
                  >
                    ⚙️ {isBn ? "প্রসেসিং" : "Processing"} ({rawProcessingLeads.length})
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isBn ? "📖 শুধুমাত্র পড়ার জন্য — ইউজার থেকে আসা মূল ডাটা, কোনো পরিবর্তন ছাড়া" : "📖 Read-only — original data from users, without any changes"}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">{isBn ? "নাম" : "Name"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ঠিকানা" : "Address"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "সোর্স" : "Source"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "তারিখ" : "Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadsLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></TableCell></TableRow>
                    ) : filterBySearch(displayRawLeads).length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        {isBn ? "কোনো র ডাটা নেই — সব ডাটা অপারেশনে আছে ✅" : "No raw data — all data is in operation ✅"}
                      </TableCell></TableRow>
                    ) : filterBySearch(displayRawLeads).map((lead, i) => (
                      <TableRow key={lead.id}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-sm font-medium">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {lead.name || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{lead.phone || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{lead.address || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {lead.source || lead.import_source || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {lead.created_at ? format(new Date(lead.created_at), "dd MMM HH:mm") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== SILVER DATA TAB ========== */}
        <TabsContent value="silver_data">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                🥈 {isBn ? "সিলভার ডাটা — ব্রোঞ্জ থেকে প্রোডাক্ট রিসিভ হয়েছে (স্টিডফাস্ট ডেলিভার্ড)" : "Silver Data — Product received from Bronze (Steadfast Delivered)"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isBn ? "এই ডাটা গুলো ব্রোঞ্জ এজেন্টদের মাধ্যমে অর্ডার হয়ে স্টিডফাস্ট থেকে ডেলিভারি সম্পন্ন হয়েছে — ইউজারের মূল তথ্য" : "Orders from Bronze agents that were delivered via Steadfast — original user data"}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">{isBn ? "নাম" : "Name"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ঠিকানা" : "Address"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "পণ্য" : "Product"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "মূল্য" : "Price"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "তারিখ" : "Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {silverLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></TableCell></TableRow>
                    ) : filterBySearch(silverLeads || []).length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">{isBn ? "কোনো সিলভার ডাটা নেই" : "No silver data"}</TableCell></TableRow>
                    ) : filterBySearch(silverLeads || []).map((order: any, i: number) => (
                      <TableRow key={order.id}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-sm font-medium">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {order.leads?.name || order.customer_name || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{order.leads?.phone || order.phone || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{order.leads?.address || order.address || "—"}</TableCell>
                        <TableCell className="text-sm">{order.product || "—"}</TableCell>
                        <TableCell className="text-sm font-medium">৳{(order.price || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {order.created_at ? format(new Date(order.created_at), "dd MMM yyyy") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== GOLDEN DATA TAB ========== */}
        <TabsContent value="golden_data">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                🥇 {isBn ? "গোল্ডেন ডাটা — সিলভার থেকে প্রোডাক্ট রিসিভ হয়েছে" : "Golden Data — Product received from Silver"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isBn ? "সিলভার এজেন্টদের মাধ্যমে পুনরায় অর্ডার হয়ে স্টিডফাস্ট থেকে ডেলিভারি সম্পন্ন — ইউজারের মূল তথ্য" : "Re-ordered via Silver agents and delivered — original user data"}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">{isBn ? "নাম" : "Name"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ঠিকানা" : "Address"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "সোর্স" : "Source"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "তারিখ" : "Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goldenLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></TableCell></TableRow>
                    ) : filterBySearch(goldenLeads || []).length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">{isBn ? "কোনো গোল্ডেন ডাটা নেই" : "No golden data"}</TableCell></TableRow>
                    ) : filterBySearch(goldenLeads || []).map((lead: any, i: number) => (
                      <TableRow key={lead.id}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-sm font-medium">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {lead.name || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{lead.phone || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{lead.address || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{lead.source || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {lead.created_at ? format(new Date(lead.created_at), "dd MMM yyyy") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== ALL DATA TAB ========== */}
        <TabsContent value="all_leads">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">{isBn ? "নাম" : "Name"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "স্ট্যাটাস" : "Status"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "টাইপ" : "Type"}</TableHead>
                      <TableHead className="text-xs">📍 {isBn ? "বর্তমান অবস্থান" : "Current Position"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "তারিখ" : "Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadsLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></TableCell></TableRow>
                    ) : filterBySearch(allLeads).length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">{isBn ? "কোনো ডাটা নেই" : "No data found"}</TableCell></TableRow>
                    ) : filterBySearch(allLeads).map((lead, i) => {
                      const pos = getLeadPosition(lead, isBn);
                      return (
                        <TableRow key={lead.id}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="text-sm font-medium">
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              {lead.name || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{lead.phone || "—"}</TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] ${statusColorMap[lead.status || ""] || "bg-muted text-muted-foreground"}`}>
                              {lead.status || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {lead.agent_type ? (
                              <Badge variant="outline" className="text-[10px]">
                                {lead.agent_type === "bronze" ? "🥉" : "🥈"} {lead.agent_type}
                              </Badge>
                            ) : lead.source === "processing" || lead.import_source === "processing" ? (
                              <Badge variant="outline" className="text-[10px]">⚙️ Processing</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] ${pos.color}`}>
                              📍 {pos.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {lead.created_at ? format(new Date(lead.created_at), "dd MMM yyyy") : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== AGENT STATUS CHANGED TAB ========== */}
        <TabsContent value="agent_changed">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">{isBn ? "নাম" : "Name"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "স্ট্যাটাস" : "Status"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "কল সংখ্যা" : "Calls"}</TableHead>
                      <TableHead className="text-xs">📍 {isBn ? "বর্তমান অবস্থান" : "Current Position"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "আপডেট" : "Updated"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadsLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></TableCell></TableRow>
                    ) : filterBySearch(agentChangedLeads).length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">{isBn ? "কোনো স্ট্যাটাস পরিবর্তিত ডাটা নেই" : "No status-changed data"}</TableCell></TableRow>
                    ) : filterBySearch(agentChangedLeads).map((lead, i) => {
                      const pos = getLeadPosition(lead, isBn);
                      return (
                        <TableRow key={lead.id}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="text-sm font-medium">{lead.name || "—"}</TableCell>
                          <TableCell className="text-sm">{lead.phone || "—"}</TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] ${statusColorMap[lead.status || ""] || "bg-muted text-muted-foreground"}`}>
                              {lead.status || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-center">{lead.called_time || 0}</TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] ${pos.color}`}>📍 {pos.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {lead.updated_at ? format(new Date(lead.updated_at), "dd MMM HH:mm") : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== ORDERS TRACKING TAB ========== */}
        <TabsContent value="orders">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">{isBn ? "কাস্টমার" : "Customer"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "পণ্য" : "Product"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "মূল্য" : "Price"}</TableHead>
                      <TableHead className="text-xs">📍 {isBn ? "বর্তমান অবস্থান" : "Current Position"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "রাইডার" : "Rider"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "তারিখ" : "Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersLoading ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-12"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></TableCell></TableRow>
                    ) : filterBySearch(allOrders).length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">{isBn ? "কোনো অর্ডার নেই" : "No orders found"}</TableCell></TableRow>
                    ) : filterBySearch(allOrders).map((order, i) => {
                      const pos = getOrderPosition(order, isBn);
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="text-sm font-medium">{order.customer_name || "—"}</TableCell>
                          <TableCell className="text-sm">{order.phone || "—"}</TableCell>
                          <TableCell className="text-sm">{order.product || "—"}</TableCell>
                          <TableCell className="text-sm font-medium">৳{(order.price || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] ${pos.color}`}>📍 {pos.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {order.rider_name ? (
                              <div>
                                <span className="font-medium text-foreground">{order.rider_name}</span>
                                {order.rider_phone && (
                                  <span className="text-muted-foreground ml-1">({order.rider_phone})</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {order.created_at ? format(new Date(order.created_at), "dd MMM yyyy") : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataTracker;
