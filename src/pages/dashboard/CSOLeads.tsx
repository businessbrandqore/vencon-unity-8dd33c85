import { useState, useEffect, useCallback } from "react";
import { Inbox, Filter } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ShieldCheck, CheckCircle, XCircle, Clock, Phone, Search,
  RefreshCw, Send, Database, MessageSquare
} from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

interface OrderRow {
  id: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  product: string | null;
  quantity: number | null;
  price: number | null;
  status: string | null;
  created_at: string | null;
  agent_id: string | null;
  tl_id: string | null;
  cso_approved_at: string | null;
  cs_note: string | null;
  lead_id: string | null;
  campaign_id?: string | null;
}

interface CampaignOption {
  id: string;
  name: string;
}

interface TLOption {
  id: string;
  name: string;
}

export default function CSOLeads() {
  const { user } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<OrderRow[]>([]);
  const [approvedOrders, setApprovedOrders] = useState<OrderRow[]>([]);
  const [rejectedOrders, setRejectedOrders] = useState<OrderRow[]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Campaign filter
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [leadCampaignMap, setLeadCampaignMap] = useState<Record<string, string>>({});

  // Data Request state
  const [showDataRequest, setShowDataRequest] = useState(false);
  const [dataRequestMsg, setDataRequestMsg] = useState("");
  const [dataRequestTlId, setDataRequestTlId] = useState("");
  const [dataRequestCampaignId, setDataRequestCampaignId] = useState("");
  const [tlOptions, setTlOptions] = useState<TLOption[]>([]);
  const [sendingRequest, setSendingRequest] = useState(false);

  // My data requests
  const [myRequests, setMyRequests] = useState<any[]>([]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const loadOrders = useCallback(async () => {
    if (!user) return;

    const selectFields = "id, customer_name, phone, address, product, quantity, price, status, created_at, agent_id, tl_id, cso_approved_at, cs_note, lead_id";

    const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
      supabase
        .from("orders")
        .select(selectFields)
        .eq("status", "pending_cso")
        .order("created_at", { ascending: true }),
      supabase
        .from("orders")
        .select(selectFields)
        .eq("status", "send_today")
        .eq("cso_id", user.id)
        .order("cso_approved_at", { ascending: false })
        .limit(50),
      supabase
        .from("orders")
        .select(selectFields)
        .eq("status", "rejected")
        .eq("cso_id", user.id)
        .order("cso_approved_at", { ascending: false })
        .limit(50),
    ]);

    const allOrders = [...(pendingRes.data || []), ...(approvedRes.data || []), ...(rejectedRes.data || [])] as OrderRow[];

    // Get lead -> campaign mapping
    const leadIds = [...new Set(allOrders.map(o => o.lead_id).filter(Boolean))] as string[];
    if (leadIds.length > 0) {
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, campaign_id")
        .in("id", leadIds);
      if (leadsData) {
        const lcMap: Record<string, string> = {};
        leadsData.forEach(l => { if (l.campaign_id) lcMap[l.id] = l.campaign_id; });
        setLeadCampaignMap(lcMap);
      }
    }

    setPendingOrders((pendingRes.data || []) as OrderRow[]);
    setApprovedOrders((approvedRes.data || []) as OrderRow[]);
    setRejectedOrders((rejectedRes.data || []) as OrderRow[]);

    // Get agent names
    const agentIds = [...new Set(allOrders.map(o => o.agent_id).filter(Boolean))] as string[];
    if (agentIds.length > 0) {
      const { data: agents } = await supabase.from("users").select("id, name").in("id", agentIds);
      if (agents) {
        const map: Record<string, string> = {};
        agents.forEach(a => { map[a.id] = a.name; });
        setAgentMap(map);
      }
    }

    setLoading(false);
  }, [user]);

  // Load campaigns
  const loadCampaigns = useCallback(async () => {
    const { data } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("status", "active")
      .order("name");
    if (data) setCampaigns(data);
  }, []);

  // Load TL options for data request
  const loadTLs = useCallback(async () => {
    const { data } = await supabase
      .from("users")
      .select("id, name")
      .eq("panel", "tl")
      .eq("is_active", true)
      .in("role", ["team_leader", "Assistant Team Leader"]);
    if (data) setTlOptions(data);
  }, []);

  // Load my data requests
  const loadMyRequests = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("data_requests")
      .select("id, message, status, created_at, responded_at, response_note, tl_id, campaign_id")
      .eq("requested_by", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setMyRequests(data);
  }, [user]);

  useEffect(() => {
    loadOrders();
    loadCampaigns();
    loadTLs();
    loadMyRequests();
  }, [loadOrders, loadCampaigns, loadTLs, loadMyRequests]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("cso-leads-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadOrders]);

  const handleApprove = async (order: OrderRow) => {
    if (!user) return;
    const { error } = await supabase.from("orders").update({
      status: "send_today",
      cso_id: user.id,
      cso_approved_at: new Date().toISOString(),
    }).eq("id", order.id);

    if (error) {
      toast.error("Approve করতে সমস্যা হয়েছে");
      return;
    }
    toast.success(`অর্ডার #${order.id.slice(0, 8)} Approved — Warehouse-এ পাঠানো হয়েছে ✓`);
    loadOrders();
  };

  const handleReject = async () => {
    if (!user || !rejectOrderId) return;
    const { error } = await supabase.from("orders").update({
      status: "rejected",
      cso_id: user.id,
      cso_approved_at: new Date().toISOString(),
      cs_note: rejectReason || "CSO rejected",
    }).eq("id", rejectOrderId);

    if (error) {
      toast.error("Reject করতে সমস্যা হয়েছে");
      return;
    }
    toast.success("অর্ডার Rejected ✗");
    setRejectOrderId(null);
    setRejectReason("");
    loadOrders();
  };

  // Send data request to TL
  const handleSendDataRequest = async () => {
    if (!user || !dataRequestTlId || !dataRequestMsg.trim()) {
      toast.error("TL এবং মেসেজ দিন");
      return;
    }
    setSendingRequest(true);
    const { error } = await supabase.from("data_requests").insert({
      requested_by: user.id,
      tl_id: dataRequestTlId,
      message: dataRequestMsg.trim(),
      status: "pending",
    });

    if (error) {
      toast.error("রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে");
      setSendingRequest(false);
      return;
    }

    // Notify TL
    await supabase.rpc("notify_user", {
      _user_id: dataRequestTlId,
      _title: "CSO ডাটা রিকোয়েস্ট",
      _message: `${user.name} আরও ডাটার জন্য রিকোয়েস্ট করেছে: ${dataRequestMsg.trim()}`,
      _type: "info",
    });

    toast.success("ডাটা রিকোয়েস্ট পাঠানো হয়েছে ✓");
    setShowDataRequest(false);
    setDataRequestMsg("");
    setDataRequestTlId("");
    setSendingRequest(false);
    loadMyRequests();
  };

  const campaignFilter = (o: OrderRow) => {
    if (selectedCampaign === "all") return true;
    const campId = o.lead_id ? leadCampaignMap[o.lead_id] : null;
    return campId === selectedCampaign;
  };

  const filteredPending = pendingOrders.filter(o =>
    campaignFilter(o) && (
      !search ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.phone?.includes(search) ||
      o.id.includes(search)
    )
  );

  const filteredApproved = approvedOrders.filter(campaignFilter);
  const filteredRejected = rejectedOrders.filter(campaignFilter);

  const statusBadge = (s: string) => {
    switch (s) {
      case "pending": return <Badge variant="outline" className="text-amber-400 border-amber-500/30">Pending</Badge>;
      case "fulfilled": return <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">Fulfilled</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          CSO — লিড ও অর্ডার যাচাই
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-[200px] h-9">
              <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="ক্যাম্পেইন ফিল্টার" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব ক্যাম্পেইন</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { setShowDataRequest(true); loadTLs(); }}>
            <Database className="h-4 w-4 mr-1" /> ডাটা রিকোয়েস্ট
          </Button>
          <Button variant="outline" size="sm" onClick={loadOrders}>
            <RefreshCw className="h-4 w-4 mr-1" /> রিফ্রেশ
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-amber-500/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Pending Review</p>
              <p className="text-2xl font-heading">{filteredPending.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">Approved</p>
              <p className="text-2xl font-heading">{filteredApproved.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Rejected</p>
              <p className="text-2xl font-heading">{filteredRejected.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="pending">
            Pending ({filteredPending.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({filteredApproved.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({filteredRejected.length})
          </TabsTrigger>
          <TabsTrigger value="requests">
            রিকোয়েস্ট ({myRequests.length})
          </TabsTrigger>
        </TabsList>

        {/* PENDING */}
        <TabsContent value="pending">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm font-heading">এজেন্ট কনফার্ম করা অর্ডার — যাচাই করুন</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="নাম, ফোন বা Order ID..."
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 px-2 text-left">Order ID</th>
                      <th className="py-2 px-2 text-left">Customer</th>
                      <th className="py-2 px-2 text-left">ফোন</th>
                      <th className="py-2 px-2 text-left">ঠিকানা</th>
                      <th className="py-2 px-2 text-left">পণ্য</th>
                      <th className="py-2 px-2 text-right">Qty</th>
                      <th className="py-2 px-2 text-right">মূল্য</th>
                      <th className="py-2 px-2 text-left">Agent</th>
                      <th className="py-2 px-2 text-left">সময়</th>
                      <th className="py-2 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPending.map((o) => (
                      <tr key={o.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                        <td className="py-2 px-2 font-medium">{o.customer_name || "—"}</td>
                        <td className="py-2 px-2">
                          <a href={`tel:${o.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                            <Phone className="h-3 w-3" /> {o.phone || "—"}
                          </a>
                        </td>
                        <td className="py-2 px-2 max-w-[180px] truncate">{o.address || "—"}</td>
                        <td className="py-2 px-2">{o.product || "—"}</td>
                        <td className="py-2 px-2 text-right">{o.quantity || 1}</td>
                        <td className="py-2 px-2 text-right font-medium">৳{o.price || 0}</td>
                        <td className="py-2 px-2 text-xs">{o.agent_id ? (agentMap[o.agent_id] || "—") : "—"}</td>
                        <td className="py-2 px-2 text-xs">{o.created_at ? new Date(o.created_at).toLocaleTimeString("bn-BD") : "—"}</td>
                        <td className="py-2 px-2">
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(o)}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setRejectOrderId(o.id)}
                              className="h-7 text-xs"
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredPending.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-muted-foreground">
                          কোনো pending অর্ডার নেই ✓
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* APPROVED */}
        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-heading">Approved অর্ডার</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 px-2 text-left">Order ID</th>
                      <th className="py-2 px-2 text-left">Customer</th>
                      <th className="py-2 px-2 text-left">ফোন</th>
                      <th className="py-2 px-2 text-left">পণ্য</th>
                      <th className="py-2 px-2 text-right">মূল্য</th>
                      <th className="py-2 px-2 text-left">Approved সময়</th>
                      <th className="py-2 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApproved.map((o) => (
                      <tr key={o.id} className="border-b border-border">
                        <td className="py-2 px-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                        <td className="py-2 px-2">{o.customer_name || "—"}</td>
                        <td className="py-2 px-2">{o.phone || "—"}</td>
                        <td className="py-2 px-2">{o.product || "—"}</td>
                        <td className="py-2 px-2 text-right">৳{o.price || 0}</td>
                        <td className="py-2 px-2 text-xs">{o.cso_approved_at ? new Date(o.cso_approved_at).toLocaleString("bn-BD") : "—"}</td>
                        <td className="py-2 px-2 text-center">
                          <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">Approved ✓</Badge>
                        </td>
                      </tr>
                    ))}
                    {filteredApproved.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">কোনো approved অর্ডার নেই</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REJECTED */}
        <TabsContent value="rejected">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-heading">Rejected অর্ডার</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 px-2 text-left">Order ID</th>
                      <th className="py-2 px-2 text-left">Customer</th>
                      <th className="py-2 px-2 text-left">পণ্য</th>
                      <th className="py-2 px-2 text-left">কারণ</th>
                      <th className="py-2 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRejected.map((o) => (
                      <tr key={o.id} className="border-b border-border">
                        <td className="py-2 px-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                        <td className="py-2 px-2">{o.customer_name || "—"}</td>
                        <td className="py-2 px-2">{o.product || "—"}</td>
                        <td className="py-2 px-2 text-xs">{o.cs_note || "—"}</td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant="destructive">Rejected ✗</Badge>
                        </td>
                      </tr>
                    ))}
                    {rejectedOrders.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">কোনো rejected অর্ডার নেই</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DATA REQUESTS */}
        <TabsContent value="requests">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-heading">আমার ডাটা রিকোয়েস্ট</CardTitle>
              <Button size="sm" onClick={() => { setShowDataRequest(true); loadTLs(); }}>
                <Send className="h-4 w-4 mr-1" /> নতুন রিকোয়েস্ট
              </Button>
            </CardHeader>
            <CardContent>
              {myRequests.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare className="h-10 w-10" />}
                  message="কোনো রিকোয়েস্ট নেই — TL এর কাছে ডাটা চাইতে নতুন রিকোয়েস্ট পাঠান"
                />
              ) : (
                <div className="space-y-3">
                  {myRequests.map((req) => (
                    <div key={req.id} className="border border-border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{req.message}</p>
                        {statusBadge(req.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {req.created_at ? new Date(req.created_at).toLocaleString("bn-BD") : ""}
                      </p>
                      {req.response_note && (
                        <p className="text-xs text-emerald-400 mt-1">
                          উত্তর: {req.response_note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={!!rejectOrderId} onOpenChange={(open) => { if (!open) { setRejectOrderId(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>অর্ডার Reject করুন</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Order #{rejectOrderId?.slice(0, 8)} reject করার কারণ লিখুন:
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reject করার কারণ..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectOrderId(null); setRejectReason(""); }}>বাতিল</Button>
            <Button variant="destructive" onClick={handleReject}>Reject করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Data Request Dialog */}
      <Dialog open={showDataRequest} onOpenChange={setShowDataRequest}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" /> TL এর কাছে ডাটা রিকোয়েস্ট
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">TL সিলেক্ট করুন</label>
              <Select value={dataRequestTlId} onValueChange={setDataRequestTlId}>
                <SelectTrigger>
                  <SelectValue placeholder="TL বাছাই করুন..." />
                </SelectTrigger>
                <SelectContent>
                  {tlOptions.map((tl) => (
                    <SelectItem key={tl.id} value={tl.id}>{tl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">মেসেজ</label>
              <Textarea
                value={dataRequestMsg}
                onChange={(e) => setDataRequestMsg(e.target.value)}
                placeholder="কী ধরনের ডাটা প্রয়োজন তা লিখুন..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDataRequest(false)}>বাতিল</Button>
            <Button onClick={handleSendDataRequest} disabled={sendingRequest}>
              <Send className="h-4 w-4 mr-1" /> রিকোয়েস্ট পাঠান
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
