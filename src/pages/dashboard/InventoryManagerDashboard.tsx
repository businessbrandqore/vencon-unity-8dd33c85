import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Package, Plus, AlertTriangle, CalendarIcon } from "lucide-react";

interface InventoryRow {
  id: string;
  product_name: string;
  stock_in: number | null;
  dispatched: number | null;
  returned: number | null;
  damaged: number | null;
  unit_price: number | null;
  low_stock_threshold: number | null;
}

export default function InventoryManagerDashboard() {
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  /* form */
  const [formProduct, setFormProduct] = useState("");
  const [formNewProduct, setFormNewProduct] = useState("");
  const [formQty, setFormQty] = useState<number>(0);
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [formNote, setFormNote] = useState("");

  const loadInventory = useCallback(async () => {
    const { data } = await supabase
      .from("inventory")
      .select("*")
      .order("product_name");
    if (data) setItems(data as InventoryRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  const currentStock = (item: InventoryRow) =>
    (item.stock_in || 0) - (item.dispatched || 0) + (item.returned || 0) - (item.damaged || 0);

  const isLowStock = (item: InventoryRow) =>
    currentStock(item) <= (item.low_stock_threshold || 10);

  const lowStockItems = items.filter(isLowStock);

  const handleSubmit = async () => {
    const productName = formProduct === "__new__" ? formNewProduct : formProduct;
    if (!productName) { toast.error("Product নির্বাচন করুন"); return; }
    if (formQty <= 0) { toast.error("Quantity দিন"); return; }

    const existing = items.find((i) => i.product_name === productName);
    if (existing) {
      await supabase.from("inventory").update({
        stock_in: (existing.stock_in || 0) + formQty,
        unit_price: formPrice || existing.unit_price,
      }).eq("id", existing.id);
    } else {
      await supabase.from("inventory").insert({
        product_name: productName,
        stock_in: formQty,
        unit_price: formPrice || null,
      });
    }

    toast.success("Stock entry সংরক্ষিত হয়েছে ✓");
    setShowModal(false);
    setFormProduct("");
    setFormNewProduct("");
    setFormQty(0);
    setFormPrice(0);
    setFormNote("");
    loadInventory();
  };

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Package className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
          Inventory Management
        </h1>
        <Button onClick={() => setShowModal(true)} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">
          <Plus className="h-4 w-4 mr-1" /> Stock Entry যোগ করুন
        </Button>
      </div>

      {/* Low stock alerts */}
      {lowStockItems.length > 0 && (
        <Card className="border-orange-500/50">
          <CardHeader>
            <CardTitle className="text-sm font-heading flex items-center gap-2 text-orange-400">
              <AlertTriangle className="h-4 w-4" /> Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
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

      {/* Stock table */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-2 text-left">Product Name</th>
                  <th className="py-2 px-2 text-right">Stock In</th>
                  <th className="py-2 px-2 text-right">Dispatched</th>
                  <th className="py-2 px-2 text-right">Returned</th>
                  <th className="py-2 px-2 text-right">Damaged</th>
                  <th className="py-2 px-2 text-right">Current Stock</th>
                  <th className="py-2 px-2 text-right">Unit Price</th>
                  <th className="py-2 px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const stock = currentStock(item);
                  const low = isLowStock(item);
                  return (
                    <tr key={item.id} className={cn("border-b border-border", low && "bg-orange-500/5")}>
                      <td className="py-2 px-2 font-medium">{item.product_name}</td>
                      <td className="py-2 px-2 text-right">{item.stock_in || 0}</td>
                      <td className="py-2 px-2 text-right">{item.dispatched || 0}</td>
                      <td className="py-2 px-2 text-right">{item.returned || 0}</td>
                      <td className="py-2 px-2 text-right">{item.damaged || 0}</td>
                      <td className="py-2 px-2 text-right font-heading">{stock}</td>
                      <td className="py-2 px-2 text-right">৳{item.unit_price || 0}</td>
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
                {items.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">কোনো product নেই</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            * SteadFast integration স্বয়ংক্রিয়ভাবে Dispatched, Returned, এবং Damaged আপডেট করে
          </p>
        </CardContent>
      </Card>

      {/* Stock Entry Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Stock Entry যোগ করুন</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Product</Label>
              <Select value={formProduct} onValueChange={setFormProduct}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Product নির্বাচন" /></SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.product_name}>{i.product_name}</SelectItem>
                  ))}
                  <SelectItem value="__new__">+ নতুন Product</SelectItem>
                </SelectContent>
              </Select>
              {formProduct === "__new__" && (
                <Input value={formNewProduct} onChange={(e) => setFormNewProduct(e.target.value)} placeholder="নতুন product-এর নাম" className="mt-2" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity Received</Label><Input type="number" min={1} value={formQty} onChange={(e) => setFormQty(Number(e.target.value))} className="mt-1" /></div>
              <div><Label>Unit Price (৳)</Label><Input type="number" min={0} value={formPrice} onChange={(e) => setFormPrice(Number(e.target.value))} className="mt-1" /></div>
            </div>
            <div>
              <Label>Date Received</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={formDate} onSelect={(d) => d && setFormDate(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div><Label>Note</Label><Textarea value={formNote} onChange={(e) => setFormNote(e.target.value)} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">সংরক্ষণ করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
