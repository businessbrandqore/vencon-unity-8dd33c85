import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

const TEAL = "#0D9488";

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

const SAWarehouse = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Add stock form
  const [newProduct, setNewProduct] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchInventory = async () => {
    const { data } = await supabase.from("inventory").select("*").order("product_name");
    if (data) setItems(data as InventoryItem[]);
    setLoading(false);
  };

  useEffect(() => { fetchInventory(); }, []);

  const currentStock = (item: InventoryItem) =>
    (item.stock_in || 0) - (item.dispatched || 0) + (item.returned || 0) - (item.damaged || 0);

  const handleAddStock = async () => {
    if (!newProduct.trim() || !newQty) return;
    setSaving(true);

    // Check if product exists
    const { data: existing } = await supabase
      .from("inventory")
      .select("id, stock_in")
      .eq("product_name", newProduct.trim())
      .maybeSingle();

    if (existing) {
      await supabase
        .from("inventory")
        .update({ stock_in: (existing.stock_in || 0) + Number(newQty), unit_price: newPrice ? Number(newPrice) : undefined })
        .eq("id", existing.id);
    } else {
      await supabase.from("inventory").insert({
        product_name: newProduct.trim(),
        stock_in: Number(newQty),
        unit_price: newPrice ? Number(newPrice) : null,
      });
    }

    setNewProduct("");
    setNewQty("");
    setNewPrice("");
    setShowModal(false);
    setSaving(false);
    fetchInventory();
  };

  const headers = isBn
    ? ["পণ্যের নাম", "স্টক ইন", "ডিসপ্যাচড", "রিটার্নড", "ড্যামেজড", "বর্তমান স্টক", "ইউনিট প্রাইস", "মোট মূল্য"]
    : ["Product Name", "Stock In", "Dispatched", "Returned", "Damaged", "Current Stock", "Unit Price", "Total Value"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "ওয়্যারহাউস স্টক ম্যানেজমেন্ট" : "Warehouse Stock Management"}
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-xs font-heading tracking-wider transition-colors"
          style={{ backgroundColor: TEAL, color: "#0A0A0A" }}
        >
          {isBn ? "+ স্টক যোগ করুন" : "+ Add Stock"}
        </button>
      </div>

      {loading ? (
        <div className="border border-border p-8 animate-pulse h-40" />
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {headers.map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-heading text-xs tracking-wider text-muted-foreground uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center font-body text-xs text-muted-foreground">{isBn ? "কোনো পণ্য নেই" : "No products"}</td></tr>
              ) : (
                items.map((item) => {
                  const stock = currentStock(item);
                  const isLow = stock < (item.low_stock_threshold || 10);
                  const totalValue = stock * (item.unit_price || 0);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-border last:border-0 transition-colors"
                      style={isLow ? { backgroundColor: "rgba(245, 158, 11, 0.1)" } : undefined}
                    >
                      <td className="px-4 py-3 font-body text-xs text-foreground">{item.product_name}</td>
                      <td className="px-4 py-3 font-body text-xs text-foreground">{item.stock_in}</td>
                      <td className="px-4 py-3 font-body text-xs text-foreground">{item.dispatched}</td>
                      <td className="px-4 py-3 font-body text-xs text-foreground">{item.returned}</td>
                      <td className="px-4 py-3 font-body text-xs text-foreground">{item.damaged}</td>
                      <td className="px-4 py-3 font-heading text-xs font-bold" style={{ color: isLow ? "#F59E0B" : TEAL }}>
                        {stock} {isLow && "⚠"}
                      </td>
                      <td className="px-4 py-3 font-body text-xs text-foreground">৳{(item.unit_price || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 font-body text-xs text-foreground">৳{totalValue.toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="font-body text-[11px] text-muted-foreground italic">
        {isBn
          ? "* Dispatched, Returned, এবং Damaged কাউন্ট SteadFast কুরিয়ার ইন্টিগ্রেশন থেকে স্বয়ংক্রিয়ভাবে আপডেট হয়"
          : "* Dispatched, Returned, and Damaged counts are automatically updated by SteadFast courier integration"}
      </p>

      {/* Add Stock Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md p-6 space-y-4">
            <h4 className="font-heading text-sm font-bold text-foreground">
              {isBn ? "স্টক যোগ করুন" : "Add Stock"}
            </h4>
            <div className="space-y-3">
              <input
                placeholder={isBn ? "পণ্যের নাম" : "Product Name"}
                value={newProduct}
                onChange={(e) => setNewProduct(e.target.value)}
                className="w-full bg-transparent border border-border px-3 py-2 font-body text-sm text-foreground focus:outline-none"
              />
              <input
                type="number"
                placeholder={isBn ? "পরিমাণ" : "Quantity"}
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className="w-full bg-transparent border border-border px-3 py-2 font-body text-sm text-foreground focus:outline-none"
              />
              <input
                type="number"
                placeholder={isBn ? "ইউনিট প্রাইস (৳)" : "Unit Price (BDT)"}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full bg-transparent border border-border px-3 py-2 font-body text-sm text-foreground focus:outline-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-heading text-muted-foreground hover:text-foreground transition-colors">
                {isBn ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={handleAddStock}
                disabled={saving || !newProduct.trim() || !newQty}
                className="px-4 py-2 text-xs font-heading tracking-wider transition-colors disabled:opacity-50"
                style={{ backgroundColor: TEAL, color: "#0A0A0A" }}
              >
                {saving ? "..." : isBn ? "সেভ করুন" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SAWarehouse;
