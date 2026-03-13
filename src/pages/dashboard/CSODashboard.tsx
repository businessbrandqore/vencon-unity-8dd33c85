import { useState, useEffect, useCallback } from "react";
import SalaryCard from "@/components/SalaryCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ShieldCheck, CheckCircle, XCircle, Clock, Phone, Search, RefreshCw } from "lucide-react";

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
}

interface AgentInfo {
  id: string;
  name: string;
}

export default function CSODashboard() {
  const { user } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<OrderRow[]>([]);
  const [approvedOrders, setApprovedOrders] = useState<OrderRow[]>([]);
  const [rejectedOrders, setRejectedOrders] = useState<OrderRow[]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [todayApproved, setTodayApproved] = useState(0);
  const [todayRejected, setTodayRejected] = useState(0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const loadOrders = useCallback(async () => {
    if (!user) return;

    const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, customer_name, phone, address, product, quantity, price, status, created_at, agent_id, tl_id, cso_approved_at, cs_note")
        .eq("status", "pending_cso")
        .order("created_at", { ascending: true }),
      supabase
        .from("orders")
        .select("id, customer_name, phone, address, product, quantity, price, status, created_at, agent_id, tl_id, cso_approved_at, cs_note")
        .eq("status", "send_today")
        .eq("cso_id", user.id)
        .gte("cso_approved_at", todayStart.toISOString())
        .order("cso_approved_at", { ascending: false }),
      supabase
        .from("orders")
        .select("id, customer_name, phone, address, product, quantity, price, status, created_at, agent_id, tl_id, cso_approved_at, cs_note")
        .eq("status", "rejected")
        .eq("cso_id", user.id)
        .gte("cso_approved_at", todayStart.toISOString())
        .order("cso_approved_at", { ascending: false }),
    ]);

    const pending = (pendingRes.data || []) as OrderRow[];
    const approved = (approvedRes.data || []) as OrderRow[];
    const rejected = (rejectedRes.data || []) as OrderRow[];

    setPendingOrders(pending);
    setApprovedOrders(approved);
    setRejectedOrders(rejected);
    setTodayApproved(approved.length);
    setTodayRejected(rejected.length);

    // Get agent names
    const agentIds = [...new Set([...pending, ...approved, ...rejected].map(o => o.agent_id).filter(Boolean))] as string[];
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

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("cso-orders-rt")
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

  const filteredPending = pendingOrders.filter(o =>
    !search ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.phone?.includes(search) ||
    o.id.includes(search)
  );

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <SalaryCard />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
          Customer Security Officer — অর্ডার যাচাই
        </h1>
        <Button variant="outline" size="sm" onClick={loadOrders}>
          <RefreshCw className="h-4 w-4 mr-1" /> রিফ্রেশ
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-amber-500/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Pending Review</p>
              <p className="text-2xl font-heading">{pendingOrders.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">আজ Approved</p>
              <p className="text-2xl font-heading">{todayApproved}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">আজ Rejected</p>
              <p className="text-2xl font-heading">{todayRejected}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="pending">
            Pending ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({approvedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({rejectedOrders.length})
          </TabsTrigger>
        </TabsList>

        {/* PENDING */}
        <TabsContent value="pending">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm font-heading">অর্ডার যাচাই করুন</CardTitle>
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
              <CardTitle className="text-sm font-heading">আজ Approved অর্ডার</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 px-2 text-left">Order ID</th>
                      <th className="py-2 px-2 text-left">Customer</th>
                      <th className="py-2 px-2 text-left">পণ্য</th>
                      <th className="py-2 px-2 text-right">মূল্য</th>
                      <th className="py-2 px-2 text-left">Approved সময়</th>
                      <th className="py-2 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedOrders.map((o) => (
                      <tr key={o.id} className="border-b border-border">
                        <td className="py-2 px-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                        <td className="py-2 px-2">{o.customer_name || "—"}</td>
                        <td className="py-2 px-2">{o.product || "—"}</td>
                        <td className="py-2 px-2 text-right">৳{o.price || 0}</td>
                        <td className="py-2 px-2 text-xs">{o.cso_approved_at ? new Date(o.cso_approved_at).toLocaleTimeString("bn-BD") : "—"}</td>
                        <td className="py-2 px-2 text-center">
                          <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">Approved ✓</Badge>
                        </td>
                      </tr>
                    ))}
                    {approvedOrders.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">আজ কোনো approve হয়নি</td></tr>
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
              <CardTitle className="text-sm font-heading">আজ Rejected অর্ডার</CardTitle>
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
                    {rejectedOrders.map((o) => (
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
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">আজ কোনো reject হয়নি</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
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
    </div>
  );
}
