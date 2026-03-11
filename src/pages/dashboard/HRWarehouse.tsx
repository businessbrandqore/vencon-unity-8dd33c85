import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle } from "lucide-react";

interface InventoryItem {
  id: string;
  product_name: string;
  stock_in: number;
  dispatched: number;
  returned: number;
  damaged: number;
  unit_price: number;
  low_stock_threshold: number;
}

const HRWarehouse = () => {
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("inventory").select("*").order("product_name");
      if (data) setItems(data as InventoryItem[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const currentStock = (item: InventoryItem) =>
    (item.stock_in || 0) - (item.dispatched || 0) + (item.returned || 0) - (item.damaged || 0);

  const totalValue = items.reduce((sum, item) => sum + currentStock(item) * (item.unit_price || 0), 0);
  const lowStockCount = items.filter((item) => currentStock(item) < (item.low_stock_threshold || 10)).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "ওয়্যারহাউস স্টক (শুধু দেখার জন্য)" : "Warehouse Stock (Read Only)"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isBn ? "বর্তমান ইনভেন্টরি অবস্থা — পরিবর্তন শুধু SA প্যানেল থেকে করা যাবে" : "Current inventory status — changes can only be made from SA panel"}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{isBn ? "মোট পণ্য" : "Total Products"}</p>
            <p className="text-2xl font-heading font-bold text-foreground">{items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{isBn ? "মোট স্টক মূল্য" : "Total Stock Value"}</p>
            <p className="text-2xl font-heading font-bold text-primary">৳{totalValue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{isBn ? "মোট ডিসপ্যাচড" : "Total Dispatched"}</p>
            <p className="text-2xl font-heading font-bold text-foreground">{items.reduce((s, i) => s + (i.dispatched || 0), 0)}</p>
          </CardContent>
        </Card>
        <Card className={lowStockCount > 0 ? "border-amber-500/50" : ""}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{isBn ? "লো স্টক" : "Low Stock"}</p>
            <p className={`text-2xl font-heading font-bold ${lowStockCount > 0 ? "text-amber-500" : "text-foreground"}`}>
              {lowStockCount} {lowStockCount > 0 && <AlertTriangle className="inline h-4 w-4" />}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {isBn ? "পণ্য তালিকা" : "Product List"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-40 animate-pulse bg-muted rounded" />
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{isBn ? "কোনো পণ্য নেই" : "No products"}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {(isBn
                      ? ["পণ্যের নাম", "স্টক ইন", "ডিসপ্যাচড", "রিটার্নড", "ড্যামেজড", "বর্তমান স্টক", "ইউনিট প্রাইস"]
                      : ["Product", "Stock In", "Dispatched", "Returned", "Damaged", "Current Stock", "Unit Price"]
                    ).map((h) => (
                      <th key={h} className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const stock = currentStock(item);
                    const isLow = stock < (item.low_stock_threshold || 10);
                    return (
                      <tr key={item.id} className={`border-b border-border last:border-0 ${isLow ? "bg-amber-500/5" : ""}`}>
                        <td className="py-2.5 px-3 font-medium text-foreground">{item.product_name}</td>
                        <td className="py-2.5 px-3 text-foreground">{item.stock_in}</td>
                        <td className="py-2.5 px-3 text-foreground">{item.dispatched}</td>
                        <td className="py-2.5 px-3 text-foreground">{item.returned}</td>
                        <td className="py-2.5 px-3 text-foreground">{item.damaged}</td>
                        <td className="py-2.5 px-3 font-heading font-bold">
                          <Badge variant={isLow ? "destructive" : "default"} className="text-xs">
                            {stock} {isLow && "⚠"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-foreground">৳{(item.unit_price || 0).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground italic text-center">
        {isBn
          ? "* Dispatched, Returned, Damaged কাউন্ট SteadFast কুরিয়ার ইন্টিগ্রেশন থেকে স্বয়ংক্রিয়ভাবে আপডেট হয়"
          : "* Dispatched, Returned, Damaged counts auto-update via SteadFast courier integration"}
      </p>
    </div>
  );
};

export default HRWarehouse;
