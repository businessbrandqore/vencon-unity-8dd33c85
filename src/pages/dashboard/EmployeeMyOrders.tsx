import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Package, MapPin, Truck, Phone, User, Search, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

interface OrderRow {
  id: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  product: string | null;
  quantity: number | null;
  price: number | null;
  status: string | null;
  delivery_status: string | null;
  steadfast_consignment_id: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  created_at: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_cso: { label: "CSO পেন্ডিং", color: "bg-yellow-500/10 text-yellow-700 border-yellow-300" },
  send_today: { label: "আজ পাঠানো হবে", color: "bg-blue-500/10 text-blue-700 border-blue-300" },
  dispatched: { label: "ডিসপ্যাচ হয়েছে", color: "bg-purple-500/10 text-purple-700 border-purple-300" },
  call_done: { label: "কল সম্পন্ন", color: "bg-cyan-500/10 text-cyan-700 border-cyan-300" },
  cancelled: { label: "বাতিল", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

const DELIVERY_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "পেন্ডিং", color: "bg-yellow-500/10 text-yellow-700 border-yellow-300" },
  in_transit: { label: "পথে আছে", color: "bg-blue-500/10 text-blue-700 border-blue-300" },
  delivered: { label: "ডেলিভারড ✓", color: "bg-green-500/10 text-green-700 border-green-300" },
  returned: { label: "রিটার্ন", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

export default function EmployeeMyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_name, phone, address, product, quantity, price, status, delivery_status, steadfast_consignment_id, rider_name, rider_phone, created_at")
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false });
      setOrders((data as OrderRow[]) || []);
      setLoading(false);
    })();

    // Realtime
    const channel = supabase
      .channel("my-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `agent_id=eq.${user.id}` }, () => {
        supabase
          .from("orders")
          .select("id, customer_name, phone, address, product, quantity, price, status, delivery_status, steadfast_consignment_id, rider_name, rider_phone, created_at")
          .eq("agent_id", user.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => { if (data) setOrders(data as OrderRow[]); });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = orders.filter((o) => {
    const matchSearch = !searchQuery || 
      (o.customer_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.phone || "").includes(searchQuery) ||
      (o.id || "").includes(searchQuery);
    const matchStatus = statusFilter === "all" || o.delivery_status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl flex items-center gap-2">
        <Package className="h-5 w-5 text-[hsl(var(--panel-employee))]" /> আমার অর্ডার
      </h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="নাম, ফোন বা অর্ডার আইডি দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="স্ট্যাটাস" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল</SelectItem>
            <SelectItem value="pending">পেন্ডিং</SelectItem>
            <SelectItem value="in_transit">পথে আছে</SelectItem>
            <SelectItem value="delivered">ডেলিভারড</SelectItem>
            <SelectItem value="returned">রিটার্ন</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-muted-foreground">মোট</p>
            <p className="text-2xl font-heading">{orders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-muted-foreground">পথে আছে</p>
            <p className="text-2xl font-heading text-blue-600">{orders.filter(o => o.delivery_status === "in_transit").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-muted-foreground">ডেলিভারড</p>
            <p className="text-2xl font-heading text-green-600">{orders.filter(o => o.delivery_status === "delivered").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-muted-foreground">রিটার্ন</p>
            <p className="text-2xl font-heading text-destructive">{orders.filter(o => o.delivery_status === "returned").length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Package className="h-12 w-12" />} title="কোনো অর্ডার পাওয়া যায়নি" />
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const ds = DELIVERY_MAP[order.delivery_status || "pending"] || DELIVERY_MAP.pending;
            const os = STATUS_MAP[order.status || "pending_cso"] || STATUS_MAP.pending_cso;
            return (
              <Card
                key={order.id}
                className="cursor-pointer hover:border-[hsl(var(--panel-employee)/0.5)] transition-colors"
                onClick={() => setSelected(order)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-heading font-bold truncate">{order.customer_name || "—"}</p>
                        <Badge variant="outline" className={cn("text-xs shrink-0", ds.color)}>{ds.label}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{order.product || "—"} × {order.quantity || 1}</span>
                        <span>৳{(order.price || 0).toLocaleString()}</span>
                        {order.steadfast_consignment_id && (
                          <span className="font-mono">CN: {order.steadfast_consignment_id}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString("bn-BD") : "—"}
                    </div>
                  </div>

                  {/* Rider info inline if available */}
                  {(order.rider_name || order.rider_phone) && (
                    <div className="mt-2 flex items-center gap-3 text-xs bg-muted/50 rounded px-3 py-1.5">
                      <Truck className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-muted-foreground">রাইডার:</span>
                      {order.rider_name && <span className="font-medium">{order.rider_name}</span>}
                      {order.rider_phone && (
                        <a href={`tel:${order.rider_phone}`} className="text-primary underline">{order.rider_phone}</a>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Order Detail Modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">অর্ডার বিবরণ</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">অর্ডার আইডি</span>
                  <span className="font-mono text-xs">{selected.id.slice(0, 12)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">গ্রাহক</span>
                  <span className="font-medium">{selected.customer_name || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ফোন</span>
                  <a href={`tel:${selected.phone}`} className="text-primary">{selected.phone || "—"}</a>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> ঠিকানা</span>
                  <span className="text-right max-w-[60%]">{selected.address || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">পণ্য</span>
                  <span>{selected.product || "—"} × {selected.quantity || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">মূল্য</span>
                  <span className="font-bold">৳{(selected.price || 0).toLocaleString()}</span>
                </div>

                <div className="h-px bg-border my-2" />

                <div className="flex justify-between">
                  <span className="text-muted-foreground">অর্ডার স্ট্যাটাস</span>
                  <Badge variant="outline" className={cn("text-xs", (STATUS_MAP[selected.status || ""] || STATUS_MAP.pending_cso).color)}>
                    {(STATUS_MAP[selected.status || ""] || STATUS_MAP.pending_cso).label}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ডেলিভারি স্ট্যাটাস</span>
                  <Badge variant="outline" className={cn("text-xs", (DELIVERY_MAP[selected.delivery_status || ""] || DELIVERY_MAP.pending).color)}>
                    {(DELIVERY_MAP[selected.delivery_status || ""] || DELIVERY_MAP.pending).label}
                  </Badge>
                </div>

                {selected.steadfast_consignment_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">কনসাইনমেন্ট নং</span>
                    <span className="font-mono">{selected.steadfast_consignment_id}</span>
                  </div>
                )}
              </div>

              {/* Rider Section */}
              {(selected.rider_name || selected.rider_phone) && (
                <div className="rounded-md border border-blue-300/50 bg-blue-50 dark:bg-blue-950/20 p-4">
                  <p className="font-heading text-sm font-bold flex items-center gap-2 mb-2">
                    <Truck className="h-4 w-4 text-blue-600" /> কুরিয়ার রাইডার তথ্য
                  </p>
                  <div className="space-y-1.5 text-sm">
                    {selected.rider_name && (
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{selected.rider_name}</span>
                      </div>
                    )}
                    {selected.rider_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <a href={`tel:${selected.rider_phone}`} className="text-primary underline">{selected.rider_phone}</a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!selected.rider_name && !selected.rider_phone && selected.delivery_status !== "delivered" && selected.steadfast_consignment_id && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground text-center">
                  রাইডার তথ্য এখনো পাওয়া যায়নি। স্টিডফাস্ট থেকে আপডেট আসলে এখানে দেখাবে।
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
