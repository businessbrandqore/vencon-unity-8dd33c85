import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Package, RotateCcw, XCircle, RefreshCw, Search, Edit } from "lucide-react";
import SalaryCard from "@/components/SalaryCard";
import EmptyState from "@/components/ui/EmptyState";

interface OrderRow {
  id: string;
  customer_name: string | null;
  phone: string | null;
  product: string | null;
  quantity: number | null;
  price: number | null;
  address: string | null;
  district: string | null;
  delivery_status: string | null;
  steadfast_consignment_id: string | null;
  created_at: string | null;
  status: string | null;
}

export default function CancellationExecutiveDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editOrder, setEditOrder] = useState<OrderRow | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [returnedCount, setReturnedCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);

  // Load editable fields from data operations config
  const [editableFields, setEditableFields] = useState<string[]>([]);

  const loadConfig = useCallback(async () => {
    const { data: configs } = await supabase
      .from("campaign_data_operations")
      .select("fields_config");

    if (configs && configs.length > 0) {
      // Gather all editable fields from any campaign config for cancellation role
      const allFields = new Set<string>();
      configs.forEach((c: any) => {
        const fields = c.fields_config as any[];
        if (Array.isArray(fields)) {
          fields.forEach((f: any) => {
            if (f.editable_by?.includes("cancellation_executive") || f.editable_by?.includes("all")) {
              allFields.add(f.field_name || f.name);
            }
          });
        }
      });
      setEditableFields(Array.from(allFields));
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("orders")
      .select("id, customer_name, phone, product, quantity, price, address, district, delivery_status, steadfast_consignment_id, created_at, status")
      .in("delivery_status", ["returned", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(500);

    if (filterStatus !== "all") {
      query = query.eq("delivery_status", filterStatus);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("ডাটা লোড করতে ব্যর্থ");
    } else {
      setOrders(data || []);
      setReturnedCount((data || []).filter(o => o.delivery_status === "returned").length);
      setCancelledCount((data || []).filter(o => o.delivery_status === "cancelled").length);
    }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { loadConfig(); loadOrders(); }, [loadConfig, loadOrders]);

  useEffect(() => {
    const channel = supabase
      .channel("cancellation-dash-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadOrders]);

  const filtered = orders.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.customer_name?.toLowerCase().includes(s) ||
      o.phone?.includes(s) ||
      o.product?.toLowerCase().includes(s) ||
      o.steadfast_consignment_id?.includes(s)
    );
  });

  const handleEdit = (order: OrderRow) => {
    setEditOrder(order);
    const vals: Record<string, string> = {};
    editableFields.forEach(f => {
      vals[f] = (order as any)[f] ?? "";
    });
    setEditValues(vals);
  };

  const handleSave = async () => {
    if (!editOrder) return;
    setSaving(true);
    const updates: Record<string, any> = {};
    editableFields.forEach(f => {
      updates[f] = editValues[f] || null;
    });

    const { error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", editOrder.id);

    if (error) {
      toast.error("আপডেট করতে ব্যর্থ");
    } else {
      toast.success("আপডেট সফল হয়েছে");
      setEditOrder(null);
      loadOrders();
    }
    setSaving(false);
  };

  const statusBadge = (status: string | null) => {
    if (status === "returned") return <Badge variant="outline" className="border-orange-500 text-orange-600"><RotateCcw className="h-3 w-3 mr-1" />Returned</Badge>;
    if (status === "cancelled") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <SalaryCard />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-heading font-bold">{orders.length}</p>
            <p className="text-xs text-muted-foreground font-body">মোট</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <RotateCcw className="h-8 w-8 mx-auto text-orange-500 mb-1" />
            <p className="text-2xl font-heading font-bold">{returnedCount}</p>
            <p className="text-xs text-muted-foreground font-body">Returned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="h-8 w-8 mx-auto text-destructive mb-1" />
            <p className="text-2xl font-heading font-bold">{cancelledCount}</p>
            <p className="text-xs text-muted-foreground font-body">Cancelled</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg">রিটার্ন ও ক্যান্সেল অর্ডার</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="নাম, ফোন, পণ্য বা কনসাইনমেন্ট আইডি..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="স্ট্যাটাস" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadOrders}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">লোড হচ্ছে...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="রিটার্ন বা ক্যান্সেল অর্ডার পাওয়া যায়নি" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2 font-medium">কাস্টমার</th>
                    <th className="p-2 font-medium">ফোন</th>
                    <th className="p-2 font-medium">পণ্য</th>
                    <th className="p-2 font-medium">মূল্য</th>
                    <th className="p-2 font-medium">জেলা</th>
                    <th className="p-2 font-medium">স্ট্যাটাস</th>
                    <th className="p-2 font-medium">কনসাইনমেন্ট</th>
                    {editableFields.length > 0 && <th className="p-2 font-medium">অ্যাকশন</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(order => (
                    <tr key={order.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{order.customer_name || "—"}</td>
                      <td className="p-2">{order.phone || "—"}</td>
                      <td className="p-2">{order.product || "—"} {order.quantity && order.quantity > 1 ? `×${order.quantity}` : ""}</td>
                      <td className="p-2">৳{order.price ?? 0}</td>
                      <td className="p-2">{order.district || "—"}</td>
                      <td className="p-2">{statusBadge(order.delivery_status)}</td>
                      <td className="p-2 text-xs">{order.steadfast_consignment_id || "—"}</td>
                      {editableFields.length > 0 && (
                        <td className="p-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(order)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editOrder} onOpenChange={v => { if (!v) setEditOrder(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">অর্ডার এডিট</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {editableFields.map(field => (
              <div key={field}>
                <Label className="font-body text-xs capitalize">{field.replace(/_/g, " ")}</Label>
                <Input
                  value={editValues[field] || ""}
                  onChange={e => setEditValues(prev => ({ ...prev, [field]: e.target.value }))}
                />
              </div>
            ))}
            {editableFields.length === 0 && (
              <p className="text-sm text-muted-foreground">HR ডাটা অপারেশন থেকে কোনো এডিটযোগ্য ফিল্ড কনফিগার করা হয়নি।</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrder(null)}>বাতিল</Button>
            <Button onClick={handleSave} disabled={saving || editableFields.length === 0}>
              {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
