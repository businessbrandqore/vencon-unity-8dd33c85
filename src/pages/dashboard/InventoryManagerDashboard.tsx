import { useState, useEffect } from "react";
import SalaryCard from "@/components/SalaryCard";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Package, AlertTriangle, CheckCircle, Clock, Send, ArrowRight } from "lucide-react";

export default function InventoryManagerDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pending: 0, dispatched: 0, failed: 0 });
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [ordersRes, stockRes] = await Promise.all([
        supabase.from("orders").select("id, status, steadfast_send_failed").in("status", ["send_today", "dispatched"]),
        supabase.from("inventory").select("*").order("product_name"),
      ]);

      const orders = ordersRes.data || [];
      setStats({
        pending: orders.filter((o) => o.status === "send_today" && !o.steadfast_send_failed).length,
        dispatched: orders.filter((o) => o.status === "dispatched").length,
        failed: orders.filter((o) => o.steadfast_send_failed).length,
      });

      if (stockRes.data) setStockItems(stockRes.data);
      setLoading(false);
    })();
  }, []);

  const currentStock = (item: any) =>
    (item.stock_in || 0) - (item.dispatched || 0) + (item.returned || 0) - (item.damaged || 0);

  const lowStockItems = stockItems.filter((i) => currentStock(i) <= (i.low_stock_threshold || 10));

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <SalaryCard />

      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Package className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
          Inventory Manager Dashboard
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className="h-8 w-8 text-orange-400" />
            <div>
              <p className="text-xs text-muted-foreground">Pending Dispatch</p>
              <p className="text-2xl font-heading">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Dispatched</p>
              <p className="text-2xl font-heading">{stats.dispatched}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="text-2xl font-heading">{stats.failed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Go to Dispatch */}
      <Card className="cursor-pointer hover:border-[hsl(var(--panel-employee)/0.5)] transition-colors" onClick={() => navigate("/employee/dispatch")}>
        <CardContent className="pt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Send className="h-6 w-6 text-[hsl(var(--panel-employee))]" />
            <div>
              <p className="font-heading font-bold">অর্ডার ডিসপ্যাচ</p>
              <p className="text-xs text-muted-foreground">Send Today অর্ডার দেখুন, SteadFast-এ পাঠান, ইনভয়েস প্রিন্ট করুন</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <Card className="border-orange-500/50">
          <CardContent className="pt-6">
            <p className="text-sm font-heading flex items-center gap-2 text-orange-400 mb-3">
              <AlertTriangle className="h-4 w-4" /> Low Stock Alert
            </p>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map((item) => (
                <Badge key={item.id} variant="outline" className="border-orange-500/50 text-orange-400">
                  {item.product_name} — Stock: {currentStock(item)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock Overview */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-heading mb-3">বর্তমান স্টক</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-2 text-left">Product</th>
                  <th className="py-2 px-2 text-right">Stock In</th>
                  <th className="py-2 px-2 text-right">Dispatched</th>
                  <th className="py-2 px-2 text-right">Current Stock</th>
                  <th className="py-2 px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {stockItems.map((item) => {
                  const stock = currentStock(item);
                  const low = stock <= (item.low_stock_threshold || 10);
                  return (
                    <tr key={item.id} className={cn("border-b border-border", low && "bg-orange-500/5")}>
                      <td className="py-2 px-2 font-medium">{item.product_name}</td>
                      <td className="py-2 px-2 text-right">{item.stock_in || 0}</td>
                      <td className="py-2 px-2 text-right">{item.dispatched || 0}</td>
                      <td className="py-2 px-2 text-right font-heading font-bold">{stock}</td>
                      <td className="py-2 px-2 text-center">
                        {low ? (
                          <Badge variant="outline" className="text-orange-400 border-orange-500/50">Low</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-400 border-green-600/50">OK</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {stockItems.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">কোনো product নেই</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
