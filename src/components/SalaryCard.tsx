import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface SalaryData {
  basic_salary: number;
  incentive: number;
  attendance_deductions: number;
  unpaid_deductions: number;
  total_deductions: number;
  net_salary: number;
  receive_ratio: number;
}

export default function SalaryCard() {
  const { user } = useAuth();
  const { t, n, lang } = useLanguage();
  const [salary, setSalary] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSalary = async () => {
    if (!user) return;
    const now = new Date();
    const { data, error } = await supabase.rpc("calculate_salary", {
      _user_id: user.id,
      _year: now.getFullYear(),
      _month: now.getMonth() + 1,
    });
    if (!error && data) {
      setSalary(data as unknown as SalaryData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSalary();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("salary-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `agent_id=eq.${user.id}` }, fetchSalary)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance", filter: `user_id=eq.${user.id}` }, fetchSalary)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) {
    return (
      <div className="border border-border bg-card p-5 animate-pulse">
        <div className="h-4 bg-secondary w-40 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-3 bg-secondary w-full" />)}
        </div>
      </div>
    );
  }

  if (!salary) return null;

  const fmt = (num: number) => `৳${n(num)}`;

  return (
    <div className="border border-border bg-card p-5">
      <h3 className="font-heading text-sm font-bold text-foreground mb-4">
        {t("this_month_salary")}
      </h3>
      <div className="space-y-2 font-body text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("basic_salary")}</span>
          <span className="text-foreground">{fmt(salary.basic_salary)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            {salary.receive_ratio > 0 ? t("incentive") : t("profit_share")}
          </span>
          <span className="text-green-500">
            {salary.incentive > 0 ? `+${fmt(salary.incentive)}` : "—"}
          </span>
        </div>
        {salary.receive_ratio > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("receive_ratio")}</span>
            <span className="text-foreground">{n(salary.receive_ratio)}%</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("deductions_late_leave")}</span>
          <span className="text-destructive">
            {salary.total_deductions > 0 ? `-${fmt(salary.total_deductions)}` : "—"}
          </span>
        </div>
        <div className="h-px bg-border my-1" />
        <div className="flex justify-between font-bold">
          <span className="text-foreground">{t("net_salary")}</span>
          <span className="text-primary">{fmt(salary.net_salary)}</span>
        </div>
      </div>
    </div>
  );
}
