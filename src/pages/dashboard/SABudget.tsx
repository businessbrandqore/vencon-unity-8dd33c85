import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const TEAL = "#0D9488";

const SABudget = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [totalAllocated, setTotalAllocated] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [fundRequests, setFundRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [allocRes, expRes, fundRes] = await Promise.all([
      supabase.from("maintenance_budget").select("*").order("created_at", { ascending: false }),
      supabase.from("maintenance_expenses").select("*").order("created_at", { ascending: false }),
      supabase.from("fund_requests").select("*, users!fund_requests_officer_id_fkey(name)").order("created_at", { ascending: false }),
    ]);

    const allocs = allocRes.data || [];
    const exps = expRes.data || [];

    setAllocations(allocs);
    setExpenses(exps);

    const totalAlloc = allocs.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);
    const totalExp = exps.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    setTotalAllocated(totalAlloc);
    setTotalExpenses(totalExp);

    // Category breakdown for current month
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    const monthExps = exps.filter((e: any) => (e.expense_date || e.created_at) >= monthStart);
    const catMap = new Map<string, number>();
    monthExps.forEach((e: any) => {
      const cat = e.category || "other";
      catMap.set(cat, (catMap.get(cat) || 0) + Number(e.amount || 0));
    });
    setCategoryData(
      Array.from(catMap.entries()).map(([category, total]) => ({
        category: category.replace(/_/g, " "),
        total,
      }))
    );

    setFundRequests(fundRes.data || []);
    setLoading(false);
  };

  const handleFundDecision = async (id: string, status: "approved" | "rejected", officerId: string, reqAmount: number) => {
    await supabase.from("fund_requests").update({ status, decided_by: user?.id, decided_at: new Date().toISOString() }).eq("id", id);
    if (status === "approved" && user) {
      await supabase.from("maintenance_budget").insert({ allocated_by: user.id, amount: reqAmount, note: `Fund request approved` });
      await supabase.from("notifications").insert({ user_id: officerId, title: "ফান্ড আবেদন অনুমোদিত", message: `৳${reqAmount.toLocaleString()} বরাদ্দ করা হয়েছে`, type: "info" });
    } else {
      await supabase.from("notifications").insert({ user_id: officerId, title: "ফান্ড আবেদন বাতিল", message: `৳${reqAmount.toLocaleString()} আবেদন বাতিল হয়েছে`, type: "warning" });
    }
    fetchData();
  };

  useEffect(() => { fetchData(); }, []);

  const handleAllocate = async () => {
    if (!amount || !user) return;
    setSaving(true);

    await supabase.from("maintenance_budget").insert({
      allocated_by: user.id,
      amount: Number(amount),
      note: note || null,
    });

    // Send notification to maintenance officers
    const { data: officers } = await supabase
      .from("users")
      .select("id")
      .eq("role", "maintenance_officer")
      .eq("is_active", true);

    if (officers && officers.length > 0) {
      const notifications = officers.map((o) => ({
        user_id: o.id,
        title: isBn ? "নতুন বাজেট বরাদ্দ" : "New Budget Allocation",
        message: `৳${Number(amount).toLocaleString()} ${note ? `— ${note}` : ""}`,
        type: "budget_allocation",
      }));
      await supabase.from("notifications").insert(notifications);
    }

    setAmount("");
    setNote("");
    setShowModal(false);
    setSaving(false);
    fetchData();
  };

  const balance = totalAllocated - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "মেইনটেন্যান্স বাজেট" : "Maintenance Budget"}
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-xs font-heading tracking-wider transition-colors"
          style={{ backgroundColor: TEAL, color: "#0A0A0A" }}
        >
          {isBn ? "ফান্ড বরাদ্দ করুন" : "Allocate Funds"}
        </button>
      </div>

      {loading ? (
        <div className="h-20 animate-pulse bg-secondary" />
      ) : (
        <>
          {/* Balance Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-border">
            <div className="bg-background p-6">
              <p className="font-body text-[11px] text-muted-foreground">{isBn ? "মোট বরাদ্দ" : "Total Allocated"}</p>
              <p className="font-heading text-2xl font-bold mt-1" style={{ color: TEAL }}>৳{totalAllocated.toLocaleString()}</p>
            </div>
            <div className="bg-background p-6">
              <p className="font-body text-[11px] text-muted-foreground">{isBn ? "মোট খরচ" : "Total Expenses"}</p>
              <p className="font-heading text-2xl font-bold mt-1 text-foreground">৳{totalExpenses.toLocaleString()}</p>
            </div>
            <div className="bg-background p-6">
              <p className="font-body text-[11px] text-muted-foreground">{isBn ? "বর্তমান ব্যালেন্স" : "Current Balance"}</p>
              <p className="font-heading text-2xl font-bold mt-1" style={{ color: balance >= 0 ? TEAL : "#EF4444" }}>৳{balance.toLocaleString()}</p>
            </div>
          </div>

          {/* Allocation History */}
          <div>
            <h4 className="font-heading text-xs tracking-wider text-muted-foreground uppercase mb-3">
              {isBn ? "বরাদ্দের ইতিহাস" : "Allocation History"}
            </h4>
            <div className="border border-border overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {[isBn ? "তারিখ" : "Date", isBn ? "পরিমাণ" : "Amount", isBn ? "নোট" : "Note"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-heading text-xs tracking-wider text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allocations.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-6 text-center font-body text-xs text-muted-foreground">{isBn ? "কোনো বরাদ্দ নেই" : "No allocations"}</td></tr>
                  ) : (
                    allocations.map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-body text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString(isBn ? "bn-BD" : "en-US")}</td>
                        <td className="px-4 py-3 font-heading text-xs font-bold" style={{ color: TEAL }}>৳{Number(a.amount).toLocaleString()}</td>
                        <td className="px-4 py-3 font-body text-xs text-foreground">{a.note || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expense Log */}
          <div>
            <h4 className="font-heading text-xs tracking-wider text-muted-foreground uppercase mb-3">
              {isBn ? "খরচের লগ" : "Expense Log"}
            </h4>
            <div className="border border-border overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {[isBn ? "তারিখ" : "Date", isBn ? "বিবরণ" : "Description", isBn ? "ক্যাটাগরি" : "Category", isBn ? "পরিমাণ" : "Amount"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-heading text-xs tracking-wider text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center font-body text-xs text-muted-foreground">{isBn ? "কোনো খরচ নেই" : "No expenses"}</td></tr>
                  ) : (
                    expenses.map((e) => (
                      <tr key={e.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-body text-xs text-muted-foreground">{new Date(e.expense_date || e.created_at).toLocaleDateString(isBn ? "bn-BD" : "en-US")}</td>
                        <td className="px-4 py-3 font-body text-xs text-foreground">{e.description}</td>
                        <td className="px-4 py-3 font-body text-xs text-foreground">{(e.category || "other").replace(/_/g, " ")}</td>
                        <td className="px-4 py-3 font-body text-xs text-foreground">৳{Number(e.amount).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Category Chart */}
          {categoryData.length > 0 && (
            <div className="border border-border p-4">
              <h4 className="font-heading text-xs tracking-wider text-muted-foreground uppercase mb-4">
                {isBn ? "এই মাসের খরচ (ক্যাটাগরি অনুযায়ী)" : "Monthly Expenses by Category"}
              </h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar dataKey="total" fill={TEAL} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Allocate Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md p-6 space-y-4">
            <h4 className="font-heading text-sm font-bold text-foreground">{isBn ? "ফান্ড বরাদ্দ করুন" : "Allocate Funds"}</h4>
            <input
              type="number"
              placeholder={isBn ? "পরিমাণ (৳)" : "Amount (BDT)"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent border border-border px-3 py-2 font-body text-sm text-foreground focus:outline-none"
            />
            <textarea
              placeholder={isBn ? "নোট (ঐচ্ছিক)" : "Note (optional)"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full bg-transparent border border-border px-3 py-2 font-body text-sm text-foreground focus:outline-none resize-none"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-heading text-muted-foreground hover:text-foreground transition-colors">{isBn ? "বাতিল" : "Cancel"}</button>
              <button
                onClick={handleAllocate}
                disabled={saving || !amount}
                className="px-4 py-2 text-xs font-heading tracking-wider transition-colors disabled:opacity-50"
                style={{ backgroundColor: TEAL, color: "#0A0A0A" }}
              >
                {saving ? "..." : isBn ? "বরাদ্দ করুন" : "Allocate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SABudget;
