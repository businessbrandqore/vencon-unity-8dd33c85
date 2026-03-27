import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldBan, RotateCcw, Trash2, Forward, Clock, Filter, Calendar } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CopyButton from "@/components/ui/CopyButton";
import LeadRatioBar from "@/components/LeadRatioBar";

interface SpamLead {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  status: string | null;
  agent_type: string | null;
  updated_at: string | null;
  assigned_to: string | null;
  assigned_agent_name?: string;
  campaign_id?: string | null;
  import_source?: string | null;
  source?: string | null;
  spam_transferred_at?: string | null;
  spam_original_agent?: string | null;
  original_agent_name?: string;
  fraud_total?: number | null;
  fraud_success?: number | null;
  fraud_cancel?: number | null;
  fraud_check_error?: string | null;
  fraud_checked_at?: string | null;
}

// Helper to determine lead mode from import_source
const getLeadMode = (importSource: string | null | undefined): "lead" | "processing" => {
  if (!importSource) return "lead";
  return importSource.toLowerCase().includes("processing") ? "processing" : "lead";
};

export default function SpamLeads() {
  const { user } = useAuth();
  const [myLeads, setMyLeads] = useState<SpamLead[]>([]);
  const [transferredLeads, setTransferredLeads] = useState<SpamLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filter states
  const [filterCampaignId, setFilterCampaignId] = useState<string>("all");
  const [filterDataMode, setFilterDataMode] = useState<string>("all");
  const [filterWebsite, setFilterWebsite] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; data_mode: string }[]>([]);
  const [websites, setWebsites] = useState<{ id: string; site_name: string; campaign_id: string }[]>([]);

  const isTLOrATL = user?.role === "team_leader" || user?.role === "Team Leader" ||
    user?.role === "Assistant Team Leader" || user?.panel === "tl";

  const loadSpamLeads = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    if (!isTLOrATL) {
      // Agent: load own spam leads (not yet transferred)
      const { data: ownData } = await supabase
        .from("leads")
        .select("id, name, phone, address, status, agent_type, updated_at, assigned_to, campaign_id, import_source, source, spam_transferred_at, fraud_total, fraud_success, fraud_cancel, fraud_check_error, fraud_checked_at")
        .eq("assigned_to", user.id)
        .eq("is_spam", true)
        .is("spam_transferred_at", null)
        .order("updated_at", { ascending: false });
      setMyLeads((ownData as SpamLead[]) || []);
      setTransferredLeads([]);
    } else {
      // TL/ATL: load transferred spam leads (spam_transferred_at IS NOT NULL, tl_id = me)
      const { data: transferred } = await supabase
        .from("leads")
        .select("id, name, phone, address, status, agent_type, updated_at, assigned_to, campaign_id, import_source, source, spam_transferred_at, spam_original_agent, fraud_total, fraud_success, fraud_cancel, fraud_check_error, fraud_checked_at")
        .eq("is_spam", true)
        .not("spam_transferred_at", "is", null)
        .order("spam_transferred_at", { ascending: false });

      if (transferred && transferred.length > 0) {
        // Get original agent names
        const agentIds = [...new Set(transferred.map(l => l.spam_original_agent).filter(Boolean))] as string[];
        const { data: agents } = await supabase.from("users").select("id, name").in("id", agentIds);
        const nameMap: Record<string, string> = {};
        (agents || []).forEach(a => { nameMap[a.id] = a.name; });

        setTransferredLeads(transferred.map(l => ({
          ...l,
          original_agent_name: l.spam_original_agent ? nameMap[l.spam_original_agent] || "—" : "—",
        })) as SpamLead[]);
      } else {
        setTransferredLeads([]);
      }

      // Also load own spam (if TL/ATL has own spam leads)
      const { data: ownData } = await supabase
        .from("leads")
        .select("id, name, phone, address, status, agent_type, updated_at, assigned_to, campaign_id, import_source, source, spam_transferred_at, fraud_total, fraud_success, fraud_cancel, fraud_check_error, fraud_checked_at")
        .eq("assigned_to", user.id)
        .eq("is_spam", true)
        .is("spam_transferred_at", null)
        .order("updated_at", { ascending: false });
      setMyLeads((ownData as SpamLead[]) || []);
    }

    setLoading(false);
  }, [user, isTLOrATL]);

  useEffect(() => { loadSpamLeads(); }, [loadSpamLeads]);

  // Load campaigns & websites for filters
  useEffect(() => {
    const allLeads = [...myLeads, ...transferredLeads];
    const campaignIds = [...new Set(allLeads.map(l => l.campaign_id).filter(Boolean))] as string[];
    if (campaignIds.length === 0) { setCampaigns([]); setWebsites([]); return; }
    (async () => {
      const [{ data: campData }, { data: siteData }] = await Promise.all([
        supabase.from("campaigns").select("id, name, data_mode").in("id", campaignIds),
        supabase.from("campaign_websites").select("id, site_name, campaign_id").in("campaign_id", campaignIds).eq("is_active", true),
      ]);
      if (campData) setCampaigns(campData);
      if (siteData) setWebsites(siteData);
    })();
  }, [myLeads, transferredLeads]);

  // Filter function
  const applyFilters = (leads: SpamLead[]) => {
    let result = leads;
    if (filterCampaignId !== "all") result = result.filter(l => l.campaign_id === filterCampaignId);
    if (filterDataMode !== "all") {
      result = result.filter(l => getLeadMode(l.import_source) === filterDataMode);
    }
    if (filterWebsite !== "all") result = result.filter(l => l.source === filterWebsite);
    if (filterDate) {
      result = result.filter(l => {
        const dateStr = l.spam_transferred_at || l.updated_at;
        return dateStr && dateStr.startsWith(filterDate);
      });
    }
    return result;
  };

  const filteredMyLeads = useMemo(() => applyFilters(myLeads), [myLeads, filterCampaignId, filterDataMode, filterWebsite, filterDate]);
  const filteredTransferredLeads = useMemo(() => applyFilters(transferredLeads), [transferredLeads, filterCampaignId, filterDataMode, filterWebsite, filterDate]);

  const handleRestore = async (leadId: string) => {
    const { error } = await supabase
      .from("leads")
      .update({ is_spam: false, status: "fresh", spam_transferred_at: null, spam_original_agent: null } as any)
      .eq("id", leadId);
    if (error) { toast.error("রিস্টোর করা যায়নি"); return; }
    toast.success("লিড রিস্টোর হয়েছে ✓");
    setMyLeads(prev => prev.filter(l => l.id !== leadId));
    setTransferredLeads(prev => prev.filter(l => l.id !== leadId));
  };

  const handleForwardToOriginalAgent = async (lead: SpamLead) => {
    if (!lead.spam_original_agent) {
      toast.error("মূল এজেন্ট পাওয়া যায়নি");
      return;
    }
    const { error } = await supabase
      .from("leads")
      .update({
        is_spam: false,
        status: "fresh",
        assigned_to: lead.spam_original_agent,
        spam_transferred_at: null,
        spam_original_agent: null,
      } as any)
      .eq("id", lead.id);
    if (error) { toast.error("ফরওয়ার্ড করা যায়নি"); return; }
    toast.success(`${lead.original_agent_name || "এজেন্ট"}-এর কাছে ফেরত পাঠানো হয়েছে ✓`);
    setTransferredLeads(prev => prev.filter(l => l.id !== lead.id));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("leads").delete().eq("id", deleteId);
    if (error) { toast.error("ডিলিট করা যায়নি"); } else {
      toast.success("লিড ডিলিট হয়েছে");
      setMyLeads(prev => prev.filter(l => l.id !== deleteId));
      setTransferredLeads(prev => prev.filter(l => l.id !== deleteId));
    }
    setDeleteId(null);
  };

  const getTimeRemaining = (updatedAt: string | null) => {
    if (!updatedAt) return null;
    const spamTime = new Date(updatedAt).getTime();
    const deleteTime = spamTime + 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (now >= deleteTime) return "TL-এ ট্রান্সফার হবে";
    const hoursLeft = Math.ceil((deleteTime - now) / (60 * 60 * 1000));
    return `${hoursLeft} ঘণ্টা বাকি`;
  };

  if (loading) return <LoadingSpinner text="লোড হচ্ছে..." />;

  const filteredSites = filterCampaignId !== "all"
    ? websites.filter(w => w.campaign_id === filterCampaignId)
    : websites;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldBan className="h-5 w-5 text-destructive" />
        <h2 className="font-heading text-xl font-bold text-foreground">স্প্যাম</h2>
        <span className="text-sm text-muted-foreground">
          ({filteredMyLeads.length + filteredTransferredLeads.length})
        </span>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        {isTLOrATL
          ? "এজেন্টদের স্প্যাম ডাটা ২৪ ঘণ্টা পর এখানে ট্রান্সফার হয়"
          : "স্প্যাম ডাটা ২৪ ঘণ্টা পর TL-এ ট্রান্সফার হবে"
        }
      </p>

      {/* Filters */}
      {(campaigns.length > 0 || isTLOrATL) && (
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {campaigns.length > 0 && (
            <Select value={filterCampaignId} onValueChange={v => { setFilterCampaignId(v); setFilterWebsite("all"); }}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="ক্যাম্পেইন" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব ক্যাম্পেইন</SelectItem>
                {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={filterDataMode} onValueChange={setFilterDataMode}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="ডাটা মোড" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব মোড</SelectItem>
              <SelectItem value="lead">লিড</SelectItem>
              <SelectItem value="processing">প্রসেসিং</SelectItem>
            </SelectContent>
          </Select>
          {filteredSites.length > 0 && (
            <Select value={filterWebsite} onValueChange={setFilterWebsite}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="ওয়েবসাইট" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব ওয়েবসাইট</SelectItem>
                {filteredSites.map(w => <SelectItem key={w.id} value={w.site_name}>{w.site_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {isTLOrATL && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="h-8 w-[160px] text-xs"
                placeholder="তারিখ"
              />
              {filterDate && (
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setFilterDate("")}>✕</Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TL/ATL: Transferred Spam Leads from agents */}
      {isTLOrATL && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-2.5 border-b bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">
                এজেন্টদের থেকে আসা স্প্যাম ({filteredTransferredLeads.length})
              </h3>
              <p className="text-[11px] text-muted-foreground">
                ফরওয়ার্ড করলে মূল এজেন্টের কাছে ফ্রেশ হিসেবে ফিরে যাবে
              </p>
            </div>
            {filteredTransferredLeads.length === 0 ? (
              <EmptyState icon={<ShieldBan className="h-10 w-10" />} message="ট্রান্সফারড স্প্যাম নেই" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>মূল এজেন্ট</TableHead>
                      <TableHead>নাম</TableHead>
                      <TableHead>ফোন</TableHead>
                      <TableHead>ঠিকানা</TableHead>
                      <TableHead>রেশিও</TableHead>
                      <TableHead>ওয়েবসাইট</TableHead>
                      <TableHead>মোড</TableHead>
                      <TableHead>ট্রান্সফার তারিখ</TableHead>
                      <TableHead className="text-right">অ্যাকশন</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransferredLeads.map(lead => (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <Badge variant="secondary" className="text-[11px]">
                            {lead.original_agent_name || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                        <TableCell><div className="flex items-center gap-1"><span>{lead.phone || "—"}</span>{lead.phone && <CopyButton text={lead.phone} />}</div></TableCell>
                        <TableCell className="max-w-[180px] truncate">{lead.address || "—"}</TableCell>
                        <TableCell className="min-w-[120px]"><LeadRatioBar total={lead.fraud_total} success={lead.fraud_success} cancel={lead.fraud_cancel} error={lead.fraud_check_error} checkedAt={lead.fraud_checked_at} /></TableCell>
                        <TableCell className="text-xs">{lead.source || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {getLeadMode(lead.import_source) === "processing" ? "প্রসেসিং" : "লিড"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {lead.spam_transferred_at ? new Date(lead.spam_transferred_at).toLocaleDateString("bn-BD") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleForwardToOriginalAgent(lead)}
                          >
                            <Forward className="h-3 w-3 mr-1" /> ফরওয়ার্ড
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Own Spam Leads (agent or TL/ATL's own) */}
      <Card>
        <CardContent className="p-0">
          {isTLOrATL && (
            <div className="px-4 py-2 border-b bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">আমার স্প্যাম ({filteredMyLeads.length})</h3>
            </div>
          )}
          {filteredMyLeads.length === 0 ? (
            <EmptyState icon={<ShieldBan className="h-10 w-10" />} message="স্প্যাম হিসেবে চিহ্নিত লিডগুলো এখানে দেখাবে" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>নাম</TableHead>
                    <TableHead>ফোন</TableHead>
                    <TableHead>ঠিকানা</TableHead>
                    <TableHead>রেশিও</TableHead>
                    {!isTLOrATL && <TableHead>সময় বাকি</TableHead>}
                    <TableHead className="text-right">অ্যাকশন</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMyLeads.map(lead => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                      <TableCell><div className="flex items-center gap-1"><span>{lead.phone || "—"}</span>{lead.phone && <CopyButton text={lead.phone} />}</div></TableCell>
                      <TableCell className="max-w-[200px] truncate">{lead.address || "—"}</TableCell>
                      <TableCell className="min-w-[120px]"><LeadRatioBar total={lead.fraud_total} success={lead.fraud_success} cancel={lead.fraud_cancel} error={lead.fraud_check_error} checkedAt={lead.fraud_checked_at} /></TableCell>
                      {!isTLOrATL && (
                        <TableCell>
                          <span className="text-xs text-destructive flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {getTimeRemaining(lead.updated_at)}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleRestore(lead.id)}>
                            <RotateCcw className="h-3 w-3 mr-1" /> রিস্টোর
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setDeleteId(lead.id)}>
                            <Trash2 className="h-3 w-3 mr-1" /> ডিলিট
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="লিড ডিলিট করুন"
        description="এই লিডটি চিরতরে মুছে ফেলা হবে। আপনি কি নিশ্চিত?"
        onConfirm={handleDelete}
        confirmLabel="ডিলিট"
        destructive
      />
    </div>
  );
}
