import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldBan, RotateCcw, Trash2, Forward, Clock, Filter } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";

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
}

export default function SpamLeads() {
  const { user } = useAuth();
  const [myLeads, setMyLeads] = useState<SpamLead[]>([]);
  const [teamLeads, setTeamLeads] = useState<SpamLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Campaign / website filter states
  const [filterCampaignId, setFilterCampaignId] = useState<string>("all");
  const [filterDataMode, setFilterDataMode] = useState<string>("all");
  const [filterWebsite, setFilterWebsite] = useState<string>("all");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; data_mode: string }[]>([]);
  const [websites, setWebsites] = useState<{ id: string; site_name: string; campaign_id: string }[]>([]);

  const isTLOrATL = user?.role === "team_leader" || user?.role === "Team Leader" ||
    user?.role === "Assistant Team Leader" || user?.panel === "tl";

  const loadSpamLeads = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Load own spam leads
    const { data: ownData, error: ownErr } = await supabase
      .from("leads")
      .select("id, name, phone, address, status, agent_type, updated_at, assigned_to, campaign_id, import_source")
      .eq("assigned_to", user.id)
      .eq("is_spam", true)
      .order("updated_at", { ascending: false });

    if (ownErr) console.error(ownErr);
    setMyLeads((ownData as SpamLead[]) || []);

    // For TL/ATL: load team agent spam leads
    if (isTLOrATL) {
      // Get agents under this TL
      const { data: agentRoles } = await supabase
        .from("campaign_agent_roles")
        .select("agent_id")
        .eq("tl_id", user.id);

      const agentIds = [...new Set((agentRoles || []).map(a => a.agent_id))];
      // Exclude self
      const teamAgentIds = agentIds.filter(id => id !== user.id);

      if (teamAgentIds.length > 0) {
        const { data: teamData } = await supabase
          .from("leads")
          .select("id, name, phone, address, status, agent_type, updated_at, assigned_to, campaign_id, import_source")
          .in("assigned_to", teamAgentIds)
          .eq("is_spam", true)
          .order("updated_at", { ascending: false });

        // Get agent names
        if (teamData && teamData.length > 0) {
          const uniqueAgentIds = [...new Set(teamData.map(l => l.assigned_to).filter(Boolean))];
          const { data: agents } = await supabase
            .from("users")
            .select("id, name")
            .in("id", uniqueAgentIds as string[]);

          const nameMap: Record<string, string> = {};
          (agents || []).forEach(a => { nameMap[a.id] = a.name; });

          setTeamLeads(teamData.map(l => ({
            ...l,
            assigned_agent_name: l.assigned_to ? nameMap[l.assigned_to] || "—" : "—",
          })) as SpamLead[]);
        } else {
          setTeamLeads([]);
        }
      }
    }

    setLoading(false);
  }, [user, isTLOrATL]);

  useEffect(() => { loadSpamLeads(); }, [loadSpamLeads]);

  // Load campaigns & websites for filters
  useEffect(() => {
    const allLeads = [...myLeads, ...teamLeads];
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
  }, [myLeads, teamLeads]);

  // Apply campaign filters
  const filteredMyLeads = useMemo(() => {
    let result = myLeads;
    if (filterCampaignId !== "all") result = result.filter(l => l.campaign_id === filterCampaignId);
    if (filterDataMode !== "all") {
      const ids = campaigns.filter(c => c.data_mode === filterDataMode).map(c => c.id);
      result = result.filter(l => l.campaign_id && ids.includes(l.campaign_id));
    }
    if (filterWebsite !== "all") result = result.filter(l => l.import_source === filterWebsite);
    return result;
  }, [myLeads, filterCampaignId, filterDataMode, filterWebsite, campaigns]);

  const filteredTeamLeads = useMemo(() => {
    let result = teamLeads;
    if (filterCampaignId !== "all") result = result.filter(l => l.campaign_id === filterCampaignId);
    if (filterDataMode !== "all") {
      const ids = campaigns.filter(c => c.data_mode === filterDataMode).map(c => c.id);
      result = result.filter(l => l.campaign_id && ids.includes(l.campaign_id));
    }
    if (filterWebsite !== "all") result = result.filter(l => l.import_source === filterWebsite);
    return result;
  }, [teamLeads, filterCampaignId, filterDataMode, filterWebsite, campaigns]);

  const handleRestore = async (leadId: string) => {
    const { error } = await supabase
      .from("leads")
      .update({ is_spam: false, status: "fresh" } as any)
      .eq("id", leadId);
    if (error) {
      toast.error("রিস্টোর করা যায়নি");
      return;
    }
    toast.success("লিড রিস্টোর হয়েছে ✓");
    setMyLeads(prev => prev.filter(l => l.id !== leadId));
    setTeamLeads(prev => prev.filter(l => l.id !== leadId));
  };

  const handleForward = async (lead: SpamLead) => {
    // Un-spam and send back to the assigned agent as fresh
    const { error } = await supabase
      .from("leads")
      .update({ is_spam: false, status: "fresh" } as any)
      .eq("id", lead.id);
    if (error) {
      toast.error("ফরওয়ার্ড করা যায়নি");
      return;
    }
    toast.success(`${lead.assigned_agent_name || "এজেন্ট"}-এর কাছে ফেরত পাঠানো হয়েছে ✓`);
    setTeamLeads(prev => prev.filter(l => l.id !== lead.id));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("leads").delete().eq("id", deleteId);
    if (error) {
      toast.error("ডিলিট করা যায়নি");
    } else {
      toast.success("লিড ডিলিট হয়েছে");
      setMyLeads(prev => prev.filter(l => l.id !== deleteId));
      setTeamLeads(prev => prev.filter(l => l.id !== deleteId));
    }
    setDeleteId(null);
  };

  const getTimeRemaining = (updatedAt: string | null) => {
    if (!updatedAt) return null;
    const spamTime = new Date(updatedAt).getTime();
    const deleteTime = spamTime + 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (now >= deleteTime) return "শীঘ্রই মুছে যাবে";
    const hoursLeft = Math.ceil((deleteTime - now) / (60 * 60 * 1000));
    return `${hoursLeft} ঘণ্টা বাকি`;
  };

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldBan className="h-5 w-5 text-destructive" />
        <h2 className="font-heading text-xl font-bold text-foreground">স্প্যাম</h2>
        <span className="text-sm text-muted-foreground">
          ({filteredMyLeads.length + filteredTeamLeads.length})
        </span>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        স্প্যাম ডাটা ২৪ ঘণ্টা পর অটোমেটিক মুছে যায়
      </p>

      {/* Campaign / Website Filters */}
      {campaigns.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterCampaignId} onValueChange={v => { setFilterCampaignId(v); setFilterWebsite("all"); }}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="ক্যাম্পেইন" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব ক্যাম্পেইন</SelectItem>
              {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterDataMode} onValueChange={setFilterDataMode}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="ডাটা মোড" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব মোড</SelectItem>
              <SelectItem value="lead">লিড</SelectItem>
              <SelectItem value="processing">প্রসেসিং</SelectItem>
            </SelectContent>
          </Select>
          {(() => {
            const filteredSites = filterCampaignId !== "all"
              ? websites.filter(w => w.campaign_id === filterCampaignId)
              : websites;
            return filteredSites.length > 0 ? (
              <Select value={filterWebsite} onValueChange={setFilterWebsite}>
                <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="ওয়েবসাইট" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব ওয়েবসাইট</SelectItem>
                  {filteredSites.map(w => <SelectItem key={w.id} value={w.site_name}>{w.site_name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : null;
          })()}
        </div>
      )}

      {/* TL/ATL: Team Agent Spam Leads */}
      {isTLOrATL && filteredTeamLeads.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-2.5 border-b bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">
                টিম এজেন্টদের স্প্যাম ({filteredTeamLeads.length})
              </h3>
              <p className="text-[11px] text-muted-foreground">
                ফরওয়ার্ড করলে এজেন্টের লিডে ফ্রেশ হিসেবে ফিরে যাবে
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>এজেন্ট</TableHead>
                    <TableHead>নাম</TableHead>
                    <TableHead>ফোন</TableHead>
                    <TableHead>ঠিকানা</TableHead>
                    <TableHead>সময় বাকি</TableHead>
                    <TableHead className="text-right">অ্যাকশন</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeamLeads.map(lead => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Badge variant="secondary" className="text-[11px]">
                          {lead.assigned_agent_name || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                      <TableCell>{lead.phone || "—"}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{lead.address || "—"}</TableCell>
                      <TableCell>
                        <span className="text-xs text-destructive flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getTimeRemaining(lead.updated_at)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleForward(lead)}
                        >
                          <Forward className="h-3 w-3 mr-1" /> ফরওয়ার্ড
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Own Spam Leads */}
      <Card>
        <CardContent className="p-0">
          {isTLOrATL && (
            <div className="px-4 py-2 border-b bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground">আমার স্প্যাম ({myLeads.length})</h3>
            </div>
          )}
          {myLeads.length === 0 ? (
            <EmptyState icon={<ShieldBan className="h-10 w-10" />} message="স্প্যাম হিসেবে চিহ্নিত লিডগুলো এখানে দেখাবে" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>নাম</TableHead>
                    <TableHead>ফোন</TableHead>
                    <TableHead>ঠিকানা</TableHead>
                    <TableHead>সময় বাকি</TableHead>
                    <TableHead className="text-right">অ্যাকশন</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myLeads.map(lead => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                      <TableCell>{lead.phone || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{lead.address || "—"}</TableCell>
                      <TableCell>
                        <span className="text-xs text-destructive flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getTimeRemaining(lead.updated_at)}
                        </span>
                      </TableCell>
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
