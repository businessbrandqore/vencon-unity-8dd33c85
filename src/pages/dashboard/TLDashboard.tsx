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
  site_name: string;
  campaign_id: string;
  data_mode: "lead" | "processing";
}

interface LeadRow {
  id: string;
  campaign_id: string | null;
  source: string | null;
  import_source: string | null;
  assigned_to: string | null;
  status: string | null;
  requeue_count: number | null;
  created_at: string | null;
}

interface OrderRow {
  id: string;
  lead_id: string | null;
  status: string | null;
  delivery_status: string | null;
  created_at: string | null;
  tl_id: string | null;
}

interface PreOrderRow {
  id: string;
  lead_id: string | null;
  status: string | null;
  created_at: string | null;
  tl_id: string | null;
}

const normalizeText = (value: string | null | undefined) => (value || "").trim().toLowerCase();
const getLeadMode = (importSource: string | null | undefined): "lead" | "processing" => {
  return normalizeText(importSource).includes("processing") ? "processing" : "lead";
};

const TLDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const isGL = user?.role === "Group Leader";

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [websiteMeta, setWebsiteMeta] = useState<WebsiteOption[]>([]);
  const [leadIndex, setLeadIndex] = useState<LeadRow[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [selectedWebsite, setSelectedWebsite] = useState<string>("all");
  const [activeDataMode, setActiveDataMode] = useState<"lead" | "processing">("lead");
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

  const isBDO =
    user?.role === "bdo" ||
    user?.role === "business_development_officer" ||
    user?.role === "Business Development And Marketing Manager";
  const isATL = user?.role === "Assistant Team Leader";

  const getEffectiveTlId = useCallback(() => {
    if (!isATL || !user) return user?.id || "";
    if (selectedCampaign && atlTlMap[selectedCampaign]) return atlTlMap[selectedCampaign];
    return user?.id || "";
  }, [isATL, user, atlTlMap, selectedCampaign]);

  const loadCampaigns = useCallback(async () => {
    if (!user) return;

    if (isBDO) {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name")
        .order("created_at", { ascending: false });

      setCampaigns((data || []) as CampaignOption[]);
      return;
    }

    if (isATL) {
      const { data } = await supabase
        .from("campaign_agent_roles")
        .select("campaign_id, tl_id, campaigns(id, name)")
        .eq("agent_id", user.id);

      const seen = new Set<string>();
      const tlMap: Record<string, string> = {};
      const list = (data || [])
        .filter((row: any) => row.campaigns)
        .filter((row: any) => {
          if (seen.has(row.campaigns.id)) return false;
          seen.add(row.campaigns.id);
          return true;
        })
        .map((row: any) => {
          tlMap[row.campaigns.id] = row.tl_id;
          return { id: row.campaigns.id, name: row.campaigns.name };
        });

      setAtlTlMap(tlMap);
      setCampaigns(list);
      return;
    }

    const { data } = await supabase
      .from("campaign_tls")
      .select("campaign_id, campaigns(id, name)")
      .eq("tl_id", user.id);

    setCampaigns(
      ((data || []) as any[])
        .map((row) => row.campaigns)
        .filter(Boolean)
        .map((campaign) => ({ id: campaign.id, name: campaign.name })),
    );
  }, [user, isBDO, isATL]);

  const loadFilterSources = useCallback(async () => {
    const campaignIds = campaigns.map((campaign) => campaign.id);

    if (campaignIds.length === 0) {
      setWebsiteMeta([]);
      setLeadIndex([]);
      return;
    }

    const [websiteRes, leadRes] = await Promise.all([
      supabase
        .from("campaign_websites")
        .select("site_name, campaign_id, data_mode")
        .in("campaign_id", campaignIds)
        .eq("is_active", true),
      supabase
        .from("leads")
        .select("id, campaign_id, source, import_source, assigned_to, status, requeue_count, created_at")
        .in("campaign_id", campaignIds)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    setWebsiteMeta(
      ((websiteRes.data || []) as any[]).map((row) => ({
        site_name: row.site_name,
        campaign_id: row.campaign_id,
        data_mode: row.data_mode === "processing" ? "processing" : "lead",
      })),
    );
    setLeadIndex((leadRes.data || []) as LeadRow[]);
  }, [campaigns]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    void loadFilterSources();
  }, [loadFilterSources]);

  const filteredCampaigns = useMemo(() => {
    const campaignIdsFromMeta = new Set(
      websiteMeta
        .filter((website) => website.data_mode === activeDataMode)
        .map((website) => website.campaign_id),
    );

    const campaignIdsFromLeads = new Set(
      leadIndex
        .filter((lead) => getLeadMode(lead.import_source) === activeDataMode)
        .map((lead) => lead.campaign_id)
        .filter(Boolean) as string[],
    );

    return campaigns.filter(
      (campaign) => campaignIdsFromMeta.has(campaign.id) || campaignIdsFromLeads.has(campaign.id),
    );
  }, [campaigns, websiteMeta, leadIndex, activeDataMode]);

  useEffect(() => {
    if (filteredCampaigns.length === 0) {
      setSelectedCampaign("");
      setSelectedWebsite("all");
      return;
    }

    if (!filteredCampaigns.some((campaign) => campaign.id === selectedCampaign)) {
      setSelectedCampaign(filteredCampaigns[0].id);
    }

    setSelectedWebsite("all");
  }, [filteredCampaigns, selectedCampaign]);

  const availableWebsites = useMemo(() => {
    if (!selectedCampaign) return [] as string[];

    const metaNames = websiteMeta
      .filter(
        (website) => website.campaign_id === selectedCampaign && website.data_mode === activeDataMode,
      )
      .map((website) => website.site_name?.trim())
      .filter(Boolean) as string[];

    const liveNames = leadIndex
      .filter(
        (lead) =>
          lead.campaign_id === selectedCampaign &&
          getLeadMode(lead.import_source) === activeDataMode,
      )
      .map((lead) => lead.source?.trim())
      .filter(Boolean) as string[];

    const uniqueMap = new Map<string, string>();
    [...metaNames, ...liveNames].forEach((name) => {
      const trimmed = name.trim();
      if (!uniqueMap.has(trimmed.toLowerCase())) {
        uniqueMap.set(trimmed.toLowerCase(), trimmed);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.localeCompare(b));
  }, [selectedCampaign, websiteMeta, leadIndex, activeDataMode]);

  const fetchStats = useCallback(async () => {
    if (!user || !selectedCampaign) {
      setStats({
        totalLeads: 0,
        newLeads: 0,
        confirmedOrders: 0,
        callDoneQueue: 0,
        preOrders: 0,
        deleteSheet: 0,
        receiveRatio: 0,
      });
      return;
    }

    const effectiveTlId = getEffectiveTlId();

    const [leadRes, orderRes, preOrderRes] = await Promise.all([
      supabase
        .from("leads")
        .select("id, campaign_id, source, import_source, assigned_to, status, requeue_count, created_at")
        .eq("campaign_id", selectedCampaign)
        .order("created_at", { ascending: false })
        .limit(1000),
      (() => {
        let query = supabase
          .from("orders")
          .select("id, lead_id, status, delivery_status, created_at, tl_id")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (!isBDO) query = query.eq("tl_id", effectiveTlId);
        return query;
      })(),
      (() => {
        let query = supabase
          .from("pre_orders")
          .select("id, lead_id, status, created_at, tl_id")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (!isBDO) query = query.eq("tl_id", effectiveTlId);
        return query;
      })(),
    ]);

    const leads = (leadRes.data || []) as LeadRow[];
    const orders = (orderRes.data || []) as OrderRow[];
    const preOrders = (preOrderRes.data || []) as PreOrderRow[];

    const filteredLeads = leads.filter((lead) => {
      const modeMatches = getLeadMode(lead.import_source) === activeDataMode;
      const websiteMatches =
        selectedWebsite === "all" || normalizeText(lead.source) === normalizeText(selectedWebsite);
      return modeMatches && websiteMatches;
    });

    const leadIds = new Set(filteredLeads.map((lead) => lead.id));
    const filteredOrders = orders.filter((order) => order.lead_id && leadIds.has(order.lead_id));
    const filteredPreOrders = preOrders.filter((preOrder) => preOrder.lead_id && leadIds.has(preOrder.lead_id));

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthOrders = filteredOrders.filter((order) => {
      if (!order.created_at) return false;
      if (order.status === "rejected") return false;
      return new Date(order.created_at) >= startOfMonth;
    });

    const deliveredOrders = monthOrders.filter((order) => order.delivery_status === "delivered");

    setStats({
      totalLeads: filteredLeads.length,
      newLeads: filteredLeads.filter((lead) => lead.status === "fresh" && !lead.assigned_to).length,
      confirmedOrders: filteredOrders.filter((order) => order.status === "pending_tl").length,
      callDoneQueue: filteredOrders.filter((order) => order.status === "call_done").length,
      preOrders: filteredPreOrders.filter((preOrder) => preOrder.status === "pending").length,
      deleteSheet: filteredLeads.filter((lead) => (lead.requeue_count || 0) >= 5).length,
      receiveRatio: monthOrders.length > 0 ? Math.round((deliveredOrders.length / monthOrders.length) * 100) : 0,
    });
  }, [user, selectedCampaign, selectedWebsite, activeDataMode, isBDO, getEffectiveTlId]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("tl-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        void loadFilterSources();
        void fetchStats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void fetchStats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pre_orders" }, () => {
        void fetchStats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_websites" }, () => {
        void loadFilterSources();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, () => {
        void loadCampaigns();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_tls" }, () => {
        void loadCampaigns();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_agent_roles" }, () => {
        void loadCampaigns();
        void fetchStats();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, loadCampaigns, loadFilterSources, fetchStats]);

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
          {isBDO
            ? isBn
              ? "BDO ড্যাশবোর্ড"
              : "BDO Dashboard"
            : isATL
              ? isBn
                ? "ATL ড্যাশবোর্ড"
                : "ATL Dashboard"
              : isBn
                ? "TL ড্যাশবোর্ড"
                : "TL Dashboard"}
        </h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          {isBn ? "স্বাগতম" : "Welcome"}, {user.name}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={activeDataMode} onValueChange={(value) => setActiveDataMode(value as "lead" | "processing")}>
          <SelectTrigger className="w-40 border-border bg-secondary text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lead">🎯 {isBn ? "লিড" : "Lead"}</SelectItem>
            <SelectItem value="processing">⚙️ {isBn ? "প্রসেসিং" : "Processing"}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedCampaign} onValueChange={(value) => setSelectedCampaign(value)}>
          <SelectTrigger className="w-52 border-[hsl(var(--panel-tl))] bg-secondary text-sm">
            <SelectValue placeholder={isBn ? "Campaign নির্বাচন" : "Select Campaign"} />
          </SelectTrigger>
          <SelectContent>
            {filteredCampaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {availableWebsites.length > 0 && (
          <Select value={selectedWebsite} onValueChange={(value) => setSelectedWebsite(value)}>
            <SelectTrigger className="w-52 border-border bg-secondary text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isBn ? "সব ওয়েবসাইট" : "All Websites"}</SelectItem>
              {availableWebsites.map((siteName) => (
                <SelectItem key={siteName} value={siteName}>
                  {siteName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {selectedCampaign ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {statCards.map((card) => (
            <Card key={card.label} className="bg-card border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-lg bg-secondary p-3 ${card.color}`}>
                  <card.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-body text-sm text-muted-foreground">{card.label}</p>
                  <p className="font-heading text-2xl font-bold text-foreground">{card.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          {isBn ? "এই মোডে কোনো ক্যাম্পেইন নেই" : "No campaigns in this mode"}
        </div>
      )}
    </div>
  );
};

export default TLDashboard;
