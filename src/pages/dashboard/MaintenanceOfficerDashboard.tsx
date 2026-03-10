import { useState, useEffect, useCallback } from "react";
import SalaryCard from "@/components/SalaryCard";
import { useAuth } from "@/contexts/AuthContext";
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
import { Wrench, Plus, CalendarIcon, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  expense_date: string | null;
  created_at: string | null;
}

const CATEGORIES = ["Office Supplies", "Equipment", "Repair", "Transport", "Other"];

export default function MaintenanceOfficerDashboard() {
  const { user } = useAuth();
  const [totalBudget, setTotalBudget] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [todayExpenses, setTodayExpenses] = useState<Expense[]>([]);
  const [monthExpenses, setMonthExpenses] = useState<Expense[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState("");
  const [expDate, setExpDate] = useState<Date>(new Date());
  const [note, setNote] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const todayStr = new Date().toISOString().slice(0, 10);

    const [budgetRes, expensesRes, todayRes] = await Promise.all([
      supabase.from("maintenance_budget").select("amount"),
      supabase.from("maintenance_expenses").select("*").eq("officer_id", user.id).gte("expense_date", monthStart.toISOString().slice(0, 10)).order("created_at", { ascending: false }),
      supabase.from("maintenance_expenses").select("*").eq("officer_id", user.id).eq("expense_date", todayStr).order("created_at", { ascending: false }),
    ]);

    if (budgetRes.data) setTotalBudget(budgetRes.data.reduce((s, b) => s + (Number(b.amount) || 0), 0));
    if (expensesRes.data) {
      setMonthExpenses(expensesRes.data as Expense[]);
      setTotalSpent(expensesRes.data.reduce((s, e) => s + (Number(e.amount) || 0), 0));
    }
    if (todayRes.data) setTodayExpenses(todayRes.data as Expense[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const balance = totalBudget - totalSpent;

  const handleSubmit = async () => {
    if (!user || !desc || !amount || !category) { toast.error("সব field পূরণ করুন"); return; }

    await supabase.from("maintenance_expenses").insert({
      officer_id: user.id,
      description: desc,
      amount,
      category,
      expense_date: format(expDate, "yyyy-MM-dd"),
    });

    // Notify SA
    const { data: saUsers } = await supabase.from("users").select("id").eq("panel", "sa");
    if (saUsers) {
      await supabase.from("notifications").insert(
        saUsers.map((s) => ({
          user_id: s.id,
          title: `Maintenance expense: ৳${amount}`,
          message: `${desc} — Category: ${category}`,
          type: "info",
        }))
      );
    }

    toast.success("Expense যোগ হয়েছে ✓");
    setShowModal(false);
    setDesc(""); setAmount(0); setCategory(""); setNote("");
    loadData();
  };

  const generateReport = () => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Pop-up blocked"); return; }
    const rows = todayExpenses.map((e) => `
      <tr><td style="border:1px solid #ccc;padding:6px">${e.description}</td>
      <td style="border:1px solid #ccc;padding:6px">${e.category || "—"}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:right">৳${e.amount}</td></tr>
    `).join("");
    const total = todayExpenses.reduce((s, e) => s + e.amount, 0);
    w.document.write(`<!DOCTYPE html><html><head><title>Maintenance Report</title>
      <style>body{font-family:sans-serif;padding:30px;color:#000}table{border-collapse:collapse;width:100%}
      @media print{body{padding:10px}}</style></head><body>
      <h2>Maintenance Officer Daily Report</h2>
      <p>Date: ${format(new Date(), "PPP")}</p>
      <p>Officer: ${user?.name || "—"}</p>
      <table><thead><tr><th style="border:1px solid #ccc;padding:6px;text-align:left">Description</th>
      <th style="border:1px solid #ccc;padding:6px;text-align:left">Category</th>
      <th style="border:1px solid #ccc;padding:6px;text-align:right">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="2" style="border:1px solid #ccc;padding:6px;font-weight:bold">Total</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:bold">৳${total}</td></tr></tfoot></table>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  // Chart data
  const chartData = CATEGORIES.map((cat) => ({
    name: cat,
    amount: monthExpenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  }));

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <SalaryCard />
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Wrench className="h-5 w-5 text-[hsl(var(--panel-employee))]" /> Maintenance Officer
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateReport} disabled={todayExpenses.length === 0}>
            <FileText className="h-4 w-4 mr-1" /> Export Report
          </Button>
          <Button onClick={() => setShowModal(true)} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">
            <Plus className="h-4 w-4 mr-1" /> Expense যোগ করুন
          </Button>
        </div>
      </div>

      {/* Budget balance */}
      <Card className="border-[hsl(var(--panel-employee)/0.3)]">
        <CardContent className="pt-6 text-center">
          <p className="text-xs text-muted-foreground">বর্তমান Budget Balance</p>
          <p className={cn("text-4xl font-heading", balance < 0 ? "text-destructive" : "text-[hsl(var(--panel-employee))]")}>
            ৳{balance.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Budget: ৳{totalBudget.toLocaleString()} | Spent: ৳{totalSpent.toLocaleString()}</p>
        </CardContent>
      </Card>

      {/* Today's expenses */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading">আজকের Expenses</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="py-2 px-2 text-left">Description</th>
                <th className="py-2 px-2 text-left">Category</th>
                <th className="py-2 px-2 text-right">Amount</th>
                <th className="py-2 px-2 text-left">Time</th>
              </tr></thead>
              <tbody>
                {todayExpenses.map((e) => (
                  <tr key={e.id} className="border-b border-border">
                    <td className="py-2 px-2">{e.description}</td>
                    <td className="py-2 px-2"><Badge variant="outline">{e.category}</Badge></td>
                    <td className="py-2 px-2 text-right">৳{e.amount}</td>
                    <td className="py-2 px-2 text-xs">{e.created_at ? new Date(e.created_at).toLocaleTimeString("bn-BD") : "—"}</td>
                  </tr>
                ))}
                {todayExpenses.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">আজ কোনো expense নেই</td></tr>
                )}
              </tbody>
              {todayExpenses.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border font-medium">
                    <td className="py-2 px-2" colSpan={2}>Total</td>
                    <td className="py-2 px-2 text-right">৳{todayExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Monthly chart */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading">এই মাসের Category-ভিত্তিক খরচ</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="amount" fill="hsl(var(--panel-employee))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-muted-foreground mt-2 text-right">
            মাসিক Total: <strong>৳{totalSpent.toLocaleString()}</strong>
          </p>
        </CardContent>
      </Card>

      {/* Expense Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Expense যোগ করুন</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Description *</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount (৳) *</Label><Input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1" /></div>
              <div>
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full mt-1 justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />{format(expDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={expDate} onSelect={(d) => d && setExpDate(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">সংরক্ষণ করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
