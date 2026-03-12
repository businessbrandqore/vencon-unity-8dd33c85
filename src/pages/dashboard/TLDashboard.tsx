import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, ShoppingCart, Phone, Trash2, CheckCircle, TrendingUp } from "lucide-react";

interface CampaignOption {
  id: string;
  name: string;
}

const TLDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [atlTlMap, setAtlTlMap] = useState<Record<string, string>>({});
  const [stats, setStats] = useState({
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

  useEffect(() => {
    if (!user) return;
    const fetchCampaigns = async () => {
      if (isBDO) {
        // BDO sees all campaigns
        const { data } = await supabase
          .from("campaigns")
          .select("id, name")
          .order("created_at", { ascending: false });
        if (data) {
          const list = data.map((c: any) => ({ id: c.id, name: c.name }));
          setCampaigns(list);
          if (list.length > 0 && !selectedCampaign) setSelectedCampaign(list[0].id);
        }
      } else if (isATL) {
        // ATL sees campaigns they're assigned to as agent
        const { data } = await supabase
          .from("campaign_agent_roles")
          .select("campaign_id, campaigns(id, name)")
          .eq("agent_id", user.id);
        if (data) {
          const seen = new Set<string>();
          const list = data
            .map((d: any) => d.campaigns)
            .filter(Boolean)
            .filter((c: any) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
            .map((c: any) => ({ id: c.id, name: c.name }));
          setCampaigns(list);
          if (list.length > 0 && !selectedCampaign) setSelectedCampaign(list[0].id);
        }
      } else {
        const { data } = await supabase
          .from("campaign_tls")
          .select("campaign_id, campaigns(id, name)")
          .eq("tl_id", user.id);
        if (data) {
          const list = data
            .map((d: any) => d.campaigns)
            .filter(Boolean)
            .map((c: any) => ({ id: c.id, name: c.name }));
          setCampaigns(list);
          if (list.length > 0 && !selectedCampaign) setSelectedCampaign(list[0].id);
        }
      }
    };
    fetchCampaigns();
  }, [user]);

  const fetchStats = useCallback(async () => {
    if (!user || !selectedCampaign) return;
    // New leads for ATL: show leads assigned to them
    let leadsQ = supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", selectedCampaign);
    if (isATL) {
      leadsQ = leadsQ.eq("assigned_to", user.id);
    } else if (!isBDO) {
      leadsQ = leadsQ.is("assigned_to", null).eq("status", "fresh").eq("tl_id", user.id);
    } else {
      leadsQ = leadsQ.is("assigned_to", null).eq("status", "fresh");
    }

    const { count: newLeads } = await leadsQ;

    // Confirmed orders (pending CSO)
    let ordersQ = supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_cso");
    if (isATL) ordersQ = ordersQ.eq("agent_id", user.id);
    else if (!isBDO) ordersQ = ordersQ.eq("tl_id", user.id);

    const { count: confirmedOrders } = await ordersQ;

    // Call done queue
    let callQ = supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "call_done");
    if (isATL) callQ = callQ.eq("agent_id", user.id);
    else if (!isBDO) callQ = callQ.eq("tl_id", user.id);

    const { count: callDoneQueue } = await callQ;

    // Pre-orders
    let preQ = supabase
      .from("pre_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    if (isATL) preQ = preQ.eq("agent_id", user.id);
    else if (!isBDO) preQ = preQ.eq("tl_id", user.id);

    const { count: preOrders } = await preQ;

    // Delete sheet
    let delQ = supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", selectedCampaign)
      .gte("requeue_count", 5);
    if (isATL) delQ = delQ.eq("assigned_to", user.id);
    else if (!isBDO) delQ = delQ.eq("tl_id", user.id);

    const { count: deleteSheet } = await delQ;

    // Receive ratio this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    let totalQ = supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth.toISOString());
    if (isATL) totalQ = totalQ.eq("agent_id", user.id);
    else if (!isBDO) totalQ = totalQ.eq("tl_id", user.id);

    const { count: totalOrders } = await totalQ;

    let delivQ = supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("delivery_status", "delivered")
      .gte("created_at", startOfMonth.toISOString());
    if (isATL) delivQ = delivQ.eq("agent_id", user.id);
    else if (!isBDO) delivQ = delivQ.eq("tl_id", user.id);

    const { count: deliveredOrders } = await delivQ;

    const ratio = totalOrders && totalOrders > 0
      ? Math.round(((deliveredOrders || 0) / totalOrders) * 100)
      : 0;

    setStats({
      newLeads: newLeads || 0,
      confirmedOrders: confirmedOrders || 0,
      callDoneQueue: callDoneQueue || 0,
      preOrders: preOrders || 0,
      deleteSheet: deleteSheet || 0,
      receiveRatio: ratio,
    });
  }, [user, selectedCampaign, isBDO, isATL]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Refetch campaigns list helper
  const refetchCampaigns = useCallback(async () => {
    if (!user) return;
    if (isBDO) {
      const { data } = await supabase.from("campaigns").select("id, name").order("created_at", { ascending: false });
      if (data) {
        const list = data.map((c: any) => ({ id: c.id, name: c.name }));
        setCampaigns(list);
        if (list.length > 0 && !selectedCampaign) setSelectedCampaign(list[0].id);
      }
    } else if (isATL) {
      const { data } = await supabase.from("campaign_agent_roles").select("campaign_id, campaigns(id, name)").eq("agent_id", user.id);
      if (data) {
        const seen = new Set<string>();
        const list = data.map((d: any) => d.campaigns).filter(Boolean).filter((c: any) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; }).map((c: any) => ({ id: c.id, name: c.name }));
        setCampaigns(list);
        if (list.length > 0 && !selectedCampaign) setSelectedCampaign(list[0].id);
      }
    } else {
      const { data } = await supabase.from("campaign_tls").select("campaign_id, campaigns(id, name)").eq("tl_id", user.id);
      if (data) {
        const list = data.map((d: any) => d.campaigns).filter(Boolean).map((c: any) => ({ id: c.id, name: c.name }));
        setCampaigns(list);
        if (list.length > 0 && !selectedCampaign) setSelectedCampaign(list[0].id);
      }
    }
  }, [user, isBDO, isATL, selectedCampaign]);

  // Realtime: auto-refresh stats + campaigns when related tables change
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('tl-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pre_orders' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => refetchCampaigns())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_tls' }, () => refetchCampaigns())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_agent_roles' }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isBDO, fetchStats, refetchCampaigns]);

  if (!user) return null;

  const statCards = [
    { label: isBn ? "নতুন Leads" : "New Leads", value: stats.newLeads, icon: Target, color: "text-green-400" },
    { label: isBn ? "Confirmed Orders" : "Confirmed Orders", value: stats.confirmedOrders, icon: CheckCircle, color: "text-yellow-400" },
    { label: isBn ? "Call Done Queue" : "Call Done Queue", value: stats.callDoneQueue, icon: Phone, color: "text-blue-400" },
    { label: isBn ? "Pre-Orders" : "Pre-Orders", value: stats.preOrders, icon: ShoppingCart, color: "text-purple-400" },
    { label: isBn ? "Delete Sheet" : "Delete Sheet", value: stats.deleteSheet, icon: Trash2, color: "text-red-400" },
    { label: isBn ? "Receive Ratio %" : "Receive Ratio %", value: `${stats.receiveRatio}%`, icon: TrendingUp, color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">
            {isBDO ? (isBn ? "BDO ড্যাশবোর্ড" : "BDO Dashboard") : isATL ? (isBn ? "ATL ড্যাশবোর্ড" : "ATL Dashboard") : (isBn ? "TL ড্যাশবোর্ড" : "TL Dashboard")}
          </h2>
          <p className="font-body text-sm text-muted-foreground mt-1">
            {isBn ? "স্বাগতম" : "Welcome"}, {user.name}
          </p>
        </div>
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="w-64 border-[hsl(var(--panel-tl))] bg-secondary">
            <SelectValue placeholder={isBn ? "Campaign নির্বাচন করুন" : "Select Campaign"} />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
    </div>
  );
};

export default TLDashboard;
