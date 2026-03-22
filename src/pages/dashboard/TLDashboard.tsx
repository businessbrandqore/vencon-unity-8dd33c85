import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, ShoppingCart, Phone, Trash2, CheckCircle, TrendingUp, Database } from "lucide-react";
import GroupLeaderDashboard from "./GroupLeaderDashboard";

interface CampaignOption {
  id: string;
  name: string;
}

interface WebsiteOption {
  id: string;
  site_name: string;
  campaign_id: string;
  data_mode: string;
}

const TLDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const isGL = user?.role === "Group Leader";

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [websites, setWebsites] = useState<WebsiteOption[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [selectedWebsite, setSelectedWebsite] = useState<string>("all");
  const [activeDataMode, setActiveDataMode] = useState<string>("lead");
  const [atlTlMap, setAtlTlMap] = useState<Record<string, string>>({});
  const [stats, setStats] = useState({
    totalLeads: 0,
    newLeads: 0,
    confirmedOrders: 0,
    callDoneQueue: 0,
    preOrders: 0,
    deleteSheet: 0,
    receiveRatio: 0,
  });

  const isBDO = user?.role === "bdo" || user?.role === "business_development_officer" || user?.role === "Business Development And Marketing Manager";
  const isATL = user?.role === "Assistant Team Leader";

  const getEffectiveTlId = useCallback(() => {
    if (!isATL || !user) return user?.id || "";
    if (selectedCampaign && atlTlMap[selectedCampaign]) return atlTlMap[selectedCampaign];
    return user?.id || "";
  }, [isATL, user, atlTlMap, selectedCampaign]);

  // Filter campaigns that have websites matching active data mode
  const filteredCampaigns = useMemo(() => {
    const campaignIdsWithMode = new Set(
      websites.filter(w => w.data_mode === activeDataMode).map(w => w.campaign_id)
    );
    return campaigns.filter(c => campaignIdsWithMode.has(c.id));
  }, [campaigns, websites, activeDataMode]);

  // Filter websites by selected campaign and data mode
  const filteredWebsites = useMemo(() =>
    websites.filter(w => w.campaign_id === selectedCampaign && w.data_mode === activeDataMode),
    [websites, selectedCampaign, activeDataMode]
  );

  // Auto-select first campaign when mode changes
  useEffect(() => {
    if (filteredCampaigns.length > 0) {
      if (!filteredCampaigns.find(c => c.id === selectedCampaign)) {
        setSelectedCampaign(filteredCampaigns[0].id);
      }
    } else {
      setSelectedCampaign("");
    }
    setSelectedWebsite("all");
  }, [activeDataMode, filteredCampaigns]);

  // Fetch campaigns
  useEffect(() => {
    if (!user) return;
    const fetchCampaigns = async () => {
      if (isBDO) {
        const { data } = await supabase.from("campaigns").select("id, name").order("created_at", { ascending: false });
        if (data) setCampaigns(data.map((c: any) => ({ id: c.id, name: c.name })));
      } else if (isATL) {
        const { data } = await supabase
          .from("campaign_agent_roles")
          .select("campaign_id, tl_id, campaigns(id, name)")
          .eq("agent_id", user.id);
        if (data) {
          const seen = new Set<string>();
          const tlMap: Record<string, string> = {};
          const list = data
            .filter((d: any) => d.campaigns)
            .filter((d: any) => { if (seen.has(d.campaigns.id)) return false; seen.add(d.campaigns.id); return true; })
            .map((d: any) => {
              tlMap[d.campaigns.id] = d.tl_id;
              return { id: d.campaigns.id, name: d.campaigns.name };
            });
          setAtlTlMap(tlMap);
          setCampaigns(list);
        }
      } else {
        const { data } = await supabase
          .from("campaign_tls")
          .select("campaign_id, campaigns(id, name)")
          .eq("tl_id", user.id);
        if (data) {
          setCampaigns(
            data.map((d: any) => d.campaigns).filter(Boolean)
              .map((c: any) => ({ id: c.id, name: c.name }))
          );
        }
      }
    };
    fetchCampaigns();
  }, [user]);

  // Fetch websites
  useEffect(() => {
    if (!user) return;
    const campaignIds = campaigns.map(c => c.id);
    if (campaignIds.length === 0) { setWebsites([]); return; }
    const fetchWebsites = async () => {
      const { data } = await supabase
        .from("campaign_websites")
        .select("id, site_name, campaign_id, data_mode")
        .in("campaign_id", campaignIds)
        .eq("is_active", true);
      if (data) setWebsites(data);
    };
    fetchWebsites();
  }, [campaigns, user]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!user || !selectedCampaign) {
      setStats({ totalLeads: 0, newLeads: 0, confirmedOrders: 0, callDoneQueue: 0, preOrders: 0, deleteSheet: 0, receiveRatio: 0 });
      return;
    }
    const effectiveTlId = getEffectiveTlId();

    // Get website names for source filtering based on active mode
    let sourceFilter: string[] | null = null;
    if (selectedWebsite !== "all") {
      const ws = websites.find(w => w.id === selectedWebsite);
      if (ws) sourceFilter = [ws.site_name];
    } else if (filteredWebsites.length > 0) {
      sourceFilter = filteredWebsites.map(w => w.site_name);
    }

    // If no websites match this mode for this campaign, show zeros
    if (!sourceFilter || sourceFilter.length === 0) {
      setStats({ totalLeads: 0, newLeads: 0, confirmedOrders: 0, callDoneQueue: 0, preOrders: 0, deleteSheet: 0, receiveRatio: 0 });
      return;
    }

    // Total leads (all statuses)
    let totalQ = supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", selectedCampaign)
      .in("source", sourceFilter);
    if (!isBDO) totalQ = totalQ.eq("tl_id", effectiveTlId);
    const { count: totalLeads } = await totalQ;

    // New leads (fresh, unassigned)
    let leadsQ = supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", selectedCampaign)
      .in("source", sourceFilter);
    if (!isBDO) {
      leadsQ = leadsQ.is("assigned_to", null).eq("status", "fresh").eq("tl_id", effectiveTlId);
    } else {
      leadsQ = leadsQ.is("assigned_to", null).eq("status", "fresh");
    }
    const { count: newLeads } = await leadsQ;

    // Confirmed orders
    let ordersQ = supabase
      .from("orders")
      .select("lead_id, leads!inner(campaign_id, source)", { count: "exact", head: true })
      .eq("status", "pending_cso")
      .eq("leads.campaign_id", selectedCampaign)
      .in("leads.source", sourceFilter);
    if (!isBDO) ordersQ = ordersQ.eq("tl_id", effectiveTlId);
    const { count: confirmedOrders } = await ordersQ;

    // Call done queue
    let callQ = supabase
      .from("orders")
      .select("lead_id, leads!inner(campaign_id, source)", { count: "exact", head: true })
      .eq("status", "call_done")
      .eq("leads.campaign_id", selectedCampaign)
      .in("leads.source", sourceFilter);
    if (!isBDO) callQ = callQ.eq("tl_id", effectiveTlId);
    const { count: callDoneQueue } = await callQ;

    // Pre-orders
    let preQ = supabase
      .from("pre_orders")
      .select("lead_id, leads!inner(campaign_id, source)", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("leads.campaign_id", selectedCampaign)
      .in("leads.source", sourceFilter);
    if (!isBDO) preQ = preQ.eq("tl_id", effectiveTlId);
    const { count: preOrders } = await preQ;

    // Delete sheet
    let delQ = supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", selectedCampaign)
      .in("source", sourceFilter)
      .gte("requeue_count", 5);
    if (!isBDO) delQ = delQ.eq("tl_id", effectiveTlId);
    const { count: deleteSheet } = await delQ;

    // Receive ratio this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    let totalOrdQ = supabase
      .from("orders")
      .select("lead_id, leads!inner(campaign_id, source)", { count: "exact", head: true })
      .eq("leads.campaign_id", selectedCampaign)
      .in("leads.source", sourceFilter)
      .gte("created_at", startOfMonth.toISOString());
    if (!isBDO) totalOrdQ = totalOrdQ.eq("tl_id", effectiveTlId);
    const { count: totalOrders } = await totalOrdQ;

    let delivQ = supabase
      .from("orders")
      .select("lead_id, leads!inner(campaign_id, source)", { count: "exact", head: true })
      .eq("delivery_status", "delivered")
      .eq("leads.campaign_id", selectedCampaign)
      .in("leads.source", sourceFilter)
      .gte("created_at", startOfMonth.toISOString());
    if (!isBDO) delivQ = delivQ.eq("tl_id", effectiveTlId);
    const { count: deliveredOrders } = await delivQ;

    const ratio = totalOrders && totalOrders > 0
      ? Math.round(((deliveredOrders || 0) / totalOrders) * 100)
      : 0;

    setStats({
      totalLeads: totalLeads || 0,
      newLeads: newLeads || 0,
      confirmedOrders: confirmedOrders || 0,
      callDoneQueue: callDoneQueue || 0,
      preOrders: preOrders || 0,
      deleteSheet: deleteSheet || 0,
      receiveRatio: ratio,
    });
  }, [user, selectedCampaign, selectedWebsite, isBDO, isATL, getEffectiveTlId, websites, filteredWebsites]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('tl-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pre_orders' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_websites' }, () => {
        // Refetch websites
        const cIds = campaigns.map(c => c.id);
        if (cIds.length > 0) {
          supabase.from("campaign_websites").select("id, site_name, campaign_id, data_mode").in("campaign_id", cIds).eq("is_active", true)
            .then(({ data }) => { if (data) setWebsites(data); });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchStats, campaigns]);

  if (!user) return null;
  if (isGL) return <GroupLeaderDashboard />;

  const statCards = [
    { label: isBn ? "মোট লিড" : "Total Leads", value: stats.totalLeads, icon: Database, color: "text-cyan-400" },
    { label: isBn ? "নতুন Leads" : "New Leads", value: stats.newLeads, icon: Target, color: "text-green-400" },
    { label: isBn ? "Confirmed Orders" : "Confirmed Orders", value: stats.confirmedOrders, icon: CheckCircle, color: "text-yellow-400" },
    { label: isBn ? "Call Done Queue" : "Call Done Queue", value: stats.callDoneQueue, icon: Phone, color: "text-blue-400" },
    { label: isBn ? "Pre-Orders" : "Pre-Orders", value: stats.preOrders, icon: ShoppingCart, color: "text-purple-400" },
    { label: isBn ? "Delete Sheet" : "Delete Sheet", value: stats.deleteSheet, icon: Trash2, color: "text-red-400" },
    { label: isBn ? "Receive Ratio %" : "Receive Ratio %", value: `${stats.receiveRatio}%`, icon: TrendingUp, color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">
            {isBDO ? (isBn ? "BDO ড্যাশবোর্ড" : "BDO Dashboard") : isATL ? (isBn ? "ATL ড্যাশবোর্ড" : "ATL Dashboard") : (isBn ? "TL ড্যাশবোর্ড" : "TL Dashboard")}
          </h2>
          <p className="font-body text-sm text-muted-foreground mt-1">
            {isBn ? "স্বাগতম" : "Welcome"}, {user.name}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={activeDataMode} onValueChange={setActiveDataMode}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="lead" className="text-xs">🎯 {isBn ? "লিড" : "Lead"}</TabsTrigger>
            <TabsTrigger value="processing" className="text-xs">⚙️ {isBn ? "প্রসেসিং" : "Processing"}</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={selectedCampaign} onValueChange={(v) => { setSelectedCampaign(v); setSelectedWebsite("all"); }}>
          <SelectTrigger className="w-52 border-[hsl(var(--panel-tl))] bg-secondary text-sm">
            <SelectValue placeholder={isBn ? "Campaign নির্বাচন" : "Select Campaign"} />
          </SelectTrigger>
          <SelectContent>
            {filteredCampaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filteredWebsites.length > 0 && (
          <Select value={selectedWebsite} onValueChange={setSelectedWebsite}>
            <SelectTrigger className="w-48 border-border bg-secondary text-sm">
              <SelectValue placeholder={isBn ? "ওয়েবসাইট" : "Website"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isBn ? "সব ওয়েবসাইট" : "All Websites"}</SelectItem>
              {filteredWebsites.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.site_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Stat Cards */}
      {selectedCampaign ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <Card key={s.label} className="bg-card border-border">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`p-3 rounded-lg bg-secondary ${s.color}`}>
                  <s.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-body">{s.label}</p>
                  <p className="text-2xl font-bold font-heading text-foreground">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          {isBn ? "এই মোডে কোনো ক্যাম্পেইন নেই" : "No campaigns in this mode"}
        </div>
      )}
    </div>
  );
};

export default TLDashboard;
