import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BLUE = "#1D4ED8";

interface TierRow {
  min_ratio: number;
  max_ratio: number;
  amount_per_order: number;
}

interface IncentiveConfig {
  id: string;
  role: string;
  min_ratio: number | null;
  max_ratio: number | null;
  amount_per_order: number | null;
  minimum_threshold: number | null;
  status: string | null;
}

interface ProfitShareRow {
  id: string;
  role: string;
  percentage: number;
  status: string | null;
}

interface EmployeeSalary {
  id: string;
  name: string;
  role: string;
  basic_salary: number;
  incentive: number;
  deductions: number;
  net: number;
}

const INCENTIVE_ROLES = [
  "Telesales Executive",
  "Group Leader",
  "Team Leader",
  "Assistant Team Leader",
];

const HRPayroll = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const isBn = t("vencon") === "VENCON";

  // Incentive state
  const [incentives, setIncentives] = useState<IncentiveConfig[]>([]);
  const [showTierEdit, setShowTierEdit] = useState(false);
  const [editRole, setEditRole] = useState("");
  const [editThreshold, setEditThreshold] = useState("50");
  const [editTiers, setEditTiers] = useState<TierRow[]>([
    { min_ratio: 60, max_ratio: 65, amount_per_order: 5 },
  ]);

  // Profit share state
  const [profitShares, setProfitShares] = useState<ProfitShareRow[]>([]);
  const [editingPS, setEditingPS] = useState(false);
  const [psEdits, setPsEdits] = useState<Record<string, number>>({});

  // Salary preview
  const [salaries, setSalaries] = useState<EmployeeSalary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loadingSalary, setLoadingSalary] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchIncentives();
    fetchProfitShares();
  }, []);

  useEffect(() => {
    fetchSalaryPreview();
  }, [selectedMonth]);

  const fetchIncentives = async () => {
    const { data } = await supabase
      .from("incentive_config")
      .select("*")
      .order("role")
      .order("min_ratio");
    setIncentives((data as IncentiveConfig[]) || []);
  };

  const fetchProfitShares = async () => {
    const { data } = await supabase
      .from("profit_share_config")
      .select("*")
      .order("role");
    const rows = (data as ProfitShareRow[]) || [];
    setProfitShares(rows);
    const edits: Record<string, number> = {};
    rows.forEach((r) => {
      edits[r.role] = r.percentage;
    });
    setPsEdits(edits);
  };

  const fetchSalaryPreview = async () => {
    setLoadingSalary(true);
    const [year, month] = selectedMonth.split("-").map(Number);
    const monthStart = new Date(year, month - 1, 1).toISOString();
    const monthEnd = new Date(year, month, 0, 23, 59, 59).toISOString();

    // Get all active employees
    const { data: employees } = await supabase
      .from("users")
      .select("id, name, role, basic_salary")
      .eq("is_active", true)
      .not("panel", "eq", "sa");

    if (!employees) {
      setLoadingSalary(false);
      return;
    }

    // Get deductions for the month
    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("user_id, deduction_amount")
      .gte("date", `${selectedMonth}-01`)
      .lte("date", `${selectedMonth}-31`);

    const deductionMap: Record<string, number> = {};
    (attendanceData || []).forEach((a) => {
      if (a.user_id && a.deduction_amount) {
        deductionMap[a.user_id] = (deductionMap[a.user_id] || 0) + Number(a.deduction_amount);
      }
    });

    // Get orders for incentive calculation
    const { data: orders } = await supabase
      .from("orders")
      .select("agent_id, delivery_status")
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd);

    const deliveredByAgent: Record<string, number> = {};
    const totalByAgent: Record<string, number> = {};
    (orders || []).forEach((o) => {
      if (o.agent_id) {
        totalByAgent[o.agent_id] = (totalByAgent[o.agent_id] || 0) + 1;
        if (o.delivery_status === "delivered") {
          deliveredByAgent[o.agent_id] = (deliveredByAgent[o.agent_id] || 0) + 1;
        }
      }
    });

    // Calculate
    const result: EmployeeSalary[] = employees.map((emp) => {
      const basic = Number(emp.basic_salary) || 0;
      const deductions = deductionMap[emp.id] || 0;
      let incentive = 0;

      if (INCENTIVE_ROLES.includes(emp.role)) {
        const delivered = deliveredByAgent[emp.id] || 0;
        const total = totalByAgent[emp.id] || 0;
        const ratio = total > 0 ? (delivered / total) * 100 : 0;

        const matchingTiers = incentives.filter(
          (ic) =>
            ic.role === emp.role &&
            ic.status === "approved" &&
            ratio >= (ic.min_ratio || 0) &&
            ratio <= (ic.max_ratio || 100)
        );

        if (matchingTiers.length > 0) {
          incentive = delivered * (Number(matchingTiers[0].amount_per_order) || 0);
        }
      }

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        basic_salary: basic,
        incentive,
        deductions,
        net: basic + incentive - deductions,
      };
    });

    setSalaries(result.sort((a, b) => b.net - a.net));
    setLoadingSalary(false);
  };

  // Tier editing
  const openTierEdit = (role: string) => {
    setEditRole(role);
    const roleTiers = incentives.filter((i) => i.role === role);
    if (roleTiers.length > 0) {
      setEditThreshold(String(roleTiers[0].minimum_threshold || 50));
      setEditTiers(
        roleTiers.map((i) => ({
          min_ratio: i.min_ratio || 0,
          max_ratio: i.max_ratio || 0,
          amount_per_order: Number(i.amount_per_order) || 0,
        }))
      );
    } else {
      setEditThreshold("50");
      setEditTiers([{ min_ratio: 60, max_ratio: 65, amount_per_order: 5 }]);
    }
    setShowTierEdit(true);
  };

  const addTierRow = () => {
    const last = editTiers[editTiers.length - 1];
    setEditTiers([
      ...editTiers,
      {
        min_ratio: (last?.max_ratio || 0) + 1,
        max_ratio: (last?.max_ratio || 0) + 5,
        amount_per_order: (last?.amount_per_order || 0) + 5,
      },
    ]);
  };

  const removeTierRow = (idx: number) => {
    setEditTiers(editTiers.filter((_, i) => i !== idx));
  };

  const updateTier = (idx: number, field: keyof TierRow, value: number) => {
    setEditTiers(
      editTiers.map((tier, i) => (i === idx ? { ...tier, [field]: value } : tier))
    );
  };

  const submitTiersForApproval = async () => {
    if (!user) return;
    setSubmitting(true);

    // Delete old draft/pending tiers for this role
    const oldIds = incentives
      .filter((i) => i.role === editRole && i.status !== "approved")
      .map((i) => i.id);
    if (oldIds.length > 0) {
      await supabase.from("incentive_config").delete().in("id", oldIds);
    }

    // Insert new tiers
    const rows = editTiers.map((tier) => ({
      role: editRole,
      min_ratio: tier.min_ratio,
      max_ratio: tier.max_ratio,
      amount_per_order: tier.amount_per_order,
      minimum_threshold: Number(editThreshold),
      status: "pending_sa",
      created_by: user.id,
    }));

    await supabase.from("incentive_config").insert(rows);

    // SA approval
    await supabase.from("sa_approvals").insert({
      type: "incentive_config",
      requested_by: user.id,
      status: "pending",
      details: {
        role: editRole,
        threshold: Number(editThreshold),
        tiers: editTiers,
      } as any,
    });

    // Notify SA
    const { data: saUsers } = await supabase
      .from("users")
      .select("id")
      .eq("panel", "sa")
      .eq("is_active", true);
    if (saUsers) {
      await supabase.from("notifications").insert(
        saUsers.map((sa) => ({
          user_id: sa.id,
          title: isBn
            ? `Incentive config approval দরকার: ${editRole}`
            : `Incentive config needs approval: ${editRole}`,
          type: "approval",
        }))
      );
    }

    toast({
      title: isBn
        ? "SA approval-এর জন্য submit হয়েছে ✓"
        : "Submitted for SA approval ✓",
    });
    setShowTierEdit(false);
    setSubmitting(false);
    fetchIncentives();
  };

  // Profit share
  const psTotal = Object.values(psEdits).reduce((sum, v) => sum + v, 0);

  const submitPSForApproval = async () => {
    if (!user) return;
    setSubmitting(true);

    // Upsert profit share rows
    for (const [role, pct] of Object.entries(psEdits)) {
      const existing = profitShares.find((p) => p.role === role);
      if (existing) {
        await supabase
          .from("profit_share_config")
          .update({ percentage: pct, status: "pending_sa", created_by: user.id })
          .eq("id", existing.id);
      } else {
        await supabase.from("profit_share_config").insert({
          role,
          percentage: pct,
          status: "pending_sa",
          created_by: user.id,
        });
      }
    }

    await supabase.from("sa_approvals").insert({
      type: "profit_share_config",
      requested_by: user.id,
      status: "pending",
      details: { shares: psEdits },
    });

    const { data: saUsers } = await supabase
      .from("users")
      .select("id")
      .eq("panel", "sa")
      .eq("is_active", true);
    if (saUsers) {
      await supabase.from("notifications").insert(
        saUsers.map((sa) => ({
          user_id: sa.id,
          title: isBn
            ? "Profit share config approval দরকার"
            : "Profit share config needs approval",
          type: "approval",
        }))
      );
    }

    toast({
      title: isBn ? "SA approval-এর জন্য submit হয়েছে ✓" : "Submitted for SA approval ✓",
    });
    setSubmitting(false);
    setEditingPS(false);
    fetchProfitShares();
  };

  const statusBadge = (status: string | null) => {
    const map: Record<string, { label: string; color: string }> = {
      approved: { label: isBn ? "সক্রিয়" : "Active", color: "#22C55E" },
      pending_sa: { label: isBn ? "SA পেন্ডিং" : "Pending SA", color: "#F59E0B" },
      draft: { label: isBn ? "ড্রাফট" : "Draft", color: "#6B7280" },
    };
    const s = map[status || "draft"] || map.draft;
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 text-white" style={{ backgroundColor: s.color }}>
        {s.label}
      </span>
    );
  };

  // Group incentives by role
  const incentivesByRole: Record<string, IncentiveConfig[]> = {};
  incentives.forEach((i) => {
    if (!incentivesByRole[i.role]) incentivesByRole[i.role] = [];
    incentivesByRole[i.role].push(i);
  });

  const FIXED_ROLES = [
    "Delivery Coordinator",
    "Office Assistant",
    "Creative And Human Resource Manager",
    "Business Development And Marketing Manager",
    "Inventory Manager",
    "Customer Support Executive",
    "Customer Security Officer",
    "Warehouse Supervisor",
    "Warehouse Assistant",
    "Maintenance Officer",
  ];

  return (
    <div className="space-y-8">
      <h2 className="font-heading text-2xl font-bold text-foreground">
        {isBn ? "পে-রোল ও ইনসেন্টিভ" : "Payroll & Incentives"}
      </h2>

      {/* INCENTIVE TIERS */}
      <div className="space-y-4">
        <h3 className="font-heading text-lg font-bold text-foreground">
          {isBn ? "ইনসেন্টিভ টায়ার্স" : "Incentive Tiers"}
        </h3>

        {INCENTIVE_ROLES.map((role) => {
          const tiers = incentivesByRole[role] || [];
          return (
            <div key={role} className="border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-body text-sm font-bold text-foreground">{role}</span>
                  {tiers.length > 0 && statusBadge(tiers[0].status)}
                </div>
                <button
                  onClick={() => openTierEdit(role)}
                  className="text-xs px-3 py-1 font-body font-bold text-white"
                  style={{ backgroundColor: BLUE }}
                >
                  {isBn ? "Tiers সম্পাদনা করুন" : "Edit Tiers"}
                </button>
              </div>
              {tiers.length > 0 ? (
                <div className="text-xs font-body text-muted-foreground space-y-0.5">
                  <p>
                    {isBn ? "সর্বনিম্ন থ্রেশহোল্ড" : "Min Threshold"}: {tiers[0].minimum_threshold}%
                  </p>
                  {tiers.map((tier, i) => (
                    <p key={i} className="text-foreground">
                      {tier.min_ratio}% → {tier.max_ratio}% = ৳{tier.amount_per_order}{" "}
                      {isBn ? "প্রতি ডেলিভারি" : "per delivery"}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {isBn ? "কোনো টায়ার কনফিগার করা হয়নি" : "No tiers configured"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* PROFIT SHARE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-foreground">
            {isBn ? "প্রফিট শেয়ার কনফিগ" : "Profit Share Config"}
          </h3>
          <button
            onClick={() => setEditingPS(!editingPS)}
            className="text-xs px-3 py-1 font-body font-bold text-white"
            style={{ backgroundColor: BLUE }}
          >
            {editingPS
              ? isBn ? "বাতিল" : "Cancel"
              : isBn ? "সম্পাদনা করুন" : "Edit"}
          </button>
        </div>

        <div className="border border-border">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="bg-secondary text-muted-foreground text-[11px]">
                <th className="text-left p-3">{isBn ? "রোল" : "Role"}</th>
                <th className="text-right p-3">{isBn ? "পুলের %" : "% of Pool"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {FIXED_ROLES.map((role) => (
                <tr key={role}>
                  <td className="p-3 text-foreground">{role}</td>
                  <td className="p-3 text-right">
                    {editingPS ? (
                      <Input
                        type="number"
                        value={psEdits[role] || 0}
                        onChange={(e) =>
                          setPsEdits({ ...psEdits, [role]: Number(e.target.value) })
                        }
                        className="w-20 text-right bg-background border-border text-foreground inline-block"
                        min={0}
                        max={100}
                      />
                    ) : (
                      <span className="text-foreground font-bold">
                        {psEdits[role] || 0}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-secondary">
                <td className="p-3 font-bold text-foreground">{isBn ? "মোট" : "Total"}</td>
                <td className={`p-3 text-right font-bold ${psTotal === 100 ? "text-green-500" : "text-destructive"}`}>
                  {psTotal}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {psTotal !== 100 && editingPS && (
          <p className="text-xs text-destructive font-body">
            {isBn ? "⚠ মোট ১০০% হতে হবে" : "⚠ Total must equal 100%"}
          </p>
        )}

        {editingPS && (
          <button
            onClick={submitPSForApproval}
            disabled={psTotal !== 100 || submitting}
            className="px-4 py-2 text-sm font-body font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: BLUE }}
          >
            {isBn ? "SA Approval-এর জন্য Submit করুন" : "Submit for SA Approval"}
          </button>
        )}
      </div>

      {/* SALARY PREVIEW */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-foreground">
            {isBn ? "বেতন প্রিভিউ" : "Salary Preview"}
          </h3>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-48 bg-background border-border text-foreground"
          />
        </div>

        {loadingSalary ? (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-secondary animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="border border-border overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-[11px]">
                  <th className="text-left p-3">{isBn ? "নাম" : "Name"}</th>
                  <th className="text-left p-3">{isBn ? "রোল" : "Role"}</th>
                  <th className="text-right p-3">{isBn ? "বেসিক" : "Basic"}</th>
                  <th className="text-right p-3">{isBn ? "ইনসেন্টিভ" : "Incentive"}</th>
                  <th className="text-right p-3">{isBn ? "কর্তন" : "Deductions"}</th>
                  <th className="text-right p-3">{isBn ? "নেট বেতন" : "Net Salary"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {salaries.map((s) => (
                  <tr key={s.id} className="hover:bg-secondary/50">
                    <td className="p-3 text-foreground font-bold">{s.name}</td>
                    <td className="p-3 text-foreground text-xs">{s.role}</td>
                    <td className="p-3 text-right text-foreground">৳{s.basic_salary.toLocaleString()}</td>
                    <td className="p-3 text-right text-green-500">
                      {s.incentive > 0 ? `+৳${s.incentive.toLocaleString()}` : "—"}
                    </td>
                    <td className="p-3 text-right text-destructive">
                      {s.deductions > 0 ? `-৳${s.deductions.toLocaleString()}` : "—"}
                    </td>
                    <td className="p-3 text-right font-bold" style={{ color: BLUE }}>
                      ৳{s.net.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {salaries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      {isBn ? "কোনো ডেটা নেই" : "No data"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tier Edit Dialog */}
      <Dialog open={showTierEdit} onOpenChange={setShowTierEdit}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-foreground">
              {isBn ? `${editRole} — টায়ার সম্পাদনা` : `${editRole} — Edit Tiers`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">
                {isBn ? "সর্বনিম্ন রিসিভ রেশিও থ্রেশহোল্ড %" : "Min Receive Ratio Threshold %"}
              </label>
              <Input
                type="number"
                value={editThreshold}
                onChange={(e) => setEditThreshold(e.target.value)}
                className="bg-background border-border text-foreground w-32"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {isBn ? "এর নিচে = শূন্য ইনসেন্টিভ" : "Below this = zero incentive"}
              </p>
            </div>

            <div className="space-y-2">
              {editTiers.map((tier, i) => (
                <div key={i} className="flex items-center gap-2 text-sm font-body">
                  <Input
                    type="number"
                    value={tier.min_ratio}
                    onChange={(e) => updateTier(i, "min_ratio", Number(e.target.value))}
                    className="w-16 bg-background border-border text-foreground text-center"
                  />
                  <span className="text-muted-foreground">{isBn ? "থেকে" : "to"}</span>
                  <Input
                    type="number"
                    value={tier.max_ratio}
                    onChange={(e) => updateTier(i, "max_ratio", Number(e.target.value))}
                    className="w-16 bg-background border-border text-foreground text-center"
                  />
                  <span className="text-muted-foreground">= ৳</span>
                  <Input
                    type="number"
                    value={tier.amount_per_order}
                    onChange={(e) =>
                      updateTier(i, "amount_per_order", Number(e.target.value))
                    }
                    className="w-20 bg-background border-border text-foreground text-center"
                  />
                  {editTiers.length > 1 && (
                    <button
                      onClick={() => removeTierRow(i)}
                      className="text-destructive text-xs hover:underline"
                    >
                      ✗
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addTierRow}
                className="text-xs font-body hover:underline"
                style={{ color: BLUE }}
              >
                + {isBn ? "আরেকটি টায়ার যোগ করুন" : "Add Row"}
              </button>
            </div>

            <button
              onClick={submitTiersForApproval}
              disabled={submitting || editTiers.length === 0}
              className="w-full py-2 text-sm font-body font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: BLUE }}
            >
              {submitting
                ? isBn ? "সাবমিট হচ্ছে..." : "Submitting..."
                : isBn ? "SA Approval-এর জন্য Submit করুন" : "Submit for SA Approval"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRPayroll;
