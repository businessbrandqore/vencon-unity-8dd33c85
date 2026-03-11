import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";

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

const MONTHS_BN = ["", "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

export default function EmployeeSalary() {
  const { user } = useAuth();
  const [salary, setSalary] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const now = new Date();
      const { data } = await supabase.rpc("calculate_salary", {
        _user_id: user.id,
        _year: now.getFullYear(),
        _month: now.getMonth() + 1,
      });
      if (data) setSalary(data as unknown as SalaryData);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;
  if (!salary) return <div className="p-6 text-muted-foreground">বেতন তথ্য পাওয়া যায়নি</div>;

  const isIncentiveRole = ["telesales_executive", "assistant_team_leader", "team_leader", "group_leader"].includes(salary.role);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-[hsl(var(--panel-employee))]" /> বেতন বিবরণ — {MONTHS_BN[salary.month]} {salary.year}
      </h1>

      {/* Net Salary Hero */}
      <Card className="border-[hsl(var(--panel-employee)/0.3)]">
        <CardContent className="pt-8 pb-8 text-center">
          <p className="text-sm text-muted-foreground mb-2">মোট নিট বেতন</p>
          <p className="text-5xl font-heading text-[hsl(var(--panel-employee))]">৳{salary.net_salary.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">{salary.name} — {salary.role}</p>
        </CardContent>
      </Card>

      {/* Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">বেসিক বেতন</p>
              <p className="text-2xl font-heading">৳{salary.basic_salary.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">{isIncentiveRole ? "ইনসেনটিভ" : "প্রফিট শেয়ার"}</p>
              <p className="text-2xl font-heading text-green-500">
                {salary.incentive > 0 ? `+৳${salary.incentive.toLocaleString()}` : "—"}
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
                {salary.total_deductions > 0 ? `-৳${salary.total_deductions.toLocaleString()}` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        {isIncentiveRole && (
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <TrendingUp className={cn("h-8 w-8", salary.receive_ratio >= 50 ? "text-green-500" : "text-orange-400")} />
              <div>
                <p className="text-xs text-muted-foreground">রিসিভ রেশিও</p>
                <p className="text-2xl font-heading">{salary.receive_ratio}%</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail Table */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading">বিস্তারিত ভাঙ্গন</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">বেসিক বেতন</span>
              <span className="font-medium">৳{salary.basic_salary.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">{isIncentiveRole ? "ইনসেনটিভ (পারফরম্যান্স ভিত্তিক)" : "প্রফিট শেয়ার"}</span>
              <span className="font-medium text-green-500">+৳{salary.incentive.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">দেরি/আগে চলে যাওয়া কর্তন</span>
              <span className="font-medium text-destructive">-৳{salary.attendance_deductions.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">আনপেইড ছুটি কর্তন</span>
              <span className="font-medium text-destructive">-৳{salary.unpaid_deductions.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-3 border-t-2 border-border font-bold text-lg">
              <span>নিট বেতন</span>
              <span className="text-[hsl(var(--panel-employee))]">৳{salary.net_salary.toLocaleString()}</span>
            </div>
          </div>

          {isIncentiveRole && (
            <div className="mt-6 p-4 rounded-md border border-border bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2">📊 ইনসেনটিভ হিসাব</p>
              <p className="text-sm">
                আপনার রিসিভ রেশিও <strong>{salary.receive_ratio}%</strong>।
                {salary.incentive > 0
                  ? ` প্রতিটি ডেলিভারড অর্ডারের জন্য ইনসেনটিভ গণনা করা হয়েছে।`
                  : ` ন্যূনতম threshold-এর নিচে থাকায় ইনসেনটিভ যোগ হয়নি।`
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
