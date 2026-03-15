import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Package, MapPin, Truck, Phone, User, Search, Filter, CheckCircle, Clock, ShieldCheck, Warehouse, CircleDot, XCircle } from "lucide-react";
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
  district: string | null;
  thana: string | null;
}

// Pipeline steps will be translated dynamically
const PIPELINE_KEYS = [
  { key: "pending_tl", labelKey: "tl_review", icon: Clock, descBn: "টিম লিডারের অনুমোদনের অপেক্ষায়", descEn: "Waiting for Team Leader approval" },
  { key: "pending_cso", labelKey: "cso_verify", icon: ShieldCheck, descBn: "CSO এর যাচাইয়ের অপেক্ষায়", descEn: "Waiting for CSO verification" },
  { key: "send_today", labelKey: "warehouse_step", icon: Warehouse, descBn: "ওয়্যারহাউস থেকে পাঠানো হবে", descEn: "Will be sent from warehouse" },
  { key: "dispatched", labelKey: "dispatch_step", icon: Truck, descBn: "কুরিয়ারে হ্যান্ডওভার হয়েছে", descEn: "Handed over to courier" },
  { key: "delivered", labelKey: "delivered_step", icon: CheckCircle, descBn: "সফলভাবে ডেলিভারি হয়েছে", descEn: "Successfully delivered" },
];

function getActiveStep(order: OrderRow): number {
  const status = order.status || "";
  const delivery = order.delivery_status || "";

  if (delivery === "delivered") return 4;
  if (delivery === "in_transit" || status === "dispatched") return 3;
  if (status === "send_today") return 2;
  if (status === "pending_cso") return 1;
  if (status === "pending_tl") return 0;
  return 0;
}

function getStatusInfo(order: OrderRow, isBn: boolean): { label: string; color: string; isFailed: boolean } {
  const status = order.status || "";
  const delivery = order.delivery_status || "";

  if (status === "rejected") return { label: isBn ? "রিজেক্ট" : "Rejected", color: "text-destructive", isFailed: true };
  if (status === "cancelled") return { label: isBn ? "বাতিল" : "Cancelled", color: "text-destructive", isFailed: true };
  if (delivery === "returned") return { label: isBn ? "রিটার্ন" : "Returned", color: "text-destructive", isFailed: true };
  if (delivery === "delivered") return { label: isBn ? "ডেলিভারড ✓" : "Delivered ✓", color: "text-emerald-600", isFailed: false };
  if (delivery === "in_transit") return { label: isBn ? "পথে আছে" : "In Transit", color: "text-blue-600", isFailed: false };
  if (delivery === "partial_delivered") return { label: isBn ? "আংশিক ডেলিভারি" : "Partial Delivery", color: "text-amber-600", isFailed: false };
  if (status === "dispatched") return { label: isBn ? "ডিসপ্যাচ হয়েছে" : "Dispatched", color: "text-purple-600", isFailed: false };
  if (status === "send_today") return { label: isBn ? "ওয়্যারহাউসে" : "At Warehouse", color: "text-blue-600", isFailed: false };
  if (status === "pending_cso") return { label: isBn ? "CSO পেন্ডিং" : "CSO Pending", color: "text-amber-600", isFailed: false };
  if (status === "pending_tl") return { label: isBn ? "TL পেন্ডিং" : "TL Pending", color: "text-amber-600", isFailed: false };
  if (status === "call_done") return { label: isBn ? "কল সম্পন্ন" : "Call Done", color: "text-cyan-600", isFailed: false };
  return { label: status || (isBn ? "পেন্ডিং" : "Pending"), color: "text-muted-foreground", isFailed: false };
}

