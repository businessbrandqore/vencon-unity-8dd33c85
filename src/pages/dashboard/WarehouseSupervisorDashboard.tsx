import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Package, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface OrderRow {
  id: string;
  customer_name: string | null;
  product: string | null;
  steadfast_consignment_id: string | null;
  steadfast_send_failed: boolean | null;
  status: string | null;
  warehouse_sent_at: string | null;
  warehouse_sent_by: string | null;
}

interface InventoryEntry {
  product_name: string;
  stock_in: number | null;
  updated_at: string | null;
}

export default function WarehouseSupervisorDashboard() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  useEffect(() => {
    (async () => {
      // Orders dispatched or failed today
      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, customer_name, product, steadfast_consignment_id, steadfast_send_failed, status, warehouse_sent_at, warehouse_sent_by")
        .in("status", ["dispatched", "send_today"])
        .gte("warehouse_sent_at", todayStart.toISOString())
        .order("warehouse_sent_at", { ascending: false });

      // Also get failed ones regardless of date
      const { data: failedData } = await supabase
        .from("orders")
        .select("id, customer_name, product, steadfast_consignment_id, steadfast_send_failed, status, warehouse_sent_at, warehouse_sent_by")
        .eq("steadfast_send_failed", true)
        .eq("status", "send_today");

      const combined = [...(ordersData || []), ...(failedData || [])];
      const unique = Array.from(new Map(combined.map((o) => [o.id, o])).values()) as OrderRow[];
      setOrders(unique);

      // Get sender names
      const senderIds = [...new Set(unique.map((o) => o.warehouse_sent_by).filter(Boolean))] as string[];
      if (senderIds.length > 0) {
        const { data: users } = await supabase.from("users").select("id, name").in("id", senderIds);
        if (users) {
          const map: Record<string, string> = {};
          users.forEach((u) => { map[u.id] = u.name; });
          setSenderNames(map);
        }
      }

      // Recent inventory updates
      const { data: invData } = await supabase
        .from("inventory")
        .select("product_name, stock_in, updated_at")
        .gte("updated_at", todayStart.toISOString())
        .order("updated_at", { ascending: false });
      if (invData) setInventory(invData as InventoryEntry[]);

      setLoading(false);
    })();
  }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("supervisor-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        // Reload on changes
        window.location.reload();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const dispatched = orders.filter((o) => o.status === "dispatched");
  const failed = orders.filter((o) => o.steadfast_send_failed);
  const pending = orders.filter((o) => o.status === "send_today" && !o.steadfast_send_failed);

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl flex items-center gap-2">
        <Package className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
        Warehouse Supervisor Overview
      </h1>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div><p className="text-xs text-muted-foreground">Dispatched Today</p><p className="text-2xl font-heading">{dispatched.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-destructive" />
            <div><p className="text-xs text-muted-foreground">Failed</p><p className="text-2xl font-heading">{failed.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Package className="h-8 w-8 text-orange-400" />
            <div><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-heading">{pending.length}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Failed orders warning */}
      {failed.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-sm font-heading flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Send Failed Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="py-2 px-2 text-left">Order ID</th>
                <th className="py-2 px-2 text-left">Customer</th>
                <th className="py-2 px-2 text-left">Product</th>
              </tr></thead>
              <tbody>
                {failed.map((o) => (
                  <tr key={o.id} className="border-b border-border bg-destructive/5">
                    <td className="py-2 px-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                    <td className="py-2 px-2">{o.customer_name}</td>
                    <td className="py-2 px-2">{o.product}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* All dispatched today */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading">আজকের Dispatched Orders</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="py-2 px-2 text-left">Order ID</th>
                <th className="py-2 px-2 text-left">Customer</th>
                <th className="py-2 px-2 text-left">Sent By</th>
                <th className="py-2 px-2 text-left">Consignment ID</th>
                <th className="py-2 px-2 text-left">Status</th>
              </tr></thead>
              <tbody>
                {dispatched.map((o) => (
                  <tr key={o.id} className="border-b border-border">
                    <td className="py-2 px-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                    <td className="py-2 px-2">{o.customer_name}</td>
                    <td className="py-2 px-2">{o.warehouse_sent_by ? (senderNames[o.warehouse_sent_by] || "—") : "—"}</td>
                    <td className="py-2 px-2"><Badge className="bg-green-600/20 text-green-400 border-green-600/30">{o.steadfast_consignment_id || "—"}</Badge></td>
                    <td className="py-2 px-2"><Badge variant="outline" className="text-green-400">Dispatched</Badge></td>
                  </tr>
                ))}
                {dispatched.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">আজ কোনো dispatch হয়নি</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Inventory entries today */}
      {inventory.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-heading">আজকের Stock Entries</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="py-2 px-2 text-left">Product</th>
                <th className="py-2 px-2 text-right">Quantity Added</th>
                <th className="py-2 px-2 text-left">Time</th>
              </tr></thead>
              <tbody>
                {inventory.map((item, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="py-2 px-2">{item.product_name}</td>
                    <td className="py-2 px-2 text-right">{item.stock_in}</td>
                    <td className="py-2 px-2 text-xs">{item.updated_at ? new Date(item.updated_at).toLocaleTimeString("bn-BD") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
