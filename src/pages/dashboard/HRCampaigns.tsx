import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, Globe, Plus, Copy, Trash2, ExternalLink, ChevronDown, X, Pencil, Save } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  data_mode: string;
  created_at: string;
  leadCount: number;
}

interface TLUser { id: string; name: string; }
interface Website { id: string; site_name: string; site_url: string; webhook_secret: string; is_active: boolean; data_mode?: string; }

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
  const [tlUsers, setTLUsers] = useState<TLUser[]>([]);
  const [selectedTLs, setSelectedTLs] = useState<string[]>([]);
  const [websites, setWebsites] = useState<{ name: string; url: string; dataMode: "lead" | "processing" }[]>([
    { name: "", url: "", dataMode: "lead" },
    { name: "", url: "", dataMode: "processing" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  // Detail
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [detailWebsites, setDetailWebsites] = useState<Website[]>([]);
  const [detailLeadStats, setDetailLeadStats] = useState<Record<string, number>>({});

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTLs, setEditTLs] = useState<string[]>([]);
  const [detailTLs, setDetailTLs] = useState<TLUser[]>([]);
  const [editWebsites, setEditWebsites] = useState<{ id?: string; site_name: string; site_url: string; is_active: boolean; data_mode: string }[]>([]);
  const [saving, setSaving] = useState(false);

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

  const addWebsite = () => setWebsites([...websites, { name: "", url: "", dataMode: "lead" }]);
  const removeWebsite = (i: number) => setWebsites(websites.filter((_, idx) => idx !== i));
  const updateWebsite = (i: number, field: "name" | "url" | "dataMode", val: string) => {
    const copy = [...websites];
    (copy[i] as any)[field] = val;
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
      .insert({ name: newName.trim(), status: "pending_sa", created_by: user.id, data_mode: "lead" })
      .select("id")
      .single();

    if (campErr || !camp) {
      toast({ title: "Error", description: campErr?.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Insert websites
    const siteInserts = validSites.map((s) => ({
      campaign_id: camp.id, site_name: s.name.trim(), site_url: s.url.trim(), data_mode: s.dataMode,
    }));
    await supabase.from("campaign_websites").insert(siteInserts);

    // SA approval
    const tlNames = tlUsers.filter((u) => selectedTLs.includes(u.id)).map((u) => u.name);
    await supabase.from("sa_approvals").insert({
      type: "new_campaign", requested_by: user.id, status: "pending",
      details: {
        campaign_id: camp.id, campaign_name: newName.trim(),
        websites: validSites.map((s) => ({ name: s.name, mode: s.dataMode })),
        assigned_tls: tlNames,
      },
    });

    toast({ title: isBn ? "Campaign SA approval-এর জন্য submit হয়েছে ✓" : "Campaign submitted for SA approval ✓" });
    setNewName(""); setSelectedTLs([]);
    setWebsites([{ name: "", url: "", dataMode: "lead" }, { name: "", url: "", dataMode: "processing" }]);
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
    setEditing(false);
    setDetailCampaign(campaigns.find((c) => c.id === id) || null);

    const [{ data: sites }, { data: leads }, { data: assignedTls }] = await Promise.all([
      supabase.from("campaign_websites").select("*").eq("campaign_id", id),
      supabase.from("leads").select("status").eq("campaign_id", id),
      supabase.from("campaign_tls").select("tl_id, users!campaign_tls_tl_id_fkey(id, name)").eq("campaign_id", id),
    ]);
    setDetailWebsites((sites as Website[]) || []);

    const assignedTlList = (assignedTls || []).map((t: any) => t.users).filter(Boolean);
    setDetailTLs(assignedTlList);

    const stats: Record<string, number> = { total: 0 };
    (leads || []).forEach((l) => { stats.total++; const s = l.status || "fresh"; stats[s] = (stats[s] || 0) + 1; });
    setDetailLeadStats(stats);
  };

  const startEditing = () => {
    if (!detailCampaign) return;
    setEditName(detailCampaign.name);
    setEditTLs(detailTLs.map((t) => t.id));
    setEditWebsites(detailWebsites.map((w) => ({ id: w.id, site_name: w.site_name, site_url: w.site_url, is_active: w.is_active, data_mode: w.data_mode || "lead" })));
    setEditing(true);
    // Refresh TL users to get latest employees
    fetchTLUsers();
  };

  const handleSaveEdit = async () => {
    if (!detailId || !editName.trim()) return;
    setSaving(true);

    // Update campaign name
    await supabase.from("campaigns").update({ name: editName.trim() }).eq("id", detailId);

    // Update TL assignments: delete old, insert new
    await supabase.from("campaign_tls").delete().eq("campaign_id", detailId);
    if (editTLs.length > 0) {
      await supabase.from("campaign_tls").insert(editTLs.map((tlId) => ({ campaign_id: detailId, tl_id: tlId })));
    }

    // Update websites: delete removed, upsert existing/new
    const existingIds = editWebsites.filter((w) => w.id).map((w) => w.id!);
    const toDelete = detailWebsites.filter((w) => !existingIds.includes(w.id));
    for (const d of toDelete) {
      await supabase.from("campaign_websites").delete().eq("id", d.id);
    }
    for (const w of editWebsites) {
      if (w.id) {
        await supabase.from("campaign_websites").update({ site_name: w.site_name, site_url: w.site_url, is_active: w.is_active, data_mode: w.data_mode } as any).eq("id", w.id);
      } else if (w.site_name.trim() && w.site_url.trim()) {
        await supabase.from("campaign_websites").insert({ campaign_id: detailId, site_name: w.site_name, site_url: w.site_url, is_active: w.is_active, data_mode: w.data_mode } as any);
      }
    }

    toast({ title: isBn ? "ক্যাম্পেইন আপডেট হয়েছে ✓" : "Campaign updated ✓" });
    setSaving(false);
    setEditing(false);
    fetchCampaigns();
    openDetail(detailId);
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
                    {isBn ? "Lead + Processing" : "Lead + Processing"}
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
          <div className="space-y-6">
            {/* Campaign Name */}
            <div>
              <label className="font-body text-sm font-medium text-foreground block mb-1">
                {isBn ? "ক্যাম্পেইন নাম *" : "Campaign Name *"}
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                {isBn
                  ? "📝 এমন একটি নাম দিন যা দেখে সবাই বুঝতে পারবে কোন প্রোডাক্ট বা প্রজেক্টের জন্য — যেমন: \"স্মার্টওয়াচ সেল Q1\", \"হেলথ ড্রিংক ক্যাম্পেইন\""
                  : "📝 Give a clear name so everyone knows the product/project — e.g. \"Smartwatch Sale Q1\", \"Health Drink Campaign\""}
              </p>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder={isBn ? "যেমন: স্মার্টওয়াচ সেল Q1" : "e.g. Smartwatch Sale Q1"} />
            </div>

            {/* WordPress Websites with per-site data mode */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-body text-sm font-medium text-foreground">
                  {isBn ? "WordPress ওয়েবসাইট *" : "WordPress Websites *"}
                </label>
                <Button variant="ghost" size="sm" onClick={addWebsite} className="text-primary">
                  <Plus className="h-3.5 w-3.5 mr-1" /> {isBn ? "আরো যোগ করুন" : "Add More"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {isBn
                  ? "🌐 প্রতিটি WordPress সাইটের নাম ও লিংক দিন এবং সেই সাইটের ডাটা কোন পদ্ধতিতে আসবে তা নির্ধারণ করুন। Campaign approve হলে Webhook URL ও Secret Key পাবেন যা WordPress সাইটে বসাতে হবে।"
                  : "🌐 Add each WordPress site's name & URL, then choose how data from that site should flow. After approval you'll get a Webhook URL & Secret to add to WordPress."}
              </p>
              <div className="space-y-4">
                {websites.map((w, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {isBn ? `সাইট #${i + 1}` : `Site #${i + 1}`}
                      </span>
                      {websites.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeWebsite(i)} className="text-destructive h-7 px-2">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">
                          {isBn ? "সাইটের নাম (যেমন: মূল সাইট)" : "Site Name (e.g. Main Site)"}
                        </label>
                        <Input
                          value={w.name} onChange={(e) => updateWebsite(i, "name", e.target.value)}
                          placeholder={isBn ? "যেমন: মূল সাইট" : "e.g. Main Site"}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground mb-1 block">
                          {isBn ? "সাইটের URL (পুরো লিংক)" : "Site URL (full link)"}
                        </label>
                        <Input
                          value={w.url} onChange={(e) => updateWebsite(i, "url", e.target.value)}
                          placeholder="https://yoursite.com"
                        />
                      </div>
                    </div>
                    {/* Per-site data mode */}
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1.5 block">
                        {isBn ? "এই সাইটের ডাটা কোন পদ্ধতিতে যাবে?" : "How should data from this site flow?"}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => updateWebsite(i, "dataMode", "lead")}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            w.dataMode === "lead"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          <p className="font-heading font-bold text-foreground text-xs">🎯 {isBn ? "লিড পদ্ধতি" : "Lead Mode"}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {isBn ? "TL → Bronze Agent → CSO → Warehouse → Steadfast → CS → Silver" : "TL → Bronze → CSO → WH → SF → CS → Silver"}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateWebsite(i, "dataMode", "processing")}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            w.dataMode === "processing"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          <p className="font-heading font-bold text-foreground text-xs">⚙️ {isBn ? "প্রসেসিং পদ্ধতি" : "Processing Mode"}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {isBn ? "TL সরাসরি → CSO → Warehouse → Steadfast" : "TL direct → CSO → WH → Steadfast"}
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TL Selection — Dropdown */}
            <div>
              <label className="font-body text-sm font-medium text-foreground block mb-1">
                {isBn ? "টিম লিডার নির্বাচন *" : "Assign Team Leaders *"}
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                {isBn
                  ? "👤 ড্রপডাউন থেকে টিম লিডার সিলেক্ট করুন। একাধিক TL সিলেক্ট করা যাবে।"
                  : "👤 Select Team Leader(s) from the dropdown. Multiple TLs can be selected."}
              </p>
              {/* Selected TL badges */}
              {selectedTLs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedTLs.map((tlId) => {
                    const tl = tlUsers.find((u) => u.id === tlId);
                    return tl ? (
                      <Badge key={tlId} variant="outline" className="border-primary/30 bg-primary/5 text-primary gap-1 pr-1">
                        {tl.name}
                        <button type="button" onClick={() => setSelectedTLs((prev) => prev.filter((x) => x !== tlId))}
                          className="hover:bg-primary/20 rounded-full p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal text-sm h-10">
                    <span className={selectedTLs.length === 0 ? "text-muted-foreground" : "text-foreground"}>
                      {selectedTLs.length === 0
                        ? (isBn ? "টিম লিডার সিলেক্ট করুন..." : "Select Team Leaders...")
                        : (isBn ? `${selectedTLs.length} জন সিলেক্ট করা হয়েছে` : `${selectedTLs.length} selected`)}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  {tlUsers.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground text-center">
                      {isBn ? "কোনো টিম লিডার পাওয়া যায়নি" : "No Team Leaders found"}
                    </p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto">
                      {tlUsers.map((tl) => {
                        const isSelected = selectedTLs.includes(tl.id);
                        return (
                          <button
                            key={tl.id}
                            type="button"
                            onClick={() => setSelectedTLs((prev) =>
                              prev.includes(tl.id) ? prev.filter((x) => x !== tl.id) : [...prev, tl.id]
                            )}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                              isSelected ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-accent"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? "border-primary bg-primary" : "border-muted-foreground/50"
                            }`}>
                              {isSelected && <span className="text-primary-foreground text-[10px]">✓</span>}
                            </div>
                            {tl.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <Button onClick={handleCreate} disabled={!newName.trim() || submitting}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11">
              {submitting ? (isBn ? "সাবমিট হচ্ছে..." : "Submitting...") : (isBn ? "সাবমিট করুন (SA Approval)" : "Submit (SA Approval)")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) { setDetailId(null); setEditing(false); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-3">
              <Megaphone className="h-5 w-5 text-primary" />
              {editing ? (
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="font-heading font-bold" />
              ) : (
                detailCampaign?.name || "Campaign"
              )}
            </DialogTitle>
          </DialogHeader>
          {detailCampaign && (
            <div className="space-y-5">
              {/* Status + Mode + Edit Button */}
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={statusColors[detailCampaign.status] || statusColors.draft}>
                  {detailCampaign.status}
                </Badge>
                {!editing && (
                  <div className="flex gap-1.5">
                    {detailWebsites.some(w => w.data_mode === "lead" || !w.data_mode) && (
                      <Badge variant="outline" className="border-primary/30 text-primary">🎯 {isBn ? "লিড" : "Lead"}</Badge>
                    )}
                    {detailWebsites.some(w => w.data_mode === "processing") && (
                      <Badge variant="outline" className="border-primary/30 text-primary">⚙️ {isBn ? "প্রসেসিং" : "Processing"}</Badge>
                    )}
                    {detailWebsites.length === 0 && (
                      <Badge variant="outline" className="text-muted-foreground">{isBn ? "ওয়েবসাইট নেই" : "No websites"}</Badge>
                    )}
                  </div>
                )}
                {(detailCampaign.status === "active" || detailCampaign.status === "paused") && !editing && (
                  <Button size="sm" variant="outline" onClick={() => { togglePause(detailCampaign); setDetailId(null); }}>
                    {detailCampaign.status === "active" ? (isBn ? "বিরতি" : "Pause") : (isBn ? "চালু" : "Resume")}
                  </Button>
                )}
                <div className="ml-auto flex gap-2">
                  {editing ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                        {isBn ? "বাতিল" : "Cancel"}
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="bg-primary text-primary-foreground">
                        <Save className="h-3.5 w-3.5 mr-1" />
                        {saving ? (isBn ? "সেভ হচ্ছে..." : "Saving...") : (isBn ? "সেভ করুন" : "Save")}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={startEditing}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      {isBn ? "এডিট" : "Edit"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Assigned TLs */}
              {editing ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{isBn ? "টিম লিডার" : "Team Leaders"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {editTLs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {editTLs.map((tlId) => {
                          const tl = tlUsers.find((u) => u.id === tlId);
                          return tl ? (
                            <Badge key={tlId} variant="outline" className="border-primary/30 bg-primary/5 text-primary gap-1 pr-1">
                              {tl.name}
                              <button type="button" onClick={() => setEditTLs((prev) => prev.filter((x) => x !== tlId))}
                                className="hover:bg-primary/20 rounded-full p-0.5">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal text-sm h-10">
                          <span className={editTLs.length === 0 ? "text-muted-foreground" : "text-foreground"}>
                            {editTLs.length === 0
                              ? (isBn ? "টিম লিডার সিলেক্ট করুন..." : "Select Team Leaders...")
                              : (isBn ? `${editTLs.length} জন সিলেক্ট করা হয়েছে` : `${editTLs.length} selected`)}
                          </span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <div className="max-h-52 overflow-y-auto">
                          {tlUsers.map((tl) => {
                            const isSelected = editTLs.includes(tl.id);
                            return (
                              <button key={tl.id} type="button"
                                onClick={() => setEditTLs((prev) => prev.includes(tl.id) ? prev.filter((x) => x !== tl.id) : [...prev, tl.id])}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${isSelected ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-accent"}`}>
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/50"}`}>
                                  {isSelected && <span className="text-primary-foreground text-[10px]">✓</span>}
                                </div>
                                {tl.name}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </CardContent>
                </Card>
              ) : detailTLs.length > 0 ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{isBn ? "অ্যাসাইন করা টিম লিডার" : "Assigned Team Leaders"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {detailTLs.map((tl) => (
                        <Badge key={tl.id} variant="outline" className="border-primary/30 text-primary">{tl.name}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {/* Data Flow Visualization */}
              {!editing && (
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
              )}

              {/* Websites */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {isBn ? "সংযুক্ত ওয়েবসাইট" : "Connected Websites"} ({editing ? editWebsites.length : detailWebsites.length})
                    {editing && (
                      <Button variant="ghost" size="sm" className="text-primary ml-auto"
                        onClick={() => setEditWebsites([...editWebsites, { site_name: "", site_url: "", is_active: true, data_mode: "lead" }])}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> {isBn ? "যোগ" : "Add"}
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editing ? (
                    editWebsites.map((site, i) => (
                      <div key={i} className="p-3 rounded-lg border border-border bg-background space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{isBn ? `সাইট #${i + 1}` : `Site #${i + 1}`}</span>
                          {editWebsites.length > 1 && (
                            <Button variant="ghost" size="sm" className="text-destructive h-7 px-2"
                              onClick={() => setEditWebsites(editWebsites.filter((_, idx) => idx !== i))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input value={site.site_name} placeholder={isBn ? "সাইটের নাম" : "Site Name"}
                            onChange={(e) => { const c = [...editWebsites]; c[i].site_name = e.target.value; setEditWebsites(c); }} />
                          <Input value={site.site_url} placeholder="https://..."
                            onChange={(e) => { const c = [...editWebsites]; c[i].site_url = e.target.value; setEditWebsites(c); }} />
                        </div>
                        {/* Data mode selector */}
                        <div>
                          <label className="text-[11px] text-muted-foreground mb-1.5 block">
                            {isBn ? "এই সাইটের ডাটা কোন পদ্ধতিতে যাবে?" : "How should data from this site flow?"}
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => { const c = [...editWebsites]; c[i].data_mode = "lead"; setEditWebsites(c); }}
                              className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                                site.data_mode === "lead"
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/30"
                              }`}
                            >
                              <p className="font-heading font-bold text-foreground text-xs">🎯 {isBn ? "লিড" : "Lead"}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {isBn ? "TL → Bronze → CSO → WH → SF → CS → Silver" : "TL → Bronze → CSO → WH → SF → CS → Silver"}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => { const c = [...editWebsites]; c[i].data_mode = "processing"; setEditWebsites(c); }}
                              className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                                site.data_mode === "processing"
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/30"
                              }`}
                            >
                              <p className="font-heading font-bold text-foreground text-xs">⚙️ {isBn ? "প্রসেসিং" : "Processing"}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {isBn ? "TL সরাসরি → CSO → WH → Steadfast" : "TL direct → CSO → WH → Steadfast"}
                              </p>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    detailWebsites.map((site) => (
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
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Lead Stats */}
              {!editing && (
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
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRCampaigns;