export default function EmployeeMyOrders() {
  const { user } = useAuth();
  const { t, n, lang } = useLanguage();
  const isBn = lang === "bn";
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const selectFields = "id, customer_name, phone, address, product, quantity, price, status, delivery_status, steadfast_consignment_id, rider_name, rider_phone, created_at, district, thana";

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select(selectFields)
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false });
      setOrders((data as OrderRow[]) || []);
      setLoading(false);
    })();

    const channel = supabase
      .channel("my-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `agent_id=eq.${user.id}` }, () => {
        supabase
          .from("orders")
          .select(selectFields)
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
    if (statusFilter === "all") return matchSearch;
    if (statusFilter === "processing") return matchSearch && ["pending_tl", "pending_cso", "send_today"].includes(o.status || "");
    if (statusFilter === "in_transit") return matchSearch && (o.delivery_status === "in_transit" || o.status === "dispatched");
    if (statusFilter === "delivered") return matchSearch && o.delivery_status === "delivered";
    if (statusFilter === "returned") return matchSearch && (o.delivery_status === "returned" || o.status === "rejected" || o.status === "cancelled");
    return matchSearch;
  });

  const stats = {
    total: orders.length,
    processing: orders.filter(o => ["pending_tl", "pending_cso", "send_today"].includes(o.status || "")).length,
    delivered: orders.filter(o => o.delivery_status === "delivered").length,
    returned: orders.filter(o => o.delivery_status === "returned" || o.status === "rejected").length,
  };

  if (loading) return <div className="p-6 text-muted-foreground">{t("loading")}</div>;

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-xl flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" /> {t("my_orders")}
      </h1>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search_orders")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder={t("filter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all")} ({n(stats.total)})</SelectItem>
            <SelectItem value="processing">{t("processing")} ({n(stats.processing)})</SelectItem>
            <SelectItem value="in_transit">{t("in_transit")}</SelectItem>
            <SelectItem value="delivered">{t("delivered")} ({n(stats.delivered)})</SelectItem>
            <SelectItem value="returned">{t("returned_rejected")} ({n(stats.returned)})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: t("total"), value: stats.total, color: "" },
          { label: t("processing"), value: stats.processing, color: "text-amber-600" },
          { label: t("delivered"), value: stats.delivered, color: "text-emerald-600" },
          { label: isBn ? "রিটার্ন" : "Returned", value: stats.returned, color: "text-destructive" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn("text-2xl font-heading", s.color)}>{n(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Orders */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Package className="h-12 w-12" />} message={t("no_orders")} />
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const info = getStatusInfo(order, isBn);
            const activeStep = getActiveStep(order);
            return (
              <Card
                key={order.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => setSelected(order)}
              >
                <CardContent className="pt-4 pb-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-heading font-bold truncate">{order.customer_name || "—"}</p>
                        <Badge variant="outline" className={cn("text-xs shrink-0 font-medium", info.color, info.isFailed ? "border-destructive/40" : "border-primary/30")}>
                          {info.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{order.product || "—"} × {order.quantity || 1}</span>
                        <span className="font-medium text-foreground">৳{(order.price || 0).toLocaleString()}</span>
                        {order.steadfast_consignment_id && (
                          <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">CN: {order.steadfast_consignment_id}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString(isBn ? "bn-BD" : "en-US") : "—"}
                    </span>
                  </div>

                  {/* Mini Pipeline Tracker */}
                  {!info.isFailed && (
                    <div className="flex items-center gap-0.5">
                      {PIPELINE_KEYS.map((step, idx) => {
                        const isActive = idx <= activeStep;
                        const isCurrent = idx === activeStep;
                        return (
                          <div key={step.key} className="flex items-center flex-1">
                            <div className={cn(
                              "flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-colors shrink-0",
                              isCurrent ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
                              isActive ? "bg-primary/80 text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                              {idx + 1}
                            </div>
                            {idx < PIPELINE_KEYS.length - 1 && (
                              <div className={cn("h-0.5 flex-1 mx-0.5", isActive ? "bg-primary/60" : "bg-muted")} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Rider info */}
                  {(order.rider_name || order.rider_phone) && (
                    <div className="flex items-center gap-3 text-xs bg-blue-500/5 border border-blue-500/20 rounded-md px-3 py-2">
                      <Truck className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="text-muted-foreground">{t("rider_name")}:</span>
                      {order.rider_name && <span className="font-medium">{order.rider_name}</span>}
                      {order.rider_phone && (
                        <a href={`tel:${order.rider_phone}`} className="text-primary underline ml-auto" onClick={e => e.stopPropagation()}>
                          📞 {order.rider_phone}
                        </a>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{t("order_tracking")}</DialogTitle>
          </DialogHeader>
          {selected && (() => {
            const info = getStatusInfo(selected);
            const activeStep = getActiveStep(selected);
            return (
              <div className="space-y-5">
                {/* Customer Info */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">গ্রাহক</span>
                    <span className="font-bold">{selected.customer_name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ফোন</span>
                    <a href={`tel:${selected.phone}`} className="text-primary">{selected.phone || "—"}</a>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> ঠিকানা</span>
                    <span className="text-right max-w-[60%] text-xs">
                      {[selected.district, selected.thana, selected.address].filter(Boolean).join(", ") || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">পণ্য</span>
                    <span>{selected.product || "—"} × {selected.quantity || 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">মূল্য</span>
                    <span className="font-bold text-base">৳{(selected.price || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Vertical Pipeline Tracker */}
                {info.isFailed ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
                    <XCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
                    <p className="font-heading text-destructive">{info.label}</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    <p className="text-xs font-medium text-muted-foreground mb-3">অর্ডার ট্র্যাকিং</p>
                    {PIPELINE_STEPS.map((step, idx) => {
                      const isActive = idx <= activeStep;
                      const isCurrent = idx === activeStep;
                      const StepIcon = step.icon;
                      return (
                        <div key={step.key} className="flex gap-3">
                          {/* Line + dot */}
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
                              isCurrent ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
                              isActive ? "bg-primary/70 text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                              <StepIcon className="h-4 w-4" />
                            </div>
                            {idx < PIPELINE_STEPS.length - 1 && (
                              <div className={cn("w-0.5 h-8", isActive ? "bg-primary/50" : "bg-muted")} />
                            )}
                          </div>
                          {/* Label */}
                          <div className="pt-1">
                            <p className={cn("text-sm font-medium", isCurrent ? "text-primary" : isActive ? "text-foreground" : "text-muted-foreground")}>
                              {step.label}
                              {isCurrent && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">এখানে আছে</span>}
                            </p>
                            {(isCurrent || isActive) && (
                              <p className="text-xs text-muted-foreground">{step.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Rider Section */}
                {(selected.rider_name || selected.rider_phone) && (
                  <div className="rounded-lg border border-blue-300/50 bg-blue-50 dark:bg-blue-950/20 p-4">
                    <p className="font-heading text-sm font-bold flex items-center gap-2 mb-3">
                      <Truck className="h-4 w-4 text-blue-600" /> কুরিয়ার রাইডার তথ্য
                    </p>
                    <div className="space-y-2 text-sm">
                      {selected.rider_name && (
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{selected.rider_name}</span>
                        </div>
                      )}
                      {selected.rider_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <a href={`tel:${selected.rider_phone}`} className="text-primary underline text-base font-medium">{selected.rider_phone}</a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!selected.rider_name && !selected.rider_phone && selected.steadfast_consignment_id && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground text-center">
                    🏍️ রাইডার তথ্য এখনো পাওয়া যায়নি — স্টিডফাস্ট সিংক হলে এখানে দেখাবে
                  </div>
                )}

                {selected.steadfast_consignment_id && (
                  <div className="text-center text-xs text-muted-foreground">
                    কনসাইনমেন্ট: <span className="font-mono">{selected.steadfast_consignment_id}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
