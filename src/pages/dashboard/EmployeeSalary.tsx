import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DollarSign, TrendingUp, TrendingDown, Wallet, AlertTriangle, CheckCircle, Info, Calendar } from "lucide-react";

interface SalaryData {
  user_id: string;
  name: string;
  role: string;
  basic_salary: number;
  incentive: number;
  attendance_deductions: number;
  unpaid_deductions: number;
  total_deductions: number;
  net_salary: number;
  receive_ratio: number;
  month: number;
  year: number;
}

interface DailyData {
  basic_per_day: number;
  today_deductions: number;
  today_orders: number;
  net_today: number;
}

const MONTHS_BN = ["", "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

type FilterType = "daily" | "monthly" | "yearly";

const fmt = (v: number | null | undefined) => (v ?? 0).toLocaleString();
const n = (v: number | null | undefined) => v ?? 0;

export default function EmployeeSalary() {
  const { user } = useAuth();
  const [salary, setSalary] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("monthly");
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [yearlySalaries, setYearlySalaries] = useState<SalaryData[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // Fetch monthly salary
  const fetchMonthlySalary = async (year: number, month: number) => {
    if (!user) return;
    const { data } = await supabase.rpc("calculate_salary", {
      _user_id: user.id,
      _year: year,
      _month: month,
    });
    if (data) setSalary(data as unknown as SalaryData);
    setLoading(false);
  };

  // Fetch daily data
  const fetchDailyData = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    
    const [attRes, ordersRes] = await Promise.all([
      supabase.from("attendance").select("deduction_amount").eq("user_id", user.id).eq("date", today).maybeSingle(),
      supabase.from("orders").select("id").eq("agent_id", user.id).gte("created_at", `${today}T00:00:00`).neq("status", "cancelled"),
    ]);

    const basicPerDay = (user as any).basic_salary ? Number((user as any).basic_salary) / 27 : (salary?.basic_salary || 0) / 27;
    const todayDeductions = attRes.data?.deduction_amount || 0;
    const todayOrders = ordersRes.data?.length || 0;

    setDailyData({
      basic_per_day: Math.round(basicPerDay),
      today_deductions: todayDeductions,
      today_orders: todayOrders,
      net_today: Math.round(basicPerDay - todayDeductions),
    });
  };

  // Fetch yearly data
  const fetchYearlyData = async (year: number) => {
    if (!user) return;
    const results: SalaryData[] = [];
    const currentMonth = year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
    
    for (let m = 1; m <= currentMonth; m++) {
      const { data } = await supabase.rpc("calculate_salary", {
        _user_id: user.id,
        _year: year,
        _month: m,
      });
      if (data) results.push(data as unknown as SalaryData);
    }
    setYearlySalaries(results);
  };

  useEffect(() => {
    if (!user) return;
    fetchMonthlySalary(selectedYear, selectedMonth);
  }, [user, selectedYear, selectedMonth]);

  useEffect(() => {
    if (filter === "daily") fetchDailyData();
    if (filter === "yearly") fetchYearlyData(selectedYear);
  }, [filter, user, selectedYear]);

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;
  if (!salary) return <div className="p-6 text-muted-foreground">বেতন তথ্য পাওয়া যায়নি</div>;

  const isIncentiveRole = ["telesales_executive", "assistant_team_leader", "Assistant Team Leader", "team_leader", "group_leader"].includes(salary.role);
  const isTelesalesRole = salary.role === "telesales_executive";

  const yearlyTotals = yearlySalaries.length > 0 ? {
    basic: yearlySalaries.reduce((s, d) => s + n(d.basic_salary), 0),
    incentive: yearlySalaries.reduce((s, d) => s + n(d.incentive), 0),
    deductions: yearlySalaries.reduce((s, d) => s + n(d.total_deductions), 0),
    net: yearlySalaries.reduce((s, d) => s + n(d.net_salary), 0),
  } : null;

  const currentYear = new Date().getFullYear();
  const ratio = n(salary.receive_ratio);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-[hsl(var(--panel-employee))]" /> বেতন বিবরণ
        </h1>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-auto">
          <TabsList>
            <TabsTrigger value="daily">দৈনিক</TabsTrigger>
            <TabsTrigger value="monthly">মাসিক</TabsTrigger>
            <TabsTrigger value="yearly">বাৎসরিক</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Month/Year selectors for monthly view */}
      {filter === "monthly" && (
        <div className="flex gap-3">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS_BN.slice(1).map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(Number(v)); }}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {filter === "yearly" && (
        <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(Number(v)); fetchYearlyData(Number(v)); }}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* ════════ DAILY VIEW ════════ */}
      {filter === "daily" && dailyData && (
        <>
          <Card className="border-[hsl(var(--panel-employee)/0.3)]">
            <CardContent className="pt-8 pb-8 text-center">
              <p className="text-sm text-muted-foreground mb-2">আজকের আনুমানিক আয়</p>
              <p className="text-5xl font-heading text-[hsl(var(--panel-employee))]">৳{fmt(dailyData.net_today)}</p>
              <p className="text-xs text-muted-foreground mt-2">{new Date().toLocaleDateString("bn-BD", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Wallet className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">দৈনিক বেসিক (÷২৭)</p>
                  <p className="text-2xl font-heading">৳{fmt(dailyData.basic_per_day)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">আজকের কর্তন</p>
                  <p className="text-2xl font-heading text-destructive">
                    {n(dailyData.today_deductions) > 0 ? `-৳${fmt(dailyData.today_deductions)}` : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
            {isIncentiveRole && (
              <Card>
                <CardContent className="pt-6 flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">আজকের অর্ডার</p>
                    <p className="text-2xl font-heading text-green-500">{n(dailyData.today_orders)}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* ════════ MONTHLY VIEW ════════ */}
      {filter === "monthly" && (
        <>
          <Card className="border-[hsl(var(--panel-employee)/0.3)]">
            <CardContent className="pt-8 pb-8 text-center">
              <p className="text-sm text-muted-foreground mb-2">মোট নিট বেতন</p>
              <p className="text-5xl font-heading text-[hsl(var(--panel-employee))]">৳{fmt(salary.net_salary)}</p>
              <p className="text-xs text-muted-foreground mt-2">{salary.name} — {MONTHS_BN[salary.month]} {salary.year}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Wallet className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">বেসিক বেতন</p>
                  <p className="text-2xl font-heading">৳{fmt(salary.basic_salary)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">{isIncentiveRole ? "ইনসেনটিভ" : "প্রফিট শেয়ার"}</p>
                  <p className="text-2xl font-heading text-green-500">
                    {n(salary.incentive) > 0 ? `+৳${fmt(salary.incentive)}` : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">মোট কর্তন</p>
                  <p className="text-2xl font-heading text-destructive">
                    {n(salary.total_deductions) > 0 ? `-৳${fmt(salary.total_deductions)}` : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
            {isIncentiveRole && (
              <Card>
                <CardContent className="pt-6 flex items-center gap-3">
                  <TrendingUp className={cn("h-8 w-8", ratio >= 50 ? "text-green-500" : "text-orange-400")} />
                  <div>
                    <p className="text-xs text-muted-foreground">রিসিভ রেশিও</p>
                    <p className="text-2xl font-heading">{ratio}%</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Receive Ratio Warning */}
          {isIncentiveRole && (
            <div className="space-y-4">
              {isTelesalesRole && ratio < 60 ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="font-heading font-bold text-destructive">⚠ রিসিভ রেশিও ৬০% এর নিচে!</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        আপনার বর্তমান রিসিভ রেশিও <strong className="text-destructive">{ratio}%</strong>। মাস শেষে রিসিভ রেশিও ৬০% এর নিচে থাকলে বেতন <strong className="text-destructive">০ (শূন্য)</strong> হয়ে যাবে।
                      </p>
                    </div>
                  </div>
                </div>
              ) : !isTelesalesRole && ratio < 60 ? (
                <div className="rounded-md border border-orange-300/50 bg-orange-50 dark:bg-orange-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-heading font-bold text-orange-600 dark:text-orange-400">রিসিভ রেশিও কম</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        আপনার গ্রুপ লিডারদের গড় রিসিভ রেশিও <strong className="text-orange-600 dark:text-orange-400">{ratio}%</strong>। গ্রুপ লিডারদের রিসিভ রেশিও উন্নতি করলে আপনার ইনসেনটিভ বাড়বে।
                      </p>
                    </div>
                  </div>
                </div>
              ) : ratio < 80 ? (
                <div className="rounded-md border border-orange-300/50 bg-orange-50 dark:bg-orange-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-heading font-bold text-orange-600 dark:text-orange-400">রিসিভ রেশিও মোটামুটি</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        আপনার বর্তমান রিসিভ রেশিও <strong className="text-orange-600 dark:text-orange-400">{ratio}%</strong>। আরও উন্নতি করলে ইনসেনটিভ বাড়বে।
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-green-300/50 bg-green-50 dark:bg-green-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-heading font-bold text-green-700 dark:text-green-400">রিসিভ রেশিও চমৎকার! 🎉</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        আপনার বর্তমান রিসিভ রেশিও <strong className="text-green-600 dark:text-green-400">{ratio}%</strong>। দারুণ পারফরম্যান্স!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-heading text-sm font-bold">রিসিভ রেশিও অগ্রগতি</p>
                    <Badge variant={ratio >= 60 ? "default" : "destructive"}>
                      {ratio}% / ৬০% মিনিমাম
                    </Badge>
                  </div>
                  <Progress
                    value={Math.min(ratio, 100)}
                    className={cn(
                      "h-3",
                      ratio < 60 && "[&>div]:bg-destructive",
                      ratio >= 60 && ratio < 80 && "[&>div]:bg-orange-500",
                      ratio >= 80 && "[&>div]:bg-green-500"
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Detail Table */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-heading">বিস্তারিত ভাঙ্গন</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">বেসিক বেতন</span>
                  <span className="font-medium">৳{fmt(salary.basic_salary)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">{isIncentiveRole ? "ইনসেনটিভ" : "প্রফিট শেয়ার"}</span>
                  <span className="font-medium text-green-500">+৳{fmt(salary.incentive)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">দেরি/আগে চলে যাওয়া কর্তন</span>
                  <span className="font-medium text-destructive">-৳{fmt(salary.attendance_deductions)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">আনপেইড ছুটি কর্তন</span>
                  <span className="font-medium text-destructive">-৳{fmt(salary.unpaid_deductions)}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-border font-bold text-lg">
                  <span>নিট বেতন</span>
                  <span className="text-[hsl(var(--panel-employee))]">৳{fmt(salary.net_salary)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ════════ YEARLY VIEW ════════ */}
      {filter === "yearly" && (
        <>
          {yearlyTotals && (
            <Card className="border-[hsl(var(--panel-employee)/0.3)]">
              <CardContent className="pt-8 pb-8 text-center">
                <p className="text-sm text-muted-foreground mb-2">বাৎসরিক মোট নিট বেতন — {selectedYear}</p>
                <p className="text-5xl font-heading text-[hsl(var(--panel-employee))]">৳{fmt(yearlyTotals.net)}</p>
              </CardContent>
            </Card>
          )}

          {yearlyTotals && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-xs text-muted-foreground">মোট বেসিক</p>
                  <p className="text-2xl font-heading">৳{fmt(yearlyTotals.basic)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-xs text-muted-foreground">মোট ইনসেনটিভ/শেয়ার</p>
                  <p className="text-2xl font-heading text-green-500">+৳{fmt(yearlyTotals.incentive)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-xs text-muted-foreground">মোট কর্তন</p>
                  <p className="text-2xl font-heading text-destructive">-৳{fmt(yearlyTotals.deductions)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Monthly Breakdown Table */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-heading">মাসভিত্তিক ভাঙ্গন — {selectedYear}</CardTitle></CardHeader>
            <CardContent>
              {yearlySalaries.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">লোড হচ্ছে...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 font-medium">মাস</th>
                        <th className="text-right py-2 font-medium">বেসিক</th>
                        <th className="text-right py-2 font-medium">ইনসেনটিভ</th>
                        <th className="text-right py-2 font-medium">কর্তন</th>
                        <th className="text-right py-2 font-medium">নিট</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearlySalaries.map((s) => (
                        <tr key={s.month} className="border-b border-border/50">
                          <td className="py-2">{MONTHS_BN[s.month]}</td>
                          <td className="text-right py-2">৳{fmt(s.basic_salary)}</td>
                          <td className="text-right py-2 text-green-500">+৳{fmt(s.incentive)}</td>
                          <td className="text-right py-2 text-destructive">-৳{fmt(s.total_deductions)}</td>
                          <td className="text-right py-2 font-bold">৳{fmt(s.net_salary)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
