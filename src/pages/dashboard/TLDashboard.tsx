import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  // Campaigns that have websites matching active data mode
  const filteredCampaigns = useMemo(() => {
    const ids = new Set(websites.filter(w => w.data_mode === activeDataMode).map(w => w.campaign_id));
    return campaigns.filter(c => ids.has(c.id));
  }, [campaigns, websites, activeDataMode]);

  // Websites matching selected campaign + mode
  const filteredWebsites = useMemo(() =>
    websites.filter(w => w.campaign_id === selectedCampaign && w.data_mode === activeDataMode),
    [websites, selectedCampaign, activeDataMode]
  );

  // Auto-select first campaign when mode/campaigns change
  useEffect(() => {
    if (filteredCampaigns.length > 0) {
      if (!filteredCampaigns.find(c => c.id === selectedCampaign)) {
        setSelectedCampaign(filteredCampaigns[0].id);
      }
    } else {
      setSelectedCampaign("");
    }
    setSelectedWebsite("all");
  }, [activeDataMode, filteredCampaigns.length]);

  // Fetch campaigns
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      if (isBDO) {
        const { data } = await supabase.from("campaigns").select("id, name").order("created_at", { ascending: false });
        if (data) setCampaigns(data);
      } else if (isATL) {
        const { data } = await supabase.from("campaign_agent_roles").select("campaign_id, tl_id, campaigns(id, name)").eq("agent_id", user.id);
        if (data) {
          const seen = new Set<string>();
          const tlMap: Record<string, string> = {};
          const list = data.filter((d: any) => d.campaigns).filter((d: any) => {
            if (seen.has(d.campaigns.id)) return false;
            seen.add(d.campaigns.id);
            return true;
          }).map((d: any) => {
            tlMap[d.campaigns.id] = d.tl_id;
            return { id: d.campaigns.id, name: d.campaigns.name };
          });
          setAtlTlMap(tlMap);
          setCampaigns(list);
        }
      } else {
        const { data } = await supabase.from("campaign_tls").select("campaign_id, campaigns(id, name)").eq("tl_id", user.id);
        if (data) setCampaigns(data.map((d: any) => d.campaigns).filter(Boolean));
      }
    };
    load();
  }, [user]);

  // Fetch websites when campaigns load
  useEffect(() => {
    const ids = campaigns.map(c => c.id);
    if (ids.length === 0) { setWebsites([]); return; }
    supabase.from("campaign_websites").select("id, site_name, campaign_id, data_mode").in("campaign_id", ids).eq("is_active", true)
      .then(({ data }) => { if (data) setWebsites(data); });
  }, [campaigns]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!user || !selectedCampaign) {
      setStats({ totalLeads: 0, newLeads: 0, confirmedOrders: 0, callDoneQueue: 0, preOrders: 0, deleteSheet: 0, receiveRatio: 0 });
      return;
    }
    const tlId = getEffectiveTlId();

    // Source filter from websites matching mode
    let sources: string[] = [];
    if (selectedWebsite !== "all") {
      const ws = websites.find(w => w.id === selectedWebsite);
      if (ws) sources = [ws.site_name];
    } else {
      sources = filteredWebsites.map(w => w.site_name);
    }

    if (sources.length === 0) {
      setStats({ totalLeads: 0, newLeads: 0, confirmedOrders: 0, callDoneQueue: 0, preOrders: 0, deleteSheet: 0, receiveRatio: 0 });
      return;
    }

    // Helper to build lead query with common filters
    const buildLeadQ = (extraHead = true) => {
      let q = supabase.from("leads").select("*", { count: "exact", head: extraHead })
        .eq("campaign_id", selectedCampaign)
        .in("source", sources);
      if (!isBDO) q = q.eq("tl_id", tlId);
      return q;
    };

    // Total leads
    const { count: totalLeads } = await buildLeadQ();

    // New leads (fresh + unassigned)
    const { count: newLeads } = await buildLeadQ()
      .is("assigned_to", null)
      .eq("status", "fresh");

    // Delete sheet
    const { count: deleteSheet } = await buildLeadQ().gte("requeue_count", 5);

    // Orders helper - join leads for campaign/source filter
    const buildOrderQ = () => {
      let q = supabase.from("orders")
        .select("lead_id, leads!inner(campaign_id, source)", { count: "exact", head: true })
        .eq("leads.campaign_id", selectedCampaign)
        .in("leads.source", sources);
      if (!isBDO) q = q.eq("tl_id", tlId);
      return q;
    };

    const { count: confirmedOrders } = await buildOrderQ().eq("status", "pending_cso");
    const { count: callDoneQueue } = await buildOrderQ().eq("status", "call_done");

    // Pre-orders
    let preQ = supabase.from("pre_orders")
      .select("lead_id, leads!inner(campaign_id, source)", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("leads.campaign_id", selectedCampaign)
      .in("leads.source", sources);
    if (!isBDO) preQ = preQ.eq("tl_id", tlId);
    const { count: preOrders } = await preQ;

    // Receive ratio
    const som = new Date();
    som.setDate(1); som.setHours(0, 0, 0, 0);
    const { count: totalOrders } = await buildOrderQ().gte("created_at", som.toISOString());
    const { count: delivered } = await buildOrderQ().eq("delivery_status", "delivered").gte("created_at", som.toISOString());
    const ratio = totalOrders && totalOrders > 0 ? Math.round(((delivered || 0) / totalOrders) * 100) : 0;

    setStats({
      totalLeads: totalLeads || 0,
      newLeads: newLeads || 0,
      confirmedOrders: confirmedOrders || 0,
      callDoneQueue: callDoneQueue || 0,
      preOrders: preOrders || 0,
      deleteSheet: deleteSheet || 0,
      receiveRatio: ratio,
    });
  }, [user, selectedCampaign, selectedWebsite, isBDO, getEffectiveTlId, websites, filteredWebsites]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('tl-dash-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pre_orders' }, () => fetchStats())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchStats]);

  if (!user) return null;
  if (isGL) return <GroupLeaderDashboard />;

  const statCards = [
    { label: isBn ? "মোট ডাটা" : "Total Data", value: stats.totalLeads, icon: Database, color: "text-cyan-400" },
    { label: isBn ? "নতুন ডাটা" : "New Data", value: stats.newLeads, icon: Target, color: "text-green-400" },
    { label: isBn ? "Confirmed Orders" : "Confirmed Orders", value: stats.confirmedOrders, icon: CheckCircle, color: "text-yellow-400" },
    { label: isBn ? "Call Done Queue" : "Call Done Queue", value: stats.callDoneQueue, icon: Phone, color: "text-blue-400" },
    { label: isBn ? "Pre-Orders" : "Pre-Orders", value: stats.preOrders, icon: ShoppingCart, color: "text-purple-400" },
    { label: isBn ? "Delete Sheet" : "Delete Sheet", value: stats.deleteSheet, icon: Trash2, color: "text-red-400" },
    { label: isBn ? "Receive Ratio %" : "Receive Ratio %", value: `${stats.receiveRatio}%`, icon: TrendingUp, color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBDO ? (isBn ? "BDO ড্যাশবোর্ড" : "BDO Dashboard") : isATL ? (isBn ? "ATL ড্যাশবোর্ড" : "ATL Dashboard") : (isBn ? "TL ড্যাশবোর্ড" : "TL Dashboard")}
        </h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          {isBn ? "স্বাগতম" : "Welcome"}, {user.name}
        </p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Data Mode dropdown */}
        <Select value={activeDataMode} onValueChange={(v) => setActiveDataMode(v)}>
          <SelectTrigger className="w-40 border-border bg-secondary text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lead">🎯 {isBn ? "লিড" : "Lead"}</SelectItem>
            <SelectItem value="processing">⚙️ {isBn ? "প্রসেসিং" : "Processing"}</SelectItem>
          </SelectContent>
        </Select>

        {/* Campaign dropdown */}
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

        {/* Website dropdown */}
        {filteredWebsites.length > 0 && (
          <Select value={selectedWebsite} onValueChange={setSelectedWebsite}>
            <SelectTrigger className="w-48 border-border bg-secondary text-sm">
              <SelectValue />
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

      {/* Stats */}
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
