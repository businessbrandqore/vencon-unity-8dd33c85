import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

  // Realtime: re-fetch on order/attendance changes
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

  const fmt = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;

  return (
    <div className="border border-border bg-card p-5">
      <h3 className="font-heading text-sm font-bold text-foreground mb-4">
        এই মাসের বেতন (চলতি)
      </h3>
      <div className="space-y-2 font-body text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">মূল বেতন</span>
          <span className="text-foreground">{fmt(salary.basic_salary)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            {salary.receive_ratio > 0 ? "ইনসেন্টিভ" : "প্রফিট শেয়ার"}
          </span>
          <span className="text-green-500">
            {salary.incentive > 0 ? `+${fmt(salary.incentive)}` : "—"}
          </span>
        </div>
        {salary.receive_ratio > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">রিসিভ রেশিও</span>
            <span className="text-foreground">{salary.receive_ratio}%</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">কর্তন (বিলম্ব + ছুটি)</span>
          <span className="text-destructive">
            {salary.total_deductions > 0 ? `-${fmt(salary.total_deductions)}` : "—"}
          </span>
        </div>
        <div className="h-px bg-border my-1" />
        <div className="flex justify-between font-bold">
          <span className="text-foreground">নিট বেতন</span>
          <span className="text-primary">{fmt(salary.net_salary)}</span>
        </div>
      </div>
    </div>
  );
}
