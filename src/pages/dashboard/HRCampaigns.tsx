import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, Globe, Plus, Copy, Trash2, ExternalLink } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  data_mode: string;
  created_at: string;
  leadCount: number;
}

interface TLUser { id: string; name: string; }
interface Website { id: string; site_name: string; site_url: string; webhook_secret: string; is_active: boolean; }

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  pending_sa: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
};

const HRCampaigns = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isBn = t("vencon") === "VENCON";

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(searchParams.get("new") === "true");

  // Create form
  const [newName, setNewName] = useState("");
  const [dataMode, setDataMode] = useState<"lead" | "processing">("lead");
  const [tlUsers, setTLUsers] = useState<TLUser[]>([]);
  const [selectedTLs, setSelectedTLs] = useState<string[]>([]);
  const [websites, setWebsites] = useState<{ name: string; url: string }[]>([{ name: "", url: "" }]);
  const [submitting, setSubmitting] = useState(false);

  // Detail
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [detailWebsites, setDetailWebsites] = useState<Website[]>([]);
  const [detailLeadStats, setDetailLeadStats] = useState<Record<string, number>>({});

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => { fetchCampaigns(); fetchTLUsers(); }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data: camps } = await supabase
      .from("campaigns")
      .select("id, name, status, data_mode, created_at")
      .order("created_at", { ascending: false });
    if (!camps) { setLoading(false); return; }

    const ids = camps.map((c) => c.id);
    const { data: leads } = await supabase.from("leads").select("campaign_id").in("campaign_id", ids);
    const counts: Record<string, number> = {};
    (leads || []).forEach((l) => { if (l.campaign_id) counts[l.campaign_id] = (counts[l.campaign_id] || 0) + 1; });

    setCampaigns(camps.map((c) => ({
      id: c.id, name: c.name, status: c.status || "draft",
      data_mode: (c as any).data_mode || "lead",
      created_at: c.created_at || "", leadCount: counts[c.id] || 0,
    })));
    setLoading(false);
  };

  const fetchTLUsers = async () => {
    const { data } = await supabase.from("users").select("id, name").eq("panel", "tl").eq("is_active", true);
    if (data) setTLUsers(data);
  };

  const addWebsite = () => setWebsites([...websites, { name: "", url: "" }]);
  const removeWebsite = (i: number) => setWebsites(websites.filter((_, idx) => idx !== i));
  const updateWebsite = (i: number, field: "name" | "url", val: string) => {
    const copy = [...websites];
    copy[i][field] = val;
    setWebsites(copy);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !user) return;
    const validSites = websites.filter((w) => w.name.trim() && w.url.trim());
    if (validSites.length === 0) {
      toast({ title: isBn ? "কমপক্ষে একটি ওয়েবসাইট যোগ করুন" : "Add at least one website", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    const { data: camp, error: campErr } = await supabase
      .from("campaigns")
      .insert({ name: newName.trim(), status: "pending_sa", created_by: user.id, data_mode: dataMode })
      .select("id")
      .single();

    if (campErr || !camp) {
      toast({ title: "Error", description: campErr?.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Insert websites
    const siteInserts = validSites.map((s) => ({
      campaign_id: camp.id, site_name: s.name.trim(), site_url: s.url.trim(),
    }));
    await supabase.from("campaign_websites").insert(siteInserts);

    // SA approval
    const tlNames = tlUsers.filter((u) => selectedTLs.includes(u.id)).map((u) => u.name);
    await supabase.from("sa_approvals").insert({
      type: "new_campaign", requested_by: user.id, status: "pending",
      details: {
        campaign_id: camp.id, campaign_name: newName.trim(),
        data_mode: dataMode, websites: validSites.map((s) => s.name),
        assigned_tls: tlNames,
      },
    });

    toast({ title: isBn ? "Campaign SA approval-এর জন্য submit হয়েছে ✓" : "Campaign submitted for SA approval ✓" });
    setNewName(""); setSelectedTLs([]); setDataMode("lead");
    setWebsites([{ name: "", url: "" }]);
    setShowCreate(false); setSearchParams({});
    setSubmitting(false); fetchCampaigns();
  };

  const togglePause = async (c: Campaign) => {
    const newStatus = c.status === "active" ? "paused" : "active";
    await supabase.from("campaigns").update({ status: newStatus }).eq("id", c.id);
    fetchCampaigns();
  };

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetailCampaign(campaigns.find((c) => c.id === id) || null);

    const [{ data: sites }, { data: leads }] = await Promise.all([
      supabase.from("campaign_websites").select("*").eq("campaign_id", id),
      supabase.from("leads").select("status").eq("campaign_id", id),
    ]);
    setDetailWebsites((sites as Website[]) || []);

    const stats: Record<string, number> = { total: 0 };
    (leads || []).forEach((l) => { stats.total++; const s = l.status || "fresh"; stats[s] = (stats[s] || 0) + 1; });
    setDetailLeadStats(stats);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: isBn ? "কপি হয়েছে!" : "Copied!" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">
            {isBn ? "ক্যাম্পেইন ম্যানেজমেন্ট" : "Campaign Management"}
          </h2>
          <p className="font-body text-sm text-muted-foreground mt-1">
            {isBn ? "WordPress ওয়েবসাইট থেকে ডাটা সংগ্রহ ও পরিচালনা" : "Collect & manage data from WordPress websites"}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          {isBn ? "নতুন Campaign" : "New Campaign"}
        </Button>
      </div>

      {/* Campaign Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 h-40 animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{isBn ? "কোনো ক্যাম্পেইন নেই" : "No campaigns yet"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(c.id)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Megaphone className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-heading font-bold text-foreground">{c.name}</h3>
                  </div>
                  <Badge className={statusColors[c.status] || statusColors.draft}>
                    {c.status === "active" ? (isBn ? "সক্রিয়" : "Active") :
                     c.status === "paused" ? (isBn ? "বিরতি" : "Paused") :
                     c.status === "pending_sa" ? (isBn ? "SA পেন্ডিং" : "Pending SA") :
                     c.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" />
                    {c.data_mode === "lead" ? (isBn ? "লিড" : "Lead") : (isBn ? "প্রসেসিং" : "Processing")}
                  </span>
                  <span>{c.leadCount} {isBn ? "ডাটা" : "Data"}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(c.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setSearchParams({}); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {isBn ? "নতুন Campaign তৈরি করুন" : "Create New Campaign"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Name */}
            <div>
              <label className="font-body text-sm font-medium text-foreground block mb-1.5">
                {isBn ? "ক্যাম্পেইন নাম *" : "Campaign Name *"}
              </label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder={isBn ? "ক্যাম্পেইনের নাম লিখুন" : "Enter campaign name"} />
            </div>

            {/* Data Mode */}
            <div>
              <label className="font-body text-sm font-medium text-foreground block mb-1.5">
                {isBn ? "ডাটা পদ্ধতি *" : "Data Mode *"}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDataMode("lead")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    dataMode === "lead"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <p className="font-heading font-bold text-foreground text-sm">{isBn ? "🎯 লিড পদ্ধতি" : "🎯 Lead Mode"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isBn ? "ডাটা → TL → Bronze Agent → CSO → Warehouse → Steadfast → CS → Silver" : "Data → TL → Bronze Agent → CSO → Warehouse → Steadfast → CS → Silver"}
                  </p>
                </button>
                <button
                  onClick={() => setDataMode("processing")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    dataMode === "processing"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <p className="font-heading font-bold text-foreground text-sm">{isBn ? "⚙️ প্রসেসিং পদ্ধতি" : "⚙️ Processing Mode"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isBn ? "সেলস হওয়া ডাটা → TL → CSO → Warehouse → Steadfast (Agent ছাড়া)" : "Sold data → TL → CSO → Warehouse → Steadfast (No Agent)"}
                  </p>
                </button>
              </div>
            </div>

            {/* WordPress Websites */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-body text-sm font-medium text-foreground">
                  {isBn ? "WordPress ওয়েবসাইট *" : "WordPress Websites *"}
                </label>
                <Button variant="ghost" size="sm" onClick={addWebsite} className="text-primary">
                  <Plus className="h-3.5 w-3.5 mr-1" /> {isBn ? "আরো যোগ করুন" : "Add More"}
                </Button>
              </div>
              <div className="space-y-3">
                {websites.map((w, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={w.name} onChange={(e) => updateWebsite(i, "name", e.target.value)}
                      placeholder={isBn ? "সাইটের নাম" : "Site Name"} className="flex-1"
                    />
                    <Input
                      value={w.url} onChange={(e) => updateWebsite(i, "url", e.target.value)}
                      placeholder="https://example.com" className="flex-[2]"
                    />
                    {websites.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeWebsite(i)} className="text-destructive shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* TL Selection */}
            <div>
              <label className="font-body text-sm font-medium text-foreground block mb-1.5">
                {isBn ? "টিম লিডার নির্বাচন" : "Assign Team Leaders"}
              </label>
              <div className="border border-border rounded-lg bg-background max-h-40 overflow-y-auto">
                {tlUsers.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">{isBn ? "কোনো TL পাওয়া যায়নি" : "No TLs found"}</p>
                ) : tlUsers.map((tl) => (
                  <label key={tl.id} className="flex items-center gap-2 p-2.5 hover:bg-accent cursor-pointer text-sm text-foreground">
                    <input type="checkbox" checked={selectedTLs.includes(tl.id)}
                      onChange={() => setSelectedTLs((prev) => prev.includes(tl.id) ? prev.filter((x) => x !== tl.id) : [...prev, tl.id])}
                      className="accent-[hsl(var(--primary))]" />
                    {tl.name}
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={handleCreate} disabled={!newName.trim() || submitting}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {submitting ? (isBn ? "সাবমিট হচ্ছে..." : "Submitting...") : (isBn ? "সাবমিট করুন (SA Approval)" : "Submit (SA Approval)")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) setDetailId(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-3">
              <Megaphone className="h-5 w-5 text-primary" />
              {detailCampaign?.name || "Campaign"}
            </DialogTitle>
          </DialogHeader>
          {detailCampaign && (
            <div className="space-y-5">
              {/* Status + Mode */}
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={statusColors[detailCampaign.status] || statusColors.draft}>
                  {detailCampaign.status}
                </Badge>
                <Badge variant="outline" className="border-primary/30 text-primary">
                  {detailCampaign.data_mode === "lead" ? (isBn ? "🎯 লিড পদ্ধতি" : "🎯 Lead Mode") : (isBn ? "⚙️ প্রসেসিং" : "⚙️ Processing")}
                </Badge>
                {(detailCampaign.status === "active" || detailCampaign.status === "paused") && (
                  <Button size="sm" variant="outline" onClick={() => { togglePause(detailCampaign); setDetailId(null); }}>
                    {detailCampaign.status === "active" ? (isBn ? "বিরতি" : "Pause") : (isBn ? "চালু" : "Resume")}
                  </Button>
                )}
              </div>

              {/* Data Flow Visualization */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{isBn ? "ডাটা ফ্লো" : "Data Flow"}</CardTitle>
                </CardHeader>
                <CardContent>
                  {detailCampaign.data_mode === "lead" ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-body">
                      {["WordPress", "SA/HR/BDO", "TL", "Bronze Agent", "CSO", "Warehouse", "Steadfast", "Delivery Coordinator", "CS", "TL (Silver)", "Silver Agent"].map((step, i) => (
                        <span key={i} className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary font-medium">{step}</span>
                          {i < 10 && <span className="text-muted-foreground">→</span>}
                        </span>
                      ))}
                      <span className="text-muted-foreground ml-1">🔄</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-body">
                      {["WordPress", "SA/HR/BDO", "TL", "CSO", "Warehouse", "Steadfast", "Delivery Coordinator", "CS"].map((step, i) => (
                        <span key={i} className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-md bg-accent text-accent-foreground font-medium">{step}</span>
                          {i < 7 && <span className="text-muted-foreground">→</span>}
                        </span>
                      ))}
                      <span className="text-muted-foreground ml-1">🔄</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Websites */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {isBn ? "সংযুক্ত ওয়েবসাইট" : "Connected Websites"} ({detailWebsites.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {detailWebsites.map((site) => (
                    <div key={site.id} className="p-3 rounded-lg border border-border bg-background">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${site.is_active ? "bg-green-500" : "bg-muted-foreground"}`} />
                          <span className="font-heading font-bold text-sm text-foreground">{site.site_name}</span>
                        </div>
                        <a href={site.site_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs flex items-center gap-1 hover:underline">
                          <ExternalLink className="h-3 w-3" /> {isBn ? "দেখুন" : "Visit"}
                        </a>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">Webhook:</span>
                          <code className="text-[11px] bg-muted px-2 py-1 rounded flex-1 truncate">
                            {supabaseUrl}/functions/v1/import-leads/{detailCampaign.id}
                          </code>
                          <button onClick={() => copyText(`${supabaseUrl}/functions/v1/import-leads/${detailCampaign.id}`)}
                            className="text-muted-foreground hover:text-primary">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">Secret:</span>
                          <code className="text-[11px] bg-muted px-2 py-1 rounded flex-1 truncate">
                            {"•".repeat(16)}{site.webhook_secret.slice(-8)}
                          </code>
                          <button onClick={() => copyText(site.webhook_secret)}
                            className="text-muted-foreground hover:text-primary">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Lead Stats */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{isBn ? "ডাটা পরিসংখ্যান" : "Data Statistics"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {Object.entries(detailLeadStats).map(([key, val]) => (
                      <div key={key} className="bg-background rounded-lg p-3 text-center border border-border">
                        <p className="text-[10px] text-muted-foreground capitalize">{key}</p>
                        <p className="font-heading text-lg font-bold text-foreground">{val}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRCampaigns;
