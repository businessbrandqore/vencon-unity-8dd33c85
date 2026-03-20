import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Activity, Target, ShoppingCart, Search, Phone, User, MapPin,
  Megaphone, TrendingUp, Package, Truck,
} from "lucide-react";
import { format } from "date-fns";

const statusColorMap: Record<string, string> = {
  fresh: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  called: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  interested: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  not_interested: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  callback: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  ordered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300",
};

const orderStatusColorMap: Record<string, string> = {
  pending_cso: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  send_today: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  dispatched: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  returned: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  call_done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const HRDataMonitor = () => {
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [selectedWebsite, setSelectedWebsite] = useState<string>("all");
  const [dataMode, setDataMode] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("leads");
  const [search, setSearch] = useState("");

  // Fetch campaigns
  const { data: campaigns } = useQuery({
    queryKey: ["monitor-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, status, data_mode")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch websites for the selected campaign, filtered by data mode
  const { data: websites } = useQuery({
    queryKey: ["monitor-websites", selectedCampaign, dataMode],
    queryFn: async () => {
      let q = supabase
        .from("campaign_websites")
        .select("id, site_name, campaign_id, data_mode")
        .eq("is_active", true);
      if (selectedCampaign !== "all") q = q.eq("campaign_id", selectedCampaign);
      if (dataMode !== "all") q = q.eq("data_mode", dataMode);
      const { data, error } = await q.order("site_name");
      if (error) throw error;
      return data;
    },
  });

  // Reset website filter when campaign changes
  const handleCampaignChange = (val: string) => {
    setSelectedCampaign(val);
    setSelectedWebsite("all");
  };

  // Fetch leads
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["monitor-leads", selectedCampaign, dataMode, selectedWebsite],
    queryFn: async () => {
      let q = supabase
        .from("leads")
        .select("id, name, phone, address, status, agent_type, source, import_source, campaign_id, created_at, assigned_to, tl_id, special_note")
        .order("created_at", { ascending: false })
        .limit(500);
      if (selectedCampaign !== "all") q = q.eq("campaign_id", selectedCampaign);
      if (selectedWebsite !== "all") {
        const site = websites?.find(w => w.id === selectedWebsite);
        if (site) q = q.eq("source", site.site_name);
      }
      const { data, error } = await q;
      if (error) throw error;
      let result = data || [];
      if (dataMode === "lead") result = result.filter(l => l.import_source !== "processing");
      if (dataMode === "processing") result = result.filter(l => l.import_source === "processing");
      return result;
    },
  });

  // Fetch orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["monitor-orders", selectedCampaign],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, customer_name, phone, address, product, price, quantity, status, delivery_status, steadfast_consignment_id, created_at, agent_id, tl_id, lead_id")
        .order("created_at", { ascending: false })
        .limit(500);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Stats
  const allLeads = leads || [];
  const freshLeads = allLeads.filter((l) => l.status === "fresh");
  const bronzeLeads = allLeads.filter((l) => l.agent_type === "bronze" || (!l.agent_type && l.assigned_to));
  const silverLeads = allLeads.filter((l) => l.agent_type === "silver");

  const allOrders = orders || [];
  const pendingOrders = allOrders.filter((o) => o.status === "pending_cso");
  const dispatchedOrders = allOrders.filter((o) => o.status === "dispatched");
  const deliveredOrders = allOrders.filter((o) => o.delivery_status === "delivered");
  const returnedOrders = allOrders.filter((o) => o.delivery_status === "returned");

  const filterBySearch = <T extends { name?: string | null; customer_name?: string | null; phone?: string | null }>(items: T[]) => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) =>
      (item.name || item.customer_name || "").toLowerCase().includes(q) ||
      (item.phone || "").includes(q)
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            {isBn ? "ডাটা মনিটর" : "Data Monitor"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isBn ? "সব ক্যাম্পেইনের ডাটা এক জায়গায় দেখুন" : "View all campaign data in one place"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={dataMode} onValueChange={setDataMode}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isBn ? "সব ডাটা" : "All Data"}</SelectItem>
              <SelectItem value="lead">{isBn ? "লিড" : "Lead"}</SelectItem>
              <SelectItem value="processing">{isBn ? "প্রসেসিং" : "Processing"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedCampaign} onValueChange={handleCampaignChange}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder={isBn ? "সব ক্যাম্পেইন" : "All Campaigns"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isBn ? "সব ক্যাম্পেইন" : "All Campaigns"}</SelectItem>
              {campaigns?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {websites && websites.length > 0 && (
            <Select value={selectedWebsite} onValueChange={setSelectedWebsite}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={isBn ? "সব ওয়েবসাইট" : "All Websites"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isBn ? "সব ওয়েবসাইট" : "All Websites"}</SelectItem>
                {websites.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.site_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: isBn ? "মোট লিড" : "Total Leads", value: allLeads.length, icon: Target, color: "text-primary" },
          { label: isBn ? "ফ্রেশ" : "Fresh", value: freshLeads.length, icon: Target, color: "text-blue-500" },
          { label: isBn ? "ব্রোঞ্জ" : "Bronze", value: bronzeLeads.length, icon: User, color: "text-amber-600" },
          { label: isBn ? "সিলভার" : "Silver", value: silverLeads.length, icon: User, color: "text-slate-400" },
          { label: isBn ? "মোট অর্ডার" : "Orders", value: allOrders.length, icon: ShoppingCart, color: "text-emerald-500" },
          { label: isBn ? "পেন্ডিং CSO" : "Pending CSO", value: pendingOrders.length, icon: Package, color: "text-yellow-500" },
          { label: isBn ? "ডেলিভার্ড" : "Delivered", value: deliveredOrders.length, icon: Truck, color: "text-green-500" },
          { label: isBn ? "রিটার্নড" : "Returned", value: returnedOrders.length, icon: Truck, color: "text-red-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-3 text-center">
              <stat.icon className={`h-4 w-4 mx-auto mb-1 ${stat.color}`} />
              <p className="text-lg font-heading font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="leads" className="text-xs">
              🎯 {isBn ? "সব লিড" : "All Leads"} ({allLeads.length})
            </TabsTrigger>
            <TabsTrigger value="bronze" className="text-xs">
              🥉 {isBn ? "ব্রোঞ্জ" : "Bronze"} ({bronzeLeads.length})
            </TabsTrigger>
            <TabsTrigger value="silver" className="text-xs">
              🥈 {isBn ? "সিলভার" : "Silver"} ({silverLeads.length})
            </TabsTrigger>
            <TabsTrigger value="orders" className="text-xs">
              🛒 {isBn ? "অর্ডার" : "Orders"} ({allOrders.length})
            </TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isBn ? "নাম বা ফোন দিয়ে খুঁজুন..." : "Search by name or phone..."}
              className="pl-9 text-sm"
            />
          </div>
        </div>

        {/* All Leads Tab */}
        <TabsContent value="leads">
          <LeadTable leads={filterBySearch(allLeads)} loading={leadsLoading} isBn={isBn} />
        </TabsContent>

        {/* Bronze Tab */}
        <TabsContent value="bronze">
          <LeadTable leads={filterBySearch(bronzeLeads)} loading={leadsLoading} isBn={isBn} />
        </TabsContent>

        {/* Silver Tab */}
        <TabsContent value="silver">
          <LeadTable leads={filterBySearch(silverLeads)} loading={leadsLoading} isBn={isBn} />
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <OrderTable orders={filterBySearch(allOrders)} loading={ordersLoading} isBn={isBn} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ---- Helper to parse product info from special_note ----
function parseSpecialNote(note: string | null | undefined): { product?: string; price?: string } {
  if (!note) return {};
  try {
    const parsed = JSON.parse(note);
    const flat: Record<string, unknown> = {};
    if (parsed.extra_fields && typeof parsed.extra_fields === "object") {
      Object.assign(flat, parsed.extra_fields);
    }
    Object.assign(flat, parsed);
    const product = flat.product || flat.product_name || flat.item_name || flat.products || "";
    const price = flat.price || flat.total || flat.amount || flat.order_total || "";
    return {
      product: product ? String(product) : undefined,
      price: price ? String(price) : undefined,
    };
  } catch {
    return {};
  }
}

// ---- Lead Table Component ----
interface LeadRow {
  id: string;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  status?: string | null;
  agent_type?: string | null;
  source?: string | null;
  created_at?: string | null;
  special_note?: string | null;
}

const LeadTable = ({ leads, loading, isBn }: { leads: LeadRow[]; loading: boolean; isBn: boolean }) => {
  if (loading) return <div className="h-40 animate-pulse bg-muted rounded-lg" />;
  if (leads.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
          {isBn ? "কোনো ডাটা নেই" : "No data found"}
        </CardContent>
      </Card>
    );

  const hasProductInfo = leads.some(l => {
    const info = parseSpecialNote(l.special_note);
    return info.product || info.price;
  });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">{isBn ? "নাম" : "Name"}</TableHead>
                <TableHead className="text-xs">{isBn ? "ফোন" : "Phone"}</TableHead>
                <TableHead className="text-xs">{isBn ? "ঠিকানা" : "Address"}</TableHead>
                <TableHead className="text-xs">{isBn ? "স্ট্যাটাস" : "Status"}</TableHead>
                {hasProductInfo && (
                  <>
                    <TableHead className="text-xs">{isBn ? "প্রোডাক্ট" : "Product"}</TableHead>
                    <TableHead className="text-xs">{isBn ? "মূল্য" : "Price"}</TableHead>
                  </>
                )}
                <TableHead className="text-xs">{isBn ? "টাইপ" : "Type"}</TableHead>
                <TableHead className="text-xs">{isBn ? "সোর্স" : "Source"}</TableHead>
                <TableHead className="text-xs">{isBn ? "তারিখ" : "Date"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const noteInfo = parseSpecialNote(lead.special_note);
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="text-sm font-medium">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {lead.name || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {lead.phone || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                      {lead.address || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${statusColorMap[lead.status || ""] || "bg-muted text-muted-foreground"}`}>
                        {lead.status || "—"}
                      </Badge>
                    </TableCell>
                    {hasProductInfo && (
                      <>
                        <TableCell className="text-xs font-medium">{noteInfo.product || "—"}</TableCell>
                        <TableCell className="text-xs font-medium">{noteInfo.price ? `৳${noteInfo.price}` : "—"}</TableCell>
                      </>
                    )}
                    <TableCell>
                      {lead.agent_type && lead.agent_type !== "processing" ? (
                        <Badge variant="outline" className="text-[10px]">
                          {lead.agent_type === "bronze" ? "🥉 Bronze" : "🥈 Silver"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{lead.source || "—"}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lead.created_at ? format(new Date(lead.created_at), "dd MMM yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

// ---- Order Table Component ----
interface OrderRow {
  id: string;
  customer_name?: string | null;
  phone?: string | null;
  address?: string | null;
  product?: string | null;
  price?: number | null;
  quantity?: number | null;
  status?: string | null;
  delivery_status?: string | null;
  steadfast_consignment_id?: string | null;
  created_at?: string | null;
}

const OrderTable = ({ orders, loading, isBn }: { orders: OrderRow[]; loading: boolean; isBn: boolean }) => {
  if (loading) return <div className="h-40 animate-pulse bg-muted rounded-lg" />;
  if (orders.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
          {isBn ? "কোনো অর্ডার নেই" : "No orders found"}
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">{isBn ? "কাস্টমার" : "Customer"}</TableHead>
                <TableHead className="text-xs">{isBn ? "ফোন" : "Phone"}</TableHead>
                <TableHead className="text-xs">{isBn ? "পণ্য" : "Product"}</TableHead>
                <TableHead className="text-xs">{isBn ? "মূল্য" : "Price"}</TableHead>
                <TableHead className="text-xs">{isBn ? "পরিমাণ" : "Qty"}</TableHead>
                <TableHead className="text-xs">{isBn ? "অর্ডার স্ট্যাটাস" : "Order Status"}</TableHead>
                <TableHead className="text-xs">{isBn ? "ডেলিভারি" : "Delivery"}</TableHead>
                <TableHead className="text-xs">{isBn ? "তারিখ" : "Date"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="text-sm font-medium">{order.customer_name || "—"}</TableCell>
                  <TableCell className="text-sm">{order.phone || "—"}</TableCell>
                  <TableCell className="text-sm">{order.product || "—"}</TableCell>
                  <TableCell className="text-sm font-medium">৳{(order.price || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{order.quantity || 1}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${orderStatusColorMap[order.status || ""] || "bg-muted text-muted-foreground"}`}>
                      {order.status === "pending_cso" ? (isBn ? "CSO পেন্ডিং" : "Pending CSO") :
                       order.status === "send_today" ? (isBn ? "আজ পাঠান" : "Send Today") :
                       order.status === "dispatched" ? (isBn ? "ডিসপ্যাচড" : "Dispatched") :
                       order.status === "call_done" ? (isBn ? "কল সম্পন্ন" : "Call Done") :
                       order.status || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${orderStatusColorMap[order.delivery_status || ""] || "bg-muted text-muted-foreground"}`}>
                      {order.delivery_status === "delivered" ? (isBn ? "✅ ডেলিভার্ড" : "✅ Delivered") :
                       order.delivery_status === "returned" ? (isBn ? "↩ রিটার্নড" : "↩ Returned") :
                       order.delivery_status === "in_transit" ? (isBn ? "🚚 ট্রানজিট" : "🚚 In Transit") :
                       order.delivery_status === "pending" ? (isBn ? "⏳ পেন্ডিং" : "⏳ Pending") :
                       order.delivery_status || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {order.created_at ? format(new Date(order.created_at), "dd MMM yyyy") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default HRDataMonitor;
