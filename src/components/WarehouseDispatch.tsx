import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Package, Printer, Send, RefreshCw, AlertTriangle, Filter } from "lucide-react";

interface OrderRow {
  id: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  product: string | null;
  quantity: number | null;
  price: number | null;
  lead_id: string | null;
  cso_approved_at: string | null;
  steadfast_consignment_id: string | null;
  steadfast_send_failed: boolean | null;
  status: string | null;
  agent_id: string | null;
  cso_id: string | null;
  agent_name?: string;
  cso_name?: string;
}

interface CampaignInfo {
  id: string;
  name: string;
}

interface Props {
  showStock?: boolean;
}

export default function WarehouseDispatch({ showStock = false }: Props) {
  const { user } = useAuth();
  const { t, n, lang } = useLanguage();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Campaign filter
  const [campaigns, setCampaigns] = useState<CampaignInfo[]>([]);
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [leadCampaignMap, setLeadCampaignMap] = useState<Record<string, string>>({});

  // Invoice layout from HR settings
  const [invoicePerPage, setInvoicePerPage] = useState(4);

  // Stock data (only for inventory_manager)
  const [stockItems, setStockItems] = useState<any[]>([]);

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, customer_name, phone, address, product, quantity, price, lead_id, cso_approved_at, steadfast_consignment_id, steadfast_send_failed, status, agent_id, cso_id")
      .in("status", ["send_today", "dispatched"])
      .order("cso_approved_at", { ascending: true });

    if (data) {
      // Resolve agent & CSO names
      const userIds = [...new Set([
        ...data.map((o: any) => o.agent_id).filter(Boolean),
        ...data.map((o: any) => o.cso_id).filter(Boolean),
      ])] as string[];

      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, name")
          .in("id", userIds);
        if (users) {
          users.forEach((u: any) => { nameMap[u.id] = u.name; });
        }
      }

      const enriched = (data as OrderRow[]).map((o) => ({
        ...o,
        agent_name: o.agent_id ? nameMap[o.agent_id] || "—" : "—",
        cso_name: o.cso_id ? nameMap[o.cso_id] || "—" : "—",
      }));
      setOrders(enriched);

      // Build campaign map from lead_ids
      const leadIds = [...new Set(data.map((o: any) => o.lead_id).filter(Boolean))] as string[];
      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from("leads")
          .select("id, campaign_id")
          .in("id", leadIds);
        if (leads) {
          const map: Record<string, string> = {};
          leads.forEach((l: any) => { if (l.campaign_id) map[l.id] = l.campaign_id; });
          setLeadCampaignMap(map);
        }
      }
    }
    setLoading(false);
  }, []);

  const loadCampaigns = useCallback(async () => {
    const { data } = await supabase.from("campaigns").select("id, name").eq("status", "active");
    if (data) setCampaigns(data);
  }, []);

  const loadInvoiceSettings = useCallback(async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "invoice_config")
      .single();
    if (data?.value) {
      const layout = (data.value as any)?.invoice_layout;
      if (layout === "6_per_a4") setInvoicePerPage(6);
      else if (layout === "9_per_a4") setInvoicePerPage(9);
      else setInvoicePerPage(4);
    }
  }, []);

  const loadStock = useCallback(async () => {
    if (!showStock) return;
    const { data } = await supabase.from("inventory").select("*").order("product_name");
    if (data) setStockItems(data);
  }, [showStock]);

  useEffect(() => {
    loadOrders();
    loadCampaigns();
    loadInvoiceSettings();
    loadStock();
  }, [loadOrders, loadCampaigns, loadInvoiceSettings, loadStock]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("warehouse-dispatch-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadOrders]);

  // Filtered orders by campaign
  const filteredOrders = campaignFilter === "all"
    ? orders
    : orders.filter((o) => o.lead_id && leadCampaignMap[o.lead_id] === campaignFilter);

  const sendableOrders = filteredOrders.filter((o) => o.status === "send_today");
  const dispatchedOrders = filteredOrders.filter((o) => o.status === "dispatched");

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === sendableOrders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sendableOrders.map((o) => o.id)));
    }
  };

  /* ── Invoice generation with HR layout config ── */
  const generateInvoice = (orderList: OrderRow[]) => {
    const w = window.open("", "_blank");
    if (!w) { toast.error(t("popup_blocked")); return; }

    const perPage = invoicePerPage;
    const cols = perPage <= 4 ? 2 : 3;
    const cardWidth = perPage <= 4 ? "48%" : "31%";
    const cardPadding = perPage <= 4 ? "16px" : perPage <= 6 ? "12px" : "8px";
    const fontSize = perPage <= 4 ? "13px" : perPage <= 6 ? "11px" : "9px";

    const invoiceHtml = orderList.map((o) => `
      <div style="width:${cardWidth};border:1px solid #333;padding:${cardPadding};break-inside:avoid;box-sizing:border-box;font-size:${fontSize};">
        <h3 style="margin:0 0 6px;font-size:${perPage <= 4 ? '14px' : '11px'}">অর্ডার #${o.id.slice(0, 8)}</h3>
        <p style="margin:2px 0"><strong>গ্রাহক:</strong> ${o.customer_name || "—"}</p>
        <p style="margin:2px 0"><strong>ফোন:</strong> ${o.phone || "—"}</p>
        <p style="margin:2px 0"><strong>ঠিকানা:</strong> ${o.address || "—"}</p>
        <p style="margin:2px 0"><strong>পণ্য:</strong> ${o.product || "—"} × ${o.quantity || 1}</p>
        <p style="margin:2px 0"><strong>মূল্য:</strong> ৳${o.price || 0}</p>
      </div>
    `).join("");

    w.document.write(`<!DOCTYPE html><html><head><title>Invoice</title>
      <style>
        body{font-family:'Noto Sans Bengali',sans-serif;padding:20px;color:#000;margin:0}
        .container{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-start}
        @media print{body{padding:10px}}
        @page{size:A4;margin:10mm}
      </style>
      </head><body><div class="container">${invoiceHtml}</div><script>window.print()<\/script></body></html>`);
    w.document.close();
  };

  /* ── SteadFast send ── */
  const sendToSteadfast = async (order: OrderRow) => {
    if (!user) return;
    setSending((p) => new Set(p).add(order.id));
    try {
      const { data, error } = await supabase.functions.invoke("send-to-steadfast", {
        body: { order_id: order.id, sent_by: user.id },
      });
      if (error || !data?.success) {
        toast.error(`SteadFast send failed — Order #${order.id.slice(0, 8)}`);
      } else {
        toast.success(`Consignment ID: ${data.consignment_id}`);
      }
    } catch {
      toast.error(t("steadfast_error"));
    }
    setSending((p) => { const n = new Set(p); n.delete(order.id); return n; });
    loadOrders();
  };

  const batchSend = async () => {
    const toSend = sendableOrders.filter((o) => selected.has(o.id));
    for (const o of toSend) await sendToSteadfast(o);
    setSelected(new Set());
  };

  const batchPrint = () => {
    const toPrint = filteredOrders.filter((o) => selected.has(o.id));
    if (toPrint.length === 0) return;
    generateInvoice(toPrint);
  };

  const currentStock = (item: any) =>
    (item.stock_in || 0) - (item.dispatched || 0) + (item.returned || 0) - (item.damaged || 0);

  if (loading) return <div className="p-6 text-muted-foreground">{t("loading")}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Package className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
          {t("warehouse_dispatch_title")}
        </h1>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Campaign filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder={t("all_campaigns")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_campaigns")}</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected.size > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={batchPrint}>
                <Printer className="h-4 w-4 mr-1" /> {t("invoice")} ({n(selected.size)})
              </Button>
              <Button size="sm" onClick={batchSend} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-primary-foreground">
                <Send className="h-4 w-4 mr-1" /> SteadFast ({n(selected.size)})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Pending dispatch */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading">
            {t("ready_for_dispatch")} ({n(sendableOrders.length)})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-2">
                    <Checkbox
                      checked={selected.size === sendableOrders.length && sendableOrders.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                   <th className="py-2 px-2 text-left">{t("order_id")}</th>
                   <th className="py-2 px-2 text-left">{t("customer")}</th>
                   <th className="py-2 px-2 text-left">{t("address")}</th>
                   <th className="py-2 px-2 text-left">{t("product")}</th>
                   <th className="py-2 px-2 text-left">{t("agent")}</th>
                   <th className="py-2 px-2 text-left">{t("cso")}</th>
                   <th className="py-2 px-2 text-right">{t("quantity")}</th>
                   <th className="py-2 px-2 text-right">{t("price")}</th>
                   <th className="py-2 px-2 text-left">{t("cso_time")}</th>
                </tr>
              </thead>
              <tbody>
                {sendableOrders.map((o) => {
                  const failed = o.steadfast_send_failed;
                  return (
                    <tr key={o.id} className={cn("border-b border-border", failed && "bg-destructive/5")}>
                      <td className="py-2 px-2">
                        <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleSelect(o.id)} />
                      </td>
                      <td className="py-2 px-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                      <td className="py-2 px-2">{o.customer_name || "—"}</td>
                      <td className="py-2 px-2 max-w-[200px] truncate">{o.address || "—"}</td>
                      <td className="py-2 px-2">{o.product || "—"}</td>
                      <td className="py-2 px-2 text-xs">{o.agent_name || "—"}</td>
                      <td className="py-2 px-2 text-xs">{o.cso_name || "—"}</td>
                      <td className="py-2 px-2 text-right">{o.quantity || 1}</td>
                      <td className="py-2 px-2 text-right">৳{o.price || 0}</td>
                      <td className="py-2 px-2 text-xs">
                        {o.cso_approved_at ? new Date(o.cso_approved_at).toLocaleTimeString(lang === "bn" ? "bn-BD" : "en-US") : "—"}
                      </td>
                    </tr>
                  );
                })}
                {sendableOrders.length === 0 && (
                  <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">{t("no_pending_orders")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dispatched today */}
      {dispatchedOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading">{t("order_dispatched")} ({n(dispatchedOrders.length)})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 px-2 text-left">{t("order_id")}</th>
                    <th className="py-2 px-2 text-left">{t("customer")}</th>
                    <th className="py-2 px-2 text-left">{t("product")}</th>
                    <th className="py-2 px-2 text-left">{t("consignment_id")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatchedOrders.map((o) => (
                    <tr key={o.id} className="border-b border-border">
                      <td className="py-2 px-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                      <td className="py-2 px-2">{o.customer_name}</td>
                      <td className="py-2 px-2">{o.product}</td>
                      <td className="py-2 px-2">
                        <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
                          {o.steadfast_consignment_id || "—"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock section - only for inventory_manager */}
      {showStock && stockItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading flex items-center gap-2">
              <Package className="h-4 w-4" /> বর্তমান স্টক
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 px-2 text-left">Product</th>
                    <th className="py-2 px-2 text-right">Stock In</th>
                    <th className="py-2 px-2 text-right">Dispatched</th>
                    <th className="py-2 px-2 text-right">Returned</th>
                    <th className="py-2 px-2 text-right">Damaged</th>
                    <th className="py-2 px-2 text-right">Current Stock</th>
                    <th className="py-2 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockItems.map((item: any) => {
                    const stock = currentStock(item);
                    const low = stock <= (item.low_stock_threshold || 10);
                    return (
                      <tr key={item.id} className={cn("border-b border-border", low && "bg-orange-500/5")}>
                        <td className="py-2 px-2 font-medium">{item.product_name}</td>
                        <td className="py-2 px-2 text-right">{item.stock_in || 0}</td>
                        <td className="py-2 px-2 text-right">{item.dispatched || 0}</td>
                        <td className="py-2 px-2 text-right">{item.returned || 0}</td>
                        <td className="py-2 px-2 text-right">{item.damaged || 0}</td>
                        <td className="py-2 px-2 text-right font-heading font-bold">{stock}</td>
                        <td className="py-2 px-2 text-center">
                          {low ? (
                            <Badge variant="outline" className="text-orange-400 border-orange-500/50">
                              <AlertTriangle className="h-3 w-3 mr-1" /> Low
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-400 border-green-600/50">OK</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
