import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Truck, Package, CheckCircle, RotateCcw, XCircle, Clock, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface OrderRow {
  id: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  product: string | null;
  quantity: number | null;
  price: number | null;
  steadfast_consignment_id: string | null;
  delivery_status: string | null;
  status: string | null;
  warehouse_sent_at: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  created_at: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
}

interface Campaign {
  id: string;
  name: string;
}

const DELIVERY_STATUSES = [
  { value: "all", label: "সব স্ট্যাটাস", icon: Package },
  { value: "pending", label: "পেন্ডিং", icon: Clock },
  { value: "in_transit", label: "ইন ট্রানজিট", icon: Truck },
  { value: "delivered", label: "ডেলিভার্ড", icon: CheckCircle },
  { value: "partial_delivered", label: "আংশিক ডেলিভার্ড", icon: AlertTriangle },
  { value: "returned", label: "রিটার্নড", icon: RotateCcw },
  { value: "cancelled", label: "ক্যান্সেলড", icon: XCircle },
];

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30" },
  in_transit: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
  delivered: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" },
  partial_delivered: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
  returned: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
  cancelled: { bg: "bg-muted", text: "text-muted-foreground", border: "border-muted" },
};

const STATUS_LABEL: Record<string, string> = {
  pending: "পেন্ডিং",
  in_transit: "ইন ট্রানজিট",
  delivered: "ডেলিভার্ড",
  partial_delivered: "আংশিক ডেলিভার্ড",
  returned: "রিটার্নড",
  cancelled: "ক্যান্সেলড",
};

