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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { Wrench, Plus, CalendarIcon, FileText, ArrowDownToLine, ArrowUpFromLine, Wallet, Send, TrendingUp, TrendingDown, Package, Monitor } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  expense_date: string | null;
  created_at: string | null;
}

interface LogisticsItem {
  id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  type: string;
  note: string | null;
  item_date: string;
  created_at: string;
}

interface FundRequest {
  id: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
  decided_at: string | null;
}

interface DeskReport {
  id: string;
  date: string;
  desk_number: string | null;
  desk_condition: string | null;
  clock_in: string | null;
  user_id: string | null;
  user_name?: string;
}

const CATEGORIES = ["Office Supplies", "Equipment", "Repair", "Transport", "Logistics", "Other"];
const LOGISTICS_CATEGORIES = ["Electronics", "Furniture", "Stationery", "Equipment", "Packaging", "Other"];
const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--accent))"];

type ReportPeriod = "daily" | "monthly" | "yearly";

export default function MaintenanceOfficerDashboard() {
  const { user } = useAuth();
  const [totalBudget, setTotalBudget] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [logistics, setLogistics] = useState<LogisticsItem[]>([]);
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deskReports, setDeskReports] = useState<DeskReport[]>([]);
  const [deskFilter, setDeskFilter] = useState("all");
  const [deskDate, setDeskDate] = useState<Date | undefined>(undefined);


  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showLogisticsModal, setShowLogisticsModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);

  // Phone instruction
  const [phoneInstruction, setPhoneInstruction] = useState("");
  const [editingInstruction, setEditingInstruction] = useState(false);
  const [instructionDraft, setInstructionDraft] = useState("");

  // Expense form
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState("");
  const [expDate, setExpDate] = useState<Date>(new Date());

  // Logistics form
  const [logName, setLogName] = useState("");
  const [logCategory, setLogCategory] = useState("");
  const [logQty, setLogQty] = useState(1);
  const [logPrice, setLogPrice] = useState(0);
  const [logType, setLogType] = useState<"in" | "out">("in");
  const [logNote, setLogNote] = useState("");
  const [logDate, setLogDate] = useState<Date>(new Date());

  // Fund request form
  const [fundAmount, setFundAmount] = useState(0);
  const [fundReason, setFundReason] = useState("");

  // Report period
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("monthly");

  const loadData = useCallback(async () => {
    if (!user) return;
    const now = new Date();
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const todayStr = format(now, "yyyy-MM-dd");

    const [budgetRes, expensesRes, logisticsRes, fundRes, deskRes] = await Promise.all([
      supabase.from("maintenance_budget").select("amount"),
      supabase.from("maintenance_expenses").select("*").eq("officer_id", user.id).gte("expense_date", monthStart).order("created_at", { ascending: false }),
      supabase.from("logistics_items").select("*").eq("officer_id", user.id).order("created_at", { ascending: false }).limit(500),
      supabase.from("fund_requests").select("*").eq("officer_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("attendance").select("id, date, desk_number, desk_condition, clock_in, user_id").not("desk_condition", "is", null).order("date", { ascending: false }).limit(200),
    ]);

    if (budgetRes.data) setTotalBudget(budgetRes.data.reduce((s, b) => s + (Number(b.amount) || 0), 0));
    if (expensesRes.data) {
      setExpenses(expensesRes.data as Expense[]);
      setTotalSpent(expensesRes.data.reduce((s, e) => s + (Number(e.amount) || 0), 0));
    }
    if (logisticsRes.data) setLogistics(logisticsRes.data as unknown as LogisticsItem[]);
    if (fundRes.data) setFundRequests(fundRes.data as FundRequest[]);

    // Load desk reports with user names
    if (deskRes.data && deskRes.data.length > 0) {
      const userIds = [...new Set(deskRes.data.map(d => d.user_id).filter(Boolean))] as string[];
      const { data: usersData } = await supabase.from("users").select("id, name").in("id", userIds);
      const userMap = new Map((usersData || []).map(u => [u.id, u.name]));
      setDeskReports(deskRes.data.map(d => ({
        ...d,
        user_name: d.user_id ? userMap.get(d.user_id) || "Unknown" : "Unknown",
      })) as DeskReport[]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Phone instruction
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "phone_minutes_instruction").maybeSingle();
      if (data?.value) {
        const val = String(data.value).replace(/^"|"$/g, '');
        setPhoneInstruction(val);
        setInstructionDraft(val);
      }
    })();
  }, []);

  const savePhoneInstruction = async () => {
    const { data: existing } = await supabase.from("app_settings").select("id").eq("key", "phone_minutes_instruction").maybeSingle();
    if (existing) {
      await supabase.from("app_settings").update({ value: JSON.stringify(instructionDraft) }).eq("key", "phone_minutes_instruction");
    } else {
      await supabase.from("app_settings").insert({ key: "phone_minutes_instruction", value: JSON.stringify(instructionDraft) });
    }
    setPhoneInstruction(instructionDraft);
    setEditingInstruction(false);
    toast.success("ফোন মিনিট নির্দেশনা সংরক্ষণ হয়েছে ✓");
  };

  const balance = totalBudget - totalSpent;

  // Submit expense
  const handleExpenseSubmit = async () => {
    if (!user || !desc || !amount || !category) { toast.error("সব field পূরণ করুন"); return; }
    await supabase.from("maintenance_expenses").insert({
      officer_id: user.id, description: desc, amount, category, expense_date: format(expDate, "yyyy-MM-dd"),
    });
    toast.success("Expense যোগ হয়েছে ✓");
    setShowExpenseModal(false);
    setDesc(""); setAmount(0); setCategory("");
    loadData();
  };

  // Submit logistics
  const handleLogisticsSubmit = async () => {
    if (!user || !logName || !logCategory || logQty < 1) { toast.error("সব field পূরণ করুন"); return; }
    await supabase.from("logistics_items").insert({
      officer_id: user.id, item_name: logName, category: logCategory,
      quantity: logQty, unit_price: logPrice, type: logType,
      note: logNote || null, item_date: format(logDate, "yyyy-MM-dd"),
    });
    toast.success(`লজিস্টিক ${logType === "in" ? "ইন" : "আউট"} যোগ হয়েছে ✓`);
    setShowLogisticsModal(false);
    setLogName(""); setLogCategory(""); setLogQty(1); setLogPrice(0); setLogNote("");
    loadData();
  };

  // Submit fund request
  const handleFundSubmit = async () => {
    if (!user || !fundAmount || !fundReason) { toast.error("সব field পূরণ করুন"); return; }
    await supabase.from("fund_requests").insert({
      officer_id: user.id, amount: fundAmount, reason: fundReason,
    });
    toast.success("ফান্ড আবেদন জমা হয়েছে ✓");
    setShowFundModal(false);
    setFundAmount(0); setFundReason("");
    loadData();
  };

  // Print report
  const generateReport = (period: ReportPeriod) => {
    const now = new Date();
    let periodLabel = "";
    let filteredExpenses: Expense[] = [];
    let filteredLogistics: LogisticsItem[] = [];

    if (period === "daily") {
      const today = format(now, "yyyy-MM-dd");
      periodLabel = format(now, "dd MMMM yyyy");
      filteredExpenses = expenses.filter(e => e.expense_date === today);
      filteredLogistics = logistics.filter(l => l.item_date === today);
    } else if (period === "monthly") {
      const ms = format(startOfMonth(now), "yyyy-MM-dd");
      const me = format(endOfMonth(now), "yyyy-MM-dd");
      periodLabel = format(now, "MMMM yyyy");
      filteredExpenses = expenses.filter(e => e.expense_date && e.expense_date >= ms && e.expense_date <= me);
      filteredLogistics = logistics.filter(l => l.item_date >= ms && l.item_date <= me);
    } else {
      const ys = format(startOfYear(now), "yyyy-MM-dd");
      const ye = format(endOfYear(now), "yyyy-MM-dd");
      periodLabel = `${now.getFullYear()}`;
      filteredExpenses = expenses.filter(e => e.expense_date && e.expense_date >= ys && e.expense_date <= ye);
      filteredLogistics = logistics.filter(l => l.item_date >= ys && l.item_date <= ye);
    }

    const totalExp = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const totalLogIn = filteredLogistics.filter(l => l.type === "in").reduce((s, l) => s + l.total_price, 0);
    const totalLogOut = filteredLogistics.filter(l => l.type === "out").reduce((s, l) => s + l.total_price, 0);

    const w = window.open("", "_blank");
    if (!w) { toast.error("Pop-up blocked"); return; }

    const expRows = filteredExpenses.map(e => `
      <tr><td style="border:1px solid #ddd;padding:8px">${e.expense_date || "—"}</td>
      <td style="border:1px solid #ddd;padding:8px">${e.description}</td>
      <td style="border:1px solid #ddd;padding:8px">${e.category || "—"}</td>
      <td style="border:1px solid #ddd;padding:8px;text-align:right">৳${e.amount.toLocaleString()}</td></tr>
    `).join("");

    const logRows = filteredLogistics.map(l => `
      <tr><td style="border:1px solid #ddd;padding:8px">${l.item_date}</td>
      <td style="border:1px solid #ddd;padding:8px">${l.item_name}</td>
      <td style="border:1px solid #ddd;padding:8px">${l.category}</td>
      <td style="border:1px solid #ddd;padding:8px;text-align:center">${l.type === "in" ? "⬇ IN" : "⬆ OUT"}</td>
      <td style="border:1px solid #ddd;padding:8px;text-align:center">${l.quantity}</td>
      <td style="border:1px solid #ddd;padding:8px;text-align:right">৳${l.unit_price}</td>
      <td style="border:1px solid #ddd;padding:8px;text-align:right">৳${l.total_price}</td></tr>
    `).join("");

    w.document.write(`<!DOCTYPE html><html><head><title>Maintenance Report - ${periodLabel}</title>
      <style>body{font-family:'Segoe UI',sans-serif;padding:40px;color:#222;max-width:900px;margin:0 auto}
      table{border-collapse:collapse;width:100%;margin:15px 0}h2{color:#0D9488;border-bottom:2px solid #0D9488;padding-bottom:8px}
      h3{color:#444;margin-top:30px}.summary{background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0;display:flex;gap:30px;justify-content:center}
      .summary-item{text-align:center}.summary-item .value{font-size:24px;font-weight:bold}.summary-item .label{font-size:12px;color:#666}
      @media print{body{padding:15px}.summary{background:#f0f0f0}}</style></head><body>
      <h2>🔧 Maintenance Officer Report</h2>
      <p><strong>Period:</strong> ${periodLabel} | <strong>Officer:</strong> ${user?.name || "—"} | <strong>Generated:</strong> ${format(now, "PPpp")}</p>
      
      <div class="summary">
        <div class="summary-item"><div class="value" style="color:#0D9488">৳${totalBudget.toLocaleString()}</div><div class="label">Total Budget</div></div>
        <div class="summary-item"><div class="value" style="color:#DC2626">৳${totalExp.toLocaleString()}</div><div class="label">Total Expenses</div></div>
        <div class="summary-item"><div class="value" style="color:#2563EB">৳${totalLogIn.toLocaleString()}</div><div class="label">Logistics In</div></div>
        <div class="summary-item"><div class="value" style="color:#EA580C">৳${totalLogOut.toLocaleString()}</div><div class="label">Logistics Out</div></div>
        <div class="summary-item"><div class="value" style="color:${balance >= 0 ? '#16A34A' : '#DC2626'}">৳${balance.toLocaleString()}</div><div class="label">Balance</div></div>
      </div>

      <h3>📋 Expenses (${filteredExpenses.length})</h3>
      <table><thead><tr style="background:#f0f0f0"><th style="border:1px solid #ddd;padding:8px;text-align:left">Date</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:left">Description</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:left">Category</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:right">Amount</th></tr></thead>
      <tbody>${expRows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#999">No expenses</td></tr>'}</tbody>
      <tfoot><tr style="background:#f0f0f0;font-weight:bold"><td colspan="3" style="border:1px solid #ddd;padding:8px">Total</td>
      <td style="border:1px solid #ddd;padding:8px;text-align:right">৳${totalExp.toLocaleString()}</td></tr></tfoot></table>

      <h3>📦 Logistics (${filteredLogistics.length})</h3>
      <table><thead><tr style="background:#f0f0f0"><th style="border:1px solid #ddd;padding:8px;text-align:left">Date</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:left">Item</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:left">Category</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:center">Type</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:center">Qty</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:right">Unit Price</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:right">Total</th></tr></thead>
      <tbody>${logRows || '<tr><td colspan="7" style="padding:20px;text-align:center;color:#999">No logistics items</td></tr>'}</tbody></table>

      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  // Chart data
  const chartData = CATEGORIES.map(cat => ({
    name: cat,
    amount: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(d => d.amount > 0);

  const logisticsInTotal = logistics.filter(l => l.type === "in").reduce((s, l) => s + l.total_price, 0);
  const logisticsOutTotal = logistics.filter(l => l.type === "out").reduce((s, l) => s + l.total_price, 0);
  const logisticsInCount = logistics.filter(l => l.type === "in").length;
  const logisticsOutCount = logistics.filter(l => l.type === "out").length;

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <SalaryCard />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Wrench className="h-5 w-5 text-[hsl(var(--panel-employee))]" /> Maintenance Officer
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowFundModal(true)}>
            <Send className="h-4 w-4 mr-1" /> ফান্ড আবেদন
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-1" /> রিপোর্ট প্রিন্ট</Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="end">
              <div className="space-y-1">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => generateReport("daily")}>📅 দৈনিক</Button>
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => generateReport("monthly")}>📆 মাসিক</Button>
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => generateReport("yearly")}>📊 বাৎসরিক</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Budget & Logistics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-[hsl(var(--panel-employee)/0.3)]">
          <CardContent className="pt-6 text-center">
            <Wallet className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className={cn("text-2xl font-heading", balance < 0 ? "text-destructive" : "text-primary")}>৳{balance.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Budget Balance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingDown className="h-6 w-6 mx-auto text-destructive mb-1" />
            <p className="text-2xl font-heading text-destructive">৳{totalSpent.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">এই মাসে খরচ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <ArrowDownToLine className="h-6 w-6 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-heading text-green-500">{logisticsInCount}</p>
            <p className="text-xs text-muted-foreground">Logistics In (৳{logisticsInTotal.toLocaleString()})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <ArrowUpFromLine className="h-6 w-6 mx-auto text-orange-500 mb-1" />
            <p className="text-2xl font-heading text-orange-500">{logisticsOutCount}</p>
            <p className="text-xs text-muted-foreground">Logistics Out (৳{logisticsOutTotal.toLocaleString()})</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="logistics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="logistics">📦 লজিস্টিক</TabsTrigger>
          <TabsTrigger value="expenses">💰 Expenses</TabsTrigger>
          <TabsTrigger value="funds">🏦 ফান্ড</TabsTrigger>
          <TabsTrigger value="desk">🖥️ ডেস্ক</TabsTrigger>
          <TabsTrigger value="phone">📱 ফোন</TabsTrigger>
        </TabsList>

        {/* Logistics Tab */}
        <TabsContent value="logistics" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-heading text-sm">লজিস্টিক আইটেম</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setLogType("in"); setShowLogisticsModal(true); }}>
                <ArrowDownToLine className="h-4 w-4 mr-1" /> In
              </Button>
              <Button size="sm" className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white" onClick={() => { setLogType("out"); setShowLogisticsModal(true); }}>
                <ArrowUpFromLine className="h-4 w-4 mr-1" /> Out
              </Button>
            </div>
          </div>
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 px-2 text-left">Date</th>
                    <th className="py-2 px-2 text-left">Item</th>
                    <th className="py-2 px-2 text-left">Category</th>
                    <th className="py-2 px-2 text-center">Type</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-2 text-right">Unit</th>
                    <th className="py-2 px-2 text-right">Total</th>
                  </tr></thead>
                  <tbody>
                    {logistics.slice(0, 30).map(l => (
                      <tr key={l.id} className="border-b border-border">
                        <td className="py-2 px-2 text-xs">{l.item_date}</td>
                        <td className="py-2 px-2">{l.item_name}</td>
                        <td className="py-2 px-2"><Badge variant="outline" className="text-xs">{l.category}</Badge></td>
                        <td className="py-2 px-2 text-center">
                          <Badge className={cn("text-xs", l.type === "in" ? "bg-green-600 text-white" : "bg-orange-600 text-white")}>
                            {l.type === "in" ? "⬇ IN" : "⬆ OUT"}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-center">{l.quantity}</td>
                        <td className="py-2 px-2 text-right">৳{l.unit_price}</td>
                        <td className="py-2 px-2 text-right font-medium">৳{l.total_price}</td>
                      </tr>
                    ))}
                    {logistics.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">কোনো লজিস্টিক আইটেম নেই</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-heading text-sm">এই মাসের Expenses</h2>
            <Button size="sm" onClick={() => setShowExpenseModal(true)} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">
              <Plus className="h-4 w-4 mr-1" /> Expense যোগ
            </Button>
          </div>
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 px-2 text-left">Date</th>
                    <th className="py-2 px-2 text-left">Description</th>
                    <th className="py-2 px-2 text-left">Category</th>
                    <th className="py-2 px-2 text-right">Amount</th>
                  </tr></thead>
                  <tbody>
                    {expenses.map(e => (
                      <tr key={e.id} className="border-b border-border">
                        <td className="py-2 px-2 text-xs">{e.expense_date || "—"}</td>
                        <td className="py-2 px-2">{e.description}</td>
                        <td className="py-2 px-2"><Badge variant="outline" className="text-xs">{e.category}</Badge></td>
                        <td className="py-2 px-2 text-right">৳{e.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    {expenses.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">কোনো expense নেই</td></tr>}
                  </tbody>
                  {expenses.length > 0 && (
                    <tfoot><tr className="border-t font-medium">
                      <td colSpan={3} className="py-2 px-2">Total</td>
                      <td className="py-2 px-2 text-right">৳{totalSpent.toLocaleString()}</td>
                    </tr></tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-heading">Category-ভিত্তিক খরচ</CardTitle></CardHeader>
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
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Fund Requests Tab */}
        <TabsContent value="funds" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-heading text-sm">ফান্ড আবেদন ও বাজেট</h2>
            <Button size="sm" onClick={() => setShowFundModal(true)} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">
              <Send className="h-4 w-4 mr-1" /> নতুন আবেদন
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-primary/30">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground">মোট বাজেট প্রাপ্তি</p>
                <p className="text-3xl font-heading text-primary">৳{totalBudget.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-[hsl(var(--panel-employee)/0.3)]">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground">অবশিষ্ট ব্যালেন্স</p>
                <p className={cn("text-3xl font-heading", balance >= 0 ? "text-green-500" : "text-destructive")}>৳{balance.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm font-heading">আবেদনের তালিকা</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 px-2 text-left">তারিখ</th>
                    <th className="py-2 px-2 text-right">পরিমাণ</th>
                    <th className="py-2 px-2 text-left">কারণ</th>
                    <th className="py-2 px-2 text-center">স্ট্যাটাস</th>
                  </tr></thead>
                  <tbody>
                    {fundRequests.map(f => (
                      <tr key={f.id} className="border-b border-border">
                        <td className="py-2 px-2 text-xs">{new Date(f.created_at).toLocaleDateString("bn-BD")}</td>
                        <td className="py-2 px-2 text-right font-medium">৳{f.amount.toLocaleString()}</td>
                        <td className="py-2 px-2">{f.reason}</td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant="outline" className={cn("text-xs",
                            f.status === "approved" ? "text-green-500 border-green-600/50" :
                            f.status === "rejected" ? "text-destructive border-destructive/50" :
                            "text-yellow-500 border-yellow-500/50"
                          )}>{f.status === "approved" ? "অনুমোদিত" : f.status === "rejected" ? "বাতিল" : "পেন্ডিং"}</Badge>
                        </td>
                      </tr>
                    ))}
                    {fundRequests.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">কোনো আবেদন নেই</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Desk Reports Tab */}
        <TabsContent value="desk" className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="font-heading text-sm flex items-center gap-2">
              <Monitor className="h-4 w-4" /> কর্মীদের ডেস্ক রিপোর্ট
            </h2>
            <div className="flex gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[160px] justify-start text-left text-xs", !deskDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {deskDate ? format(deskDate, "dd MMM yyyy") : "তারিখ ফিল্টার"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={deskDate} onSelect={setDeskDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {deskDate && <Button variant="ghost" size="sm" className="text-xs" onClick={() => setDeskDate(undefined)}>✕ রিসেট</Button>}
              <Select value={deskFilter} onValueChange={setDeskFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="সব স্ট্যাটাস" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব স্ট্যাটাস</SelectItem>
                  <SelectItem value="clean">✅ পরিষ্কার</SelectItem>
                  <SelectItem value="moderate">⚠️ মোটামুটি</SelectItem>
                  <SelectItem value="dirty">❌ অপরিষ্কার</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary cards */}
          {(() => {
            const clean = deskReports.filter(d => d.desk_condition === "clean").length;
            const moderate = deskReports.filter(d => d.desk_condition === "moderate").length;
            const dirty = deskReports.filter(d => d.desk_condition === "dirty").length;
            return (
              <div className="grid grid-cols-3 gap-3">
                <Card className="border-green-500/30">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-heading text-green-500">{clean}</p>
                    <p className="text-xs text-muted-foreground">পরিষ্কার</p>
                  </CardContent>
                </Card>
                <Card className="border-yellow-500/30">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-heading text-yellow-500">{moderate}</p>
                    <p className="text-xs text-muted-foreground">মোটামুটি</p>
                  </CardContent>
                </Card>
                <Card className="border-destructive/30">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-heading text-destructive">{dirty}</p>
                    <p className="text-xs text-muted-foreground">অপরিষ্কার</p>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 px-2 text-left">তারিখ</th>
                    <th className="py-2 px-2 text-left">কর্মী</th>
                    <th className="py-2 px-2 text-center">ডেস্ক নং</th>
                    <th className="py-2 px-2 text-center">অবস্থা</th>
                    <th className="py-2 px-2 text-left">চেক ইন</th>
                  </tr></thead>
                  <tbody>
                    {deskReports
                      .filter(d => deskFilter === "all" || d.desk_condition === deskFilter)
                      .map(d => (
                        <tr key={d.id} className="border-b border-border">
                          <td className="py-2 px-2 text-xs">{d.date}</td>
                          <td className="py-2 px-2">{d.user_name}</td>
                          <td className="py-2 px-2 text-center">{d.desk_number || "—"}</td>
                          <td className="py-2 px-2 text-center">
                            <Badge variant="outline" className={cn("text-xs",
                              d.desk_condition === "clean" ? "text-green-500 border-green-600/50" :
                              d.desk_condition === "moderate" ? "text-yellow-500 border-yellow-500/50" :
                              "text-destructive border-destructive/50"
                            )}>
                              {d.desk_condition === "clean" ? "✅ পরিষ্কার" : d.desk_condition === "moderate" ? "⚠️ মোটামুটি" : "❌ অপরিষ্কার"}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-xs">{d.clock_in ? new Date(d.clock_in).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                        </tr>
                      ))}
                    {deskReports.filter(d => deskFilter === "all" || d.desk_condition === deskFilter).length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">কোনো ডেস্ক রিপোর্ট নেই</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Phone Tab */}
        <TabsContent value="phone">
          <Card className="border-blue-500/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-heading">📱 ফোন মিনিট চেক করার নির্দেশনা</CardTitle>
                {!editingInstruction && (
                  <Button variant="outline" size="sm" onClick={() => { setInstructionDraft(phoneInstruction); setEditingInstruction(true); }}>এডিট করুন</Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingInstruction ? (
                <div className="space-y-3">
                  <Textarea value={instructionDraft} onChange={e => setInstructionDraft(e.target.value)} rows={4} placeholder="কর্মীরা কিভাবে ফোনের অবশিষ্ট মিনিট চেক করবে..." />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingInstruction(false)}>বাতিল</Button>
                    <Button size="sm" onClick={savePhoneInstruction} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">সংরক্ষণ</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {phoneInstruction || "এখনো কোনো নির্দেশনা দেওয়া হয়নি।"}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Expense Modal */}
      <Dialog open={showExpenseModal} onOpenChange={setShowExpenseModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Expense যোগ করুন</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Description *</Label><Input value={desc} onChange={e => setDesc(e.target.value)} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount (৳) *</Label><Input type="number" min={1} value={amount} onChange={e => setAmount(Number(e.target.value))} className="mt-1" /></div>
              <div>
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
                  <Calendar mode="single" selected={expDate} onSelect={d => d && setExpDate(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleExpenseSubmit} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">সংরক্ষণ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logistics Modal */}
      <Dialog open={showLogisticsModal} onOpenChange={setShowLogisticsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {logType === "in" ? <ArrowDownToLine className="h-5 w-5 text-green-500" /> : <ArrowUpFromLine className="h-5 w-5 text-orange-500" />}
              লজিস্টিক {logType === "in" ? "ইন" : "আউট"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>আইটেমের নাম *</Label><Input value={logName} onChange={e => setLogName(e.target.value)} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ক্যাটাগরি *</Label>
                <Select value={logCategory} onValueChange={setLogCategory}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="নির্বাচন" /></SelectTrigger>
                  <SelectContent>{LOGISTICS_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>পরিমাণ *</Label><Input type="number" min={1} value={logQty} onChange={e => setLogQty(Number(e.target.value))} className="mt-1" /></div>
            </div>
            <div><Label>একক মূল্য (৳)</Label><Input type="number" min={0} value={logPrice} onChange={e => setLogPrice(Number(e.target.value))} className="mt-1" /></div>
            <div>
              <Label>তারিখ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full mt-1 justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />{format(logDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={logDate} onSelect={d => d && setLogDate(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div><Label>নোট</Label><Textarea value={logNote} onChange={e => setLogNote(e.target.value)} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleLogisticsSubmit} className={cn(logType === "in" ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700", "text-white")}>
              {logType === "in" ? "ইন করুন" : "আউট করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fund Request Modal */}
      <Dialog open={showFundModal} onOpenChange={setShowFundModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>ফান্ড আবেদন</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>পরিমাণ (৳) *</Label><Input type="number" min={1} value={fundAmount} onChange={e => setFundAmount(Number(e.target.value))} className="mt-1" /></div>
            <div><Label>কারণ *</Label><Textarea value={fundReason} onChange={e => setFundReason(e.target.value)} className="mt-1" rows={3} placeholder="কেন ফান্ড দরকার..." /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleFundSubmit} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">আবেদন জমা দিন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
