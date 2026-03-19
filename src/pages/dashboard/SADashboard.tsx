import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import SAStatsCards from "@/components/sa/SAStatsCards";
import SAApprovalsTable from "@/components/sa/SAApprovalsTable";
import SACharts from "@/components/sa/SACharts";
import SAQuickLinks from "@/components/sa/SAQuickLinks";
import SAEmployeeOverview from "@/components/sa/SAEmployeeOverview";
import SARecentActivity from "@/components/sa/SARecentActivity";
import SASystemHealth from "@/components/sa/SASystemHealth";
import SARevenueSummary from "@/components/sa/SARevenueSummary";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";

export interface SAFilterState {
  campaignId: string;
  dataMode: string;
  websiteSource: string;
}

const SADashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [filters, setFilters] = useState<SAFilterState>({
    campaignId: "all",
    dataMode: "all",
    websiteSource: "all",
  });

  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [websites, setWebsites] = useState<{ id: string; site_name: string; campaign_id: string }[]>([]);

  useEffect(() => {
    supabase.from("campaigns").select("id, name").order("name").then(({ data }) => setCampaigns(data || []));
  }, []);

  useEffect(() => {
    const load = async () => {
      let q = supabase.from("campaign_websites").select("id, site_name, campaign_id").eq("is_active", true).order("site_name");
      if (filters.campaignId !== "all") q = q.eq("campaign_id", filters.campaignId);
      const { data } = await q;
      setWebsites(data || []);
      setFilters((prev) => ({ ...prev, websiteSource: "all" }));
    };
    load();
  }, [filters.campaignId]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "কোম্পানি অ্যানালিটিক্স" : "Company Analytics"}
        </h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          {isBn ? "রিয়েল-টাইম কোম্পানি পারফরম্যান্স ওভারভিউ" : "Real-time overview of company performance"}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-3 border border-border rounded-lg bg-card">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filters.campaignId} onValueChange={(v) => setFilters((p) => ({ ...p, campaignId: v }))}>
          <SelectTrigger className="w-48 bg-background border-border h-8 text-xs">
            <SelectValue placeholder={isBn ? "সব ক্যাম্পেইন" : "All Campaigns"} />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border max-h-60">
            <SelectItem value="all">{isBn ? "সব ক্যাম্পেইন" : "All Campaigns"}</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.dataMode} onValueChange={(v) => setFilters((p) => ({ ...p, dataMode: v }))}>
          <SelectTrigger className="w-40 bg-background border-border h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">{isBn ? "সব মোড" : "All Modes"}</SelectItem>
            <SelectItem value="lead">{isBn ? "লিড" : "Lead"}</SelectItem>
            <SelectItem value="processing">{isBn ? "প্রসেসিং" : "Processing"}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.websiteSource} onValueChange={(v) => setFilters((p) => ({ ...p, websiteSource: v }))}>
          <SelectTrigger className="w-48 bg-background border-border h-8 text-xs">
            <SelectValue placeholder={isBn ? "সব ওয়েবসাইট" : "All Websites"} />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border max-h-60">
            <SelectItem value="all">{isBn ? "সব ওয়েবসাইট" : "All Websites"}</SelectItem>
            {websites.map((w) => (
              <SelectItem key={w.id} value={w.site_name}>{w.site_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Row */}
      <SAStatsCards filters={filters} />

      {/* Two-column: Revenue + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SARevenueSummary />
        <SASystemHealth />
        <SAEmployeeOverview />
      </div>

      {/* Approvals */}
      <SAApprovalsTable />

      {/* Charts */}
      <SACharts filters={filters} />

      {/* Bottom: Recent Activity + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SARecentActivity />
        <SAQuickLinks />
      </div>
    </div>
  );
};

export default SADashboard;