export default function SteadfastMonitoring() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignFilter, setCampaignFilter] = useState("all");

  // Load campaigns
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("campaigns").select("id, name").eq("status", "active");
      if (data) setCampaigns(data);
    })();
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id, customer_name, phone, address, product, quantity, price, steadfast_consignment_id, delivery_status, status, warehouse_sent_at, rider_name, rider_phone, created_at, lead_id, leads(campaign_id, campaigns(id, name))")
      .in("status", ["dispatched", "send_today"])
      .order("warehouse_sent_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (data) {
      const mapped = data.map((o: any) => ({
        ...o,
        campaign_id: o.leads?.campaign_id || null,
        campaign_name: o.leads?.campaigns?.name || null,
      })) as OrderRow[];
      setOrders(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("dc-steadfast")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } as OrderRow : o));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSyncSteadfast = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("sync-steadfast-status");
      if (error) throw error;
      toast.success("স্টিডফাস্ট স্ট্যাটাস সিংক হয়েছে");
      await loadOrders();
    } catch {
      toast.error("সিংক করতে সমস্যা হয়েছে");
    }
    setSyncing(false);
  };

  // Apply campaign filter first, then compute stats & filtered
  const campaignFiltered = useMemo(() => {
    if (campaignFilter === "all") return orders;
    return orders.filter(o => o.campaign_id === campaignFilter);
  }, [orders, campaignFilter]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, in_transit: 0, delivered: 0, partial_delivered: 0, returned: 0, cancelled: 0 };
    campaignFiltered.forEach(o => {
      const s = o.delivery_status || "pending";
      if (counts[s] !== undefined) counts[s]++;
      else counts.pending++;
    });
    return counts;
  }, [campaignFiltered]);

  const filtered = useMemo(() => {
    let result = filter === "all" ? campaignFiltered : campaignFiltered.filter(o => (o.delivery_status || "pending") === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        (o.customer_name || "").toLowerCase().includes(q) ||
        (o.phone || "").includes(q) ||
        (o.steadfast_consignment_id || "").toLowerCase().includes(q) ||
        (o.rider_name || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [campaignFiltered, filter, search]);

  const statCards = [
    { key: "pending", label: "পেন্ডিং", icon: Clock, color: "text-yellow-400" },
    { key: "in_transit", label: "ইন ট্রানজিট", icon: Truck, color: "text-blue-400" },
    { key: "delivered", label: "ডেলিভার্ড", icon: CheckCircle, color: "text-green-400" },
    { key: "returned", label: "রিটার্নড", icon: RotateCcw, color: "text-red-400" },
    { key: "partial_delivered", label: "আংশিক", icon: AlertTriangle, color: "text-orange-400" },
    { key: "cancelled", label: "ক্যান্সেলড", icon: XCircle, color: "text-muted-foreground" },
  ];

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Truck className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
          স্টিডফাস্ট মনিটরিং
        </h1>
        <div className="flex items-center gap-2">
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="ক্যাম্পেইন" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব ক্যাম্পেইন</SelectItem>
              {campaigns.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleSyncSteadfast} disabled={syncing} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            {syncing ? "সিংক হচ্ছে..." : "স্টিডফাস্ট সিংক"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(s => {
          const Icon = s.icon;
          const count = stats[s.key] || 0;
          const isActive = filter === s.key;
          return (
            <Card
              key={s.key}
              className={cn(
                "cursor-pointer transition-all hover:scale-[1.02]",
                isActive && "ring-2 ring-primary"
              )}
              onClick={() => setFilter(isActive ? "all" : s.key)}
            >
              <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
                <Icon className={cn("h-6 w-6 shrink-0", s.color)} />
                <div>
                  <p className="text-2xl font-heading leading-none">{count}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary bar */}
      <Card>
        <CardContent className="py-3 px-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">মোট অর্ডার: <strong className="text-foreground">{campaignFiltered.length}</strong></span>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>ডেলিভারি রেট: <strong className="text-green-400">{campaignFiltered.length > 0 ? ((stats.delivered / campaignFiltered.length) * 100).toFixed(1) : 0}%</strong></span>
            <span>রিটার্ন রেট: <strong className="text-red-400">{campaignFiltered.length > 0 ? ((stats.returned / campaignFiltered.length) * 100).toFixed(1) : 0}%</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Filter + Search + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-sm font-heading">
              অর্ডার তালিকা ({filtered.length})
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-[220px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="নাম, ফোন, কনসাইনমেন্ট..."
                  className="pl-8 h-8 text-xs"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DELIVERY_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="py-2 px-2 text-left">কনসাইনমেন্ট</th>
                  <th className="py-2 px-2 text-left">কাস্টমার</th>
                  <th className="py-2 px-2 text-left">ফোন</th>
                  <th className="py-2 px-2 text-left">ঠিকানা</th>
                  <th className="py-2 px-2 text-left">প্রোডাক্ট</th>
                  <th className="py-2 px-2 text-right">মূল্য</th>
                  <th className="py-2 px-2 text-left">রাইডার</th>
                  <th className="py-2 px-2 text-left">ডিসপ্যাচ</th>
                  <th className="py-2 px-2 text-center">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const ds = o.delivery_status || "pending";
                  const style = STATUS_STYLE[ds] || STATUS_STYLE.pending;
                  return (
                    <tr key={o.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-2 font-mono text-xs">{o.steadfast_consignment_id || "—"}</td>
                      <td className="py-2 px-2 whitespace-nowrap">{o.customer_name || "—"}</td>
                      <td className="py-2 px-2 font-mono text-xs">{o.phone || "—"}</td>
                      <td className="py-2 px-2 max-w-[160px] truncate text-xs">{o.address || "—"}</td>
                      <td className="py-2 px-2 text-xs">{o.product || "—"}{o.quantity && o.quantity > 1 ? ` ×${o.quantity}` : ""}</td>
                      <td className="py-2 px-2 text-right text-xs">৳{(o.price || 0).toLocaleString()}</td>
                      <td className="py-2 px-2 text-xs whitespace-nowrap">
                        {o.rider_name ? (
                          <span>{o.rider_name}{o.rider_phone ? ` (${o.rider_phone})` : ""}</span>
                        ) : "—"}
                      </td>
                      <td className="py-2 px-2 text-xs whitespace-nowrap">
                        {o.warehouse_sent_at ? new Date(o.warehouse_sent_at).toLocaleDateString("bn-BD") : "—"}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant="outline" className={cn("text-[10px]", style.text, style.border, style.bg)}>
                          {STATUS_LABEL[ds] || ds}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">কোনো অর্ডার পাওয়া যায়নি</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
