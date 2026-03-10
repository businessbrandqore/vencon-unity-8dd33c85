import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const BLUE = "#1D4ED8";

interface Campaign {
  id: string;
  name: string;
  status: string;
  created_at: string;
  leadCount: number;
  assignedTLs: string[];
}

interface TLUser {
  id: string;
  name: string;
}

const statusBadge = (status: string, isBn: boolean) => {
  const map: Record<string, { label: string; color: string }> = {
    active: { label: isBn ? "সক্রিয়" : "Active", color: "#22C55E" },
    paused: { label: isBn ? "বিরতি" : "Paused", color: "#F59E0B" },
    pending_sa: { label: isBn ? "SA অনুমোদন পেন্ডিং" : "Pending SA", color: "#F97316" },
    draft: { label: isBn ? "ড্রাফট" : "Draft", color: "#6B7280" },
    archived: { label: isBn ? "আর্কাইভ" : "Archived", color: "#6B7280" },
  };
  const s = map[status] || { label: status, color: "#6B7280" };
  return (
    <span
      className="inline-block px-2 py-0.5 text-[10px] font-bold text-white"
      style={{ backgroundColor: s.color }}
    >
      {s.label}
    </span>
  );
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

  // Create form state
  const [newName, setNewName] = useState("");
  const [tlUsers, setTLUsers] = useState<TLUser[]>([]);
  const [selectedTLs, setSelectedTLs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Detail view
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    campaign: Campaign | null;
    leadStats: Record<string, number>;
    tlPerformance: { name: string; confirmed: number; delivered: number; ratio: number }[];
  } | null>(null);

  useEffect(() => {
    fetchCampaigns();
    fetchTLUsers();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data: camps } = await supabase
      .from("campaigns")
      .select("id, name, status, created_at")
      .order("created_at", { ascending: false });

    if (!camps) {
      setLoading(false);
      return;
    }

    // Get lead counts per campaign
    const campaignIds = camps.map((c) => c.id);
    const { data: leads } = await supabase
      .from("leads")
      .select("campaign_id")
      .in("campaign_id", campaignIds);

    const leadCounts: Record<string, number> = {};
    (leads || []).forEach((l) => {
      if (l.campaign_id) leadCounts[l.campaign_id] = (leadCounts[l.campaign_id] || 0) + 1;
    });

    setCampaigns(
      camps.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status || "draft",
        created_at: c.created_at || "",
        leadCount: leadCounts[c.id] || 0,
        assignedTLs: [],
      }))
    );
    setLoading(false);
  };

  const fetchTLUsers = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, name")
      .eq("panel", "tl")
      .eq("is_active", true);
    if (data) setTLUsers(data);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !user) return;
    setSubmitting(true);

    // Insert campaign
    const { data: camp, error: campErr } = await supabase
      .from("campaigns")
      .insert({
        name: newName.trim(),
        status: "pending_sa",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (campErr || !camp) {
      toast({ title: "Error", description: campErr?.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Insert SA approval
    const tlNames = tlUsers
      .filter((u) => selectedTLs.includes(u.id))
      .map((u) => u.name);

    await supabase.from("sa_approvals").insert({
      type: "new_campaign",
      requested_by: user.id,
      status: "pending",
      details: {
        campaign_id: camp.id,
        campaign_name: newName.trim(),
        assigned_tls: tlNames,
      },
    });

    // Notify SA users
    const { data: saUsers } = await supabase
      .from("users")
      .select("id")
      .eq("panel", "sa")
      .eq("is_active", true);

    if (saUsers) {
      const notifications = saUsers.map((sa) => ({
        user_id: sa.id,
        title: isBn
          ? `নতুন campaign approval দরকার: ${newName.trim()}`
          : `New campaign needs approval: ${newName.trim()}`,
        type: "approval",
      }));
      await supabase.from("notifications").insert(notifications);
    }

    toast({
      title: isBn
        ? "Campaign SA approval-এর জন্য submit হয়েছে ✓"
        : "Campaign submitted for SA approval ✓",
    });

    setNewName("");
    setSelectedTLs([]);
    setShowCreate(false);
    setSearchParams({});
    setSubmitting(false);
    fetchCampaigns();
  };

  const togglePause = async (campaign: Campaign) => {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    await supabase
      .from("campaigns")
      .update({ status: newStatus })
      .eq("id", campaign.id);
    fetchCampaigns();
  };

  const openDetail = async (id: string) => {
    setDetailId(id);
    const camp = campaigns.find((c) => c.id === id) || null;

    // Lead stats
    const { data: leads } = await supabase
      .from("leads")
      .select("status")
      .eq("campaign_id", id);

    const leadStats: Record<string, number> = { total: 0, fresh: 0, in_progress: 0, confirmed: 0, delivered: 0, cancelled: 0 };
    (leads || []).forEach((l) => {
      leadStats.total++;
      const s = l.status || "fresh";
      leadStats[s] = (leadStats[s] || 0) + 1;
    });

    // Orders for this campaign's leads
    const leadIds = (leads || []).map(() => id); // we need lead ids
    const { data: campaignOrders } = await supabase
      .from("orders")
      .select("agent_id, delivery_status")
      .in("lead_id", (leads || []).map((l) => id)); // simplified

    setDetail({
      campaign: camp,
      leadStats,
      tlPerformance: [],
    });
  };

  const webhookUrl = `https://glpspuybeyayqwxkpfqb.supabase.co/functions/v1/lead-webhook`;

  const toggleTL = (id: string) => {
    setSelectedTLs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "ক্যাম্পেইন ম্যানেজমেন্ট" : "Campaign Management"}
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-body font-bold text-white transition-colors"
          style={{ backgroundColor: BLUE }}
        >
          {isBn ? "➕ নতুন Campaign তৈরি করুন" : "➕ Create Campaign"}
        </button>
      </div>

      {/* Campaign List */}
      {loading ? (
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="border border-border">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="bg-secondary text-muted-foreground text-[11px]">
                <th className="text-left p-3">{isBn ? "ক্যাম্পেইন নাম" : "Campaign Name"}</th>
                <th className="text-left p-3">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                <th className="text-right p-3">{isBn ? "লিড সংখ্যা" : "Lead Count"}</th>
                <th className="text-left p-3">{isBn ? "তারিখ" : "Created"}</th>
                <th className="text-right p-3">{isBn ? "অ্যাকশন" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/50">
                  <td className="p-3">
                    <button
                      onClick={() => openDetail(c.id)}
                      className="text-foreground hover:underline font-bold"
                    >
                      {c.name}
                    </button>
                  </td>
                  <td className="p-3">{statusBadge(c.status, isBn)}</td>
                  <td className="p-3 text-right text-foreground">{c.leadCount}</td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    {(c.status === "active" || c.status === "paused") && (
                      <button
                        onClick={() => togglePause(c)}
                        className="text-xs px-2 py-1 border border-border text-foreground hover:bg-secondary"
                      >
                        {c.status === "active"
                          ? isBn ? "বিরতি" : "Pause"
                          : isBn ? "চালু" : "Resume"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {isBn ? "কোনো ক্যাম্পেইন নেই" : "No campaigns"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setSearchParams({}); }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-foreground">
              {isBn ? "নতুন Campaign তৈরি করুন" : "Create New Campaign"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">
                {isBn ? "ক্যাম্পেইন নাম *" : "Campaign Name *"}
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={isBn ? "ক্যাম্পেইনের নাম লিখুন" : "Enter campaign name"}
                className="bg-background border-border text-foreground"
              />
            </div>

            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">
                {isBn ? "লিড ক্যাপচার মেথড" : "Lead Capture Method"}
              </label>
              <div className="bg-secondary p-3 text-xs text-foreground font-body">
                WordPress Webhook Integration
              </div>
            </div>

            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">
                Webhook URL ({isBn ? "কপি করুন" : "copy this"})
              </label>
              <div className="bg-secondary p-2 text-xs text-muted-foreground font-mono break-all select-all">
                {webhookUrl}
              </div>
            </div>

            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">
                {isBn ? "টিম লিডার নির্বাচন করুন" : "Assign Team Leaders"}
              </label>
              <div className="border border-border bg-background max-h-40 overflow-y-auto">
                {tlUsers.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">
                    {isBn ? "কোনো TL পাওয়া যায়নি" : "No TLs found"}
                  </p>
                ) : (
                  tlUsers.map((tl) => (
                    <label
                      key={tl.id}
                      className="flex items-center gap-2 p-2 hover:bg-secondary cursor-pointer text-xs text-foreground"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTLs.includes(tl.id)}
                        onChange={() => toggleTL(tl.id)}
                        className="accent-[#1D4ED8]"
                      />
                      {tl.name}
                    </label>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!newName.trim() || submitting}
              className="w-full py-2 text-sm font-body font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: BLUE }}
            >
              {submitting
                ? isBn ? "সাবমিট হচ্ছে..." : "Submitting..."
                : isBn ? "সাবমিট করুন" : "Submit"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) setDetailId(null); }}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-foreground">
              {detail?.campaign?.name || "Campaign"}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {statusBadge(detail.campaign?.status || "draft", isBn)}
                {(detail.campaign?.status === "active" || detail.campaign?.status === "paused") && (
                  <button
                    onClick={() => {
                      if (detail.campaign) togglePause(detail.campaign);
                      setDetailId(null);
                    }}
                    className="text-xs px-2 py-1 border border-border text-foreground hover:bg-secondary"
                  >
                    {detail.campaign?.status === "active"
                      ? isBn ? "বিরতি দিন" : "Pause"
                      : isBn ? "চালু করুন" : "Resume"}
                  </button>
                )}
              </div>

              <div>
                <h4 className="font-heading text-sm font-bold text-foreground mb-2">
                  {isBn ? "লিড পরিসংখ্যান" : "Lead Stats"}
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-[1px] bg-border">
                  {Object.entries(detail.leadStats).map(([key, val]) => (
                    <div key={key} className="bg-background p-3 text-center">
                      <p className="text-[10px] text-muted-foreground capitalize">{key}</p>
                      <p className="font-heading text-lg font-bold text-foreground">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRCampaigns;
