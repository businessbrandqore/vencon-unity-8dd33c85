import { useState, useEffect, useCallback } from "react";
import SalaryCard from "@/components/SalaryCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Package, Printer, Send, RefreshCw, AlertTriangle } from "lucide-react";

interface OrderRow {
  id: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  product: string | null;
  quantity: number | null;
  price: number | null;
  cso_approved_at: string | null;
  steadfast_consignment_id: string | null;
  steadfast_send_failed: boolean | null;
  status: string | null;
}

export default function WarehouseAssistantDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, customer_name, phone, address, product, quantity, price, cso_approved_at, steadfast_consignment_id, steadfast_send_failed, status")
      .in("status", ["send_today", "dispatched"])
      .order("cso_approved_at", { ascending: true });
    if (data) setOrders(data as OrderRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("warehouse-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadOrders]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const sendable = orders.filter((o) => o.status === "send_today");
    if (selected.size === sendable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sendable.map((o) => o.id)));
    }
  };

  /* ── Invoice generation (opens print-friendly page) ── */
  const generateInvoice = (orderList: OrderRow[]) => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Pop-up blocked"); return; }
    const invoiceHtml = orderList.map((o) => `
      <div style="border:1px solid #333;padding:16px;margin-bottom:8px;break-inside:avoid;">
        <h3 style="margin:0 0 8px">অর্ডার #${o.id.slice(0, 8)}</h3>
        <p><strong>গ্রাহক:</strong> ${o.customer_name || "—"}</p>
        <p><strong>ফোন:</strong> ${o.phone || "—"}</p>
        <p><strong>ঠিকানা:</strong> ${o.address || "—"}</p>
        <p><strong>পণ্য:</strong> ${o.product || "—"} × ${o.quantity || 1}</p>
        <p><strong>মূল্য:</strong> ৳${o.price || 0}</p>
      </div>
    `).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice</title>
      <style>body{font-family:sans-serif;padding:20px;color:#000}@media print{body{padding:0}}</style>
      </head><body>${invoiceHtml}<script>window.print()</script></body></html>`);
    w.document.close();
  };

  /* ── SteadFast send ── */
  const sendToSteadfast = async (order: OrderRow) => {
    if (!user) return;
    setSending((p) => new Set(p).add(order.id));
    try {
      const { data, error } = await supabase.functions.invoke("send-to-steadfast", {
        body: {
          order_id: order.id,
          recipient_name: order.customer_name,
          recipient_phone: order.phone,
          recipient_address: order.address,
          cod_amount: order.price,
          note: order.id,
          sent_by: user.id,
        },
      });

      if (error || !data?.success) {
        toast.error(`SteadFast send failed — Order #${order.id.slice(0, 8)}`);
      } else {
        toast.success(`Consignment ID: ${data.consignment_id}`);
      }
    } catch {
      toast.error("SteadFast পাঠাতে সমস্যা হয়েছে");
    }
    setSending((p) => { const n = new Set(p); n.delete(order.id); return n; });
    loadOrders();
  };

  const batchSend = async () => {
    const toSend = orders.filter((o) => selected.has(o.id) && o.status === "send_today");
    for (const o of toSend) {
      await sendToSteadfast(o);
    }
    setSelected(new Set());
  };

  const batchPrint = () => {
    const toPrint = orders.filter((o) => selected.has(o.id));
    if (toPrint.length === 0) return;
    generateInvoice(toPrint);
  };

  const sendableOrders = orders.filter((o) => o.status === "send_today");
  const dispatchedOrders = orders.filter((o) => o.status === "dispatched");

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <SalaryCard />
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Package className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
          Warehouse — Dispatch Orders
        </h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={batchPrint}>
                <Printer className="h-4 w-4 mr-1" /> Invoice Print ({selected.size})
              </Button>
              <Button size="sm" onClick={batchSend} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">
                <Send className="h-4 w-4 mr-1" /> SteadFast-এ পাঠান ({selected.size})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Pending dispatch */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading">Dispatch-এর জন্য প্রস্তুত ({sendableOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-2"><Checkbox checked={selected.size === sendableOrders.length && sendableOrders.length > 0} onCheckedChange={toggleAll} /></th>
                  <th className="py-2 px-2 text-left">Order ID</th>
                  <th className="py-2 px-2 text-left">Customer</th>
                  <th className="py-2 px-2 text-left">Address</th>
                  <th className="py-2 px-2 text-left">Product</th>
                  <th className="py-2 px-2 text-right">Qty</th>
                  <th className="py-2 px-2 text-right">Price</th>
                  <th className="py-2 px-2 text-left">CSO Time</th>
                  <th className="py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sendableOrders.map((o) => {
                  const isSending = sending.has(o.id);
                  const failed = o.steadfast_send_failed;
                  return (
                    <tr key={o.id} className={cn("border-b border-border", failed && "bg-destructive/5")}>
                      <td className="py-2 px-2"><Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleSelect(o.id)} /></td>
                      <td className="py-2 px-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                      <td className="py-2 px-2">{o.customer_name || "—"}</td>
                      <td className="py-2 px-2 max-w-[200px] truncate">{o.address || "—"}</td>
                      <td className="py-2 px-2">{o.product || "—"}</td>
                      <td className="py-2 px-2 text-right">{o.quantity || 1}</td>
                      <td className="py-2 px-2 text-right">৳{o.price || 0}</td>
                      <td className="py-2 px-2 text-xs">{o.cso_approved_at ? new Date(o.cso_approved_at).toLocaleTimeString("bn-BD") : "—"}</td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => generateInvoice([o])}>
                            <Printer className="h-3 w-3" />
                          </Button>
                          {failed ? (
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => sendToSteadfast(o)} disabled={isSending}>
                              <RefreshCw className={cn("h-3 w-3 mr-1", isSending && "animate-spin")} />Retry
                            </Button>
                          ) : (
                            <Button size="sm" className="h-7 text-xs bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white" onClick={() => sendToSteadfast(o)} disabled={isSending}>
                              {isSending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                              {isSending ? "" : "Send"}
                            </Button>
                          )}
                        </div>
                        {failed && <Badge variant="destructive" className="mt-1 text-xs">Send Failed ✗</Badge>}
                      </td>
                    </tr>
                  );
                })}
                {sendableOrders.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">কোনো pending order নেই</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Already dispatched today */}
      {dispatchedOrders.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-heading">আজ Dispatched ({dispatchedOrders.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 px-2 text-left">Order ID</th>
                    <th className="py-2 px-2 text-left">Customer</th>
                    <th className="py-2 px-2 text-left">Product</th>
                    <th className="py-2 px-2 text-left">Consignment ID</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatchedOrders.map((o) => (
                    <tr key={o.id} className="border-b border-border">
                      <td className="py-2 px-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                      <td className="py-2 px-2">{o.customer_name}</td>
                      <td className="py-2 px-2">{o.product}</td>
                      <td className="py-2 px-2"><Badge className="bg-green-600/20 text-green-400 border-green-600/30">{o.steadfast_consignment_id || "—"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
