import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Database, CheckCircle, XCircle, RefreshCw, Inbox, Clock, Send, Users } from "lucide-react";

interface DataRequest {
  id: string;
  requested_by: string;
  tl_id: string;
  campaign_id: string | null;
  status: string;
  message: string | null;
  response_note: string | null;
  created_at: string;
  responded_at: string | null;
  requester_name?: string;
  requester_role?: string;
}

export default function TLDataRequests() {
  const { user } = useAuth();
  const { roleName } = useLanguage();
  const isBn = true;

  const [dataRequests, setDataRequests] = useState<DataRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  // Data send state
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; data_mode: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [distDataMode, setDistDataMode] = useState<"lead" | "processing">("lead");
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [sendCount, setSendCount] = useState("");
  const [availableCount, setAvailableCount] = useState(0);
  const [sending, setSending] = useState(false);

  const isBDO = user?.role === "bdo" || user?.role === "business_development_officer" || user?.role === "Business Development And Marketing Manager";
  const isATL = user?.role === "Assistant Team Leader";
  const [atlTlMap, setAtlTlMap] = useState<Record<string, string>>({});

  const getEffectiveTlId = useCallback(() => {
    if (!isATL || !user) return user?.id || "";
    if (selectedCampaign && atlTlMap[selectedCampaign]) return atlTlMap[selectedCampaign];
    const vals = Object.values(atlTlMap);
    return vals.length > 0 ? vals[0] : user?.id || "";
  }, [isATL, user, selectedCampaign, atlTlMap]);

  // Load campaigns
  const loadCampaigns = useCallback(async () => {
    if (!user) return;
    if (isBDO) {
      const { data } = await supabase.from("campaigns").select("id, name, data_mode").eq("status", "active");
      setCampaigns(data || []);
    } else if (isATL) {
      const { data } = await supabase
        .from("campaign_agent_roles")
        .select("campaign_id, tl_id, campaigns(id, name, data_mode)")
        .eq("agent_id", user.id);
      if (data) {
        const tlMap: Record<string, string> = {};
        const seen = new Set<string>();
        const list = data
          .filter((d: any) => d.campaigns)
          .filter((d: any) => { if (seen.has(d.campaigns.id)) return false; seen.add(d.campaigns.id); return true; })
          .map((d: any) => { tlMap[d.campaigns.id] = d.tl_id; return d.campaigns; });
        setAtlTlMap(tlMap);
        setCampaigns(list);
      }
    } else {
      const { data } = await supabase
        .from("campaign_tls")
        .select("campaign_id, campaigns(id, name, data_mode)")
        .eq("tl_id", user.id);
      setCampaigns((data || []).map((d: any) => d.campaigns).filter(Boolean));
    }
  }, [user, isBDO, isATL]);

  // Load agents for selected campaign + mode
  const loadAgents = useCallback(async () => {
    if (!user || !selectedCampaign) { setAgents([]); return; }
    const q = supabase
      .from("campaign_agent_roles")
      .select("agent_id, is_bronze, is_silver, users!campaign_agent_roles_agent_id_fkey(id, name)")
      .eq("campaign_id", selectedCampaign)
      .eq("tl_id", getEffectiveTlId());

    const { data } = await q;
    if (!data) { setAgents([]); return; }

    const filtered = data.filter((r: any) => distDataMode === "lead" ? r.is_bronze : r.is_silver);
    const unique = new Map<string, string>();
    filtered.forEach((r: any) => { if (r.users) unique.set(r.users.id, r.users.name); });
    setAgents(Array.from(unique, ([id, name]) => ({ id, name })));
    setSelectedAgent("");
  }, [user, selectedCampaign, distDataMode, getEffectiveTlId]);

  // Count available raw leads
  const loadAvailableCount = useCallback(async () => {
    if (!user || !selectedCampaign) { setAvailableCount(0); return; }
    let q = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", selectedCampaign)
      .eq("status", "fresh")
      .is("assigned_to", null);

    if (!isBDO) q = q.eq("tl_id", getEffectiveTlId());

    if (distDataMode === "lead") {
      q = q.or("source.is.null,source.neq.processing").or("import_source.is.null,import_source.neq.processing");
    } else {
      q = q.or("source.eq.processing,import_source.eq.processing");
    }

    const { count } = await q;
    setAvailableCount(count || 0);
  }, [user, selectedCampaign, distDataMode, isBDO]);

  // Send data to agent
  const handleSendData = async () => {
    if (!user || !selectedCampaign || !selectedAgent || !sendCount) return;
    const count = parseInt(sendCount);
    if (isNaN(count) || count <= 0) { toast.error(isBn ? "সঠিক সংখ্যা দিন" : "Enter valid count"); return; }
    if (count > availableCount) { toast.error(isBn ? `মাত্র ${availableCount} টি ডাটা পাওয়া যাচ্ছে` : `Only ${availableCount} available`); return; }

    setSending(true);
    try {
      // Fetch raw leads
      let q = supabase
        .from("leads")
        .select("id")
        .eq("campaign_id", selectedCampaign)
        .eq("status", "fresh")
        .is("assigned_to", null)
        .order("created_at", { ascending: true })
        .limit(count);

      if (!isBDO) q = q.eq("tl_id", user.id);

      if (distDataMode === "lead") {
        q = q.or("source.is.null,source.neq.processing").or("import_source.is.null,import_source.neq.processing");
      } else {
        q = q.or("source.eq.processing,import_source.eq.processing");
      }

      const { data: leadsToAssign, error } = await q;
      if (error) throw error;
      if (!leadsToAssign || leadsToAssign.length === 0) { toast.error(isBn ? "কোনো ডাটা পাওয়া যায়নি" : "No data found"); setSending(false); return; }

      const ids = leadsToAssign.map(l => l.id);
      const agentType = distDataMode === "processing" ? "silver" : "bronze";

      const { error: updateError } = await supabase
        .from("leads")
        .update({
          assigned_to: selectedAgent,
          tl_id: user.id,
          agent_type: agentType,
          status: distDataMode === "processing" ? "processing_assigned" : "assigned",
        })
        .in("id", ids);

      if (updateError) throw updateError;

      const agentName = agents.find(a => a.id === selectedAgent)?.name || "";
      toast.success(isBn
        ? `${ids.length} টি ${distDataMode === "lead" ? "লিড" : "প্রসেসিং"} ডাটা ${agentName}-কে পাঠানো হয়েছে ✅`
        : `${ids.length} ${distDataMode} data sent to ${agentName} ✅`
      );
      setSendCount("");
      loadAvailableCount();
    } catch (err: any) {
      toast.error(err.message || "Failed to send data");
    }
    setSending(false);
  };

  const loadDataRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("data_requests")
      .select("*")
      .eq("tl_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      const requesterIds = [...new Set(data.map((r: any) => r.requested_by))];
      const { data: users } = requesterIds.length > 0
        ? await supabase.from("users").select("id, name, role").in("id", requesterIds)
        : { data: [] };
      const userMap = new Map((users || []).map((u: any) => [u.id, u]));

      const enriched: DataRequest[] = data.map((r: any) => ({
        ...r,
        requester_name: userMap.get(r.requested_by)?.name || "Unknown",
        requester_role: userMap.get(r.requested_by)?.role || "",
      }));
      setDataRequests(enriched);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadDataRequests();
    loadCampaigns();

    const channel = supabase
      .channel('data-requests-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'data_requests' }, () => {
        loadDataRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadDataRequests, loadCampaigns]);

  useEffect(() => { loadAgents(); }, [loadAgents]);
  useEffect(() => { loadAvailableCount(); }, [loadAvailableCount]);

  const handleFulfillRequest = async (requestId: string) => {
    await supabase.from("data_requests").update({ status: "fulfilled", responded_at: new Date().toISOString() }).eq("id", requestId);
    toast.success(isBn ? "রিকোয়েস্ট পূরণ হিসেবে মার্ক করা হয়েছে" : "Request marked as fulfilled");
    loadDataRequests();
  };

  const handleRejectRequest = async (requestId: string) => {
    await supabase.from("data_requests").update({ status: "rejected", responded_at: new Date().toISOString() }).eq("id", requestId);
    toast.success(isBn ? "রিকোয়েস্ট প্রত্যাখ্যান করা হয়েছে" : "Request rejected");
    loadDataRequests();
  };

  const filtered = statusFilter === "all" ? dataRequests : dataRequests.filter(r => r.status === statusFilter);
  const pendingCount = dataRequests.filter(r => r.status === "pending").length;
  const fulfilledCount = dataRequests.filter(r => r.status === "fulfilled").length;
  const rejectedCount = dataRequests.filter(r => r.status === "rejected").length;

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">
            {isBn ? "ডাটা রিকোয়েস্ট ও পাঠানো" : "Data Requests & Send"}
          </h2>
          <p className="text-sm text-muted-foreground">{isBn ? "এজেন্টদের ডাটা পাঠান এবং রিকোয়েস্ট পরিচালনা করুন" : "Send data to agents and manage requests"}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => { loadDataRequests(); loadAvailableCount(); }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* ====== DATA SEND SECTION ====== */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            {isBn ? "ডাটা পাঠান" : "Send Data"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            {/* Campaign */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{isBn ? "ক্যাম্পেইন" : "Campaign"}</label>
              <Select value={selectedCampaign} onValueChange={(v) => { setSelectedCampaign(v); setSelectedAgent(""); setSendCount(""); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={isBn ? "ক্যাম্পেইন নির্বাচন" : "Select Campaign"} />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{isBn ? "ডাটা মোড" : "Data Mode"}</label>
              <Select value={distDataMode} onValueChange={(v) => { setDistDataMode(v as "lead" | "processing"); setSelectedAgent(""); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">🎯 {isBn ? "লিড" : "Lead"}</SelectItem>
                  <SelectItem value="processing">⚙️ {isBn ? "প্রসেসিং" : "Processing"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Agent */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{isBn ? "এজেন্ট" : "Agent"}</label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent} disabled={!selectedCampaign}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={isBn ? "এজেন্ট নির্বাচন" : "Select Agent"} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Count */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {isBn ? "সংখ্যা" : "Count"}
                {selectedCampaign && (
                  <span className="ml-1 text-primary">({isBn ? `${availableCount} টি পাওয়া যাচ্ছে` : `${availableCount} available`})</span>
                )}
              </label>
              <Input
                type="number"
                min={1}
                max={availableCount}
                value={sendCount}
                onChange={(e) => setSendCount(e.target.value)}
                placeholder={isBn ? "কয়টি পাঠাবেন" : "How many"}
                className="h-9 text-sm"
                disabled={!selectedAgent}
              />
            </div>

            {/* Send Button */}
            <Button
              onClick={handleSendData}
              disabled={!selectedCampaign || !selectedAgent || !sendCount || sending}
              className="h-9 gap-2"
            >
              {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isBn ? "পাঠান" : "Send"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">{isBn ? "পেন্ডিং" : "Pending"}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{fulfilledCount}</p>
            <p className="text-xs text-muted-foreground">{isBn ? "পূরণ হয়েছে" : "Fulfilled"}</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-4 text-center">
            <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{rejectedCount}</p>
            <p className="text-xs text-muted-foreground">{isBn ? "প্রত্যাখ্যাত" : "Rejected"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">{isBn ? "সব" : "All"} ({dataRequests.length})</TabsTrigger>
          <TabsTrigger value="pending">{isBn ? "পেন্ডিং" : "Pending"} ({pendingCount})</TabsTrigger>
          <TabsTrigger value="fulfilled">{isBn ? "পূরণ" : "Fulfilled"} ({fulfilledCount})</TabsTrigger>
          <TabsTrigger value="rejected">{isBn ? "বাতিল" : "Rejected"} ({rejectedCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Request list */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">{isBn ? "কোনো রিকোয়েস্ট নেই" : "No requests"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(req => (
                <div
                  key={req.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    req.status === 'pending'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : req.status === 'fulfilled'
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-destructive/30 bg-destructive/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">{req.requester_name}</span>
                        <Badge variant="secondary" className="text-[10px]">{roleName(req.requester_role || "")}</Badge>
                        <Badge
                          variant={req.status === 'pending' ? 'outline' : req.status === 'fulfilled' ? 'default' : 'destructive'}
                          className="text-[10px]"
                        >
                          {req.status === 'pending' ? (isBn ? 'পেন্ডিং' : 'Pending') :
                           req.status === 'fulfilled' ? (isBn ? 'পূরণ হয়েছে' : 'Fulfilled') :
                           (isBn ? 'প্রত্যাখ্যান' : 'Rejected')}
                        </Badge>
                      </div>
                      {req.message && <p className="text-sm text-muted-foreground">{req.message}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(req.created_at).toLocaleString("bn-BD")}
                        {req.responded_at && (
                          <span className="ml-2">• {isBn ? "উত্তর:" : "Response:"} {new Date(req.responded_at).toLocaleString("bn-BD")}</span>
                        )}
                      </p>
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => handleFulfillRequest(req.id)} className="gap-1 text-emerald-600 border-emerald-500/50 hover:bg-emerald-500/10">
                          <CheckCircle className="h-3.5 w-3.5" /> {isBn ? "পূরণ" : "Fulfill"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleRejectRequest(req.id)} className="gap-1 text-destructive border-destructive/50 hover:bg-destructive/10">
                          <XCircle className="h-3.5 w-3.5" /> {isBn ? "বাতিল" : "Reject"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
