import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

const TEAL = "#0D9488";

interface Approval {
  id: string;
  type: string;
  requested_by: string;
  details: any;
  status: string;
  created_at: string;
  requester_name?: string;
}

const SAApprovalsTable = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON"; // crude lang check

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchApprovals = async () => {
    const { data } = await supabase
      .from("sa_approvals")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      // Fetch requester names
      const requesterIds = [...new Set(data.map((a) => a.requested_by).filter(Boolean))];
      const { data: users } = await supabase
        .from("users")
        .select("id, name")
        .in("id", requesterIds as string[]);

      const nameMap = new Map(users?.map((u) => [u.id, u.name]) || []);
      setApprovals(
        data.map((a) => ({
          ...a,
          requester_name: a.requested_by ? nameMap.get(a.requested_by) || "Unknown" : "Unknown",
        }))
      );
    } else {
      setApprovals([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const typeLabels: Record<string, { bn: string; en: string }> = {
    new_campaign: { bn: "নতুন ক্যাম্পেইন", en: "New Campaign" },
    non_agent_hire: { bn: "নন-এজেন্ট নিয়োগ", en: "Non-Agent Hire" },
    incentive_config: { bn: "ইনসেনটিভ কনফিগ", en: "Incentive Config" },
    profit_share_config: { bn: "প্রফিট শেয়ার কনফিগ", en: "Profit Share Config" },
  };

  const getSummary = (approval: Approval): string => {
    const d = approval.details || {};
    switch (approval.type) {
      case "new_campaign":
        return d.campaign_name || d.name || "—";
      case "non_agent_hire":
        return `${d.employee_name || "—"} / ${d.role || "—"} / ৳${d.basic_salary || "—"}`;
      case "incentive_config":
        return `${d.role || "—"} / ${d.min_ratio || "—"}–${d.max_ratio || "—"}`;
      case "profit_share_config":
        return `${d.role || "—"} / ${d.percentage || "—"}%`;
      default:
        return JSON.stringify(d).slice(0, 60);
    }
  };

  const handleAction = async (approvalId: string, action: "approved" | "rejected", reason?: string) => {
    if (!user) return;
    setProcessing(approvalId);

    // Update approval status
    await supabase
      .from("sa_approvals")
      .update({
        status: action,
        decided_by: user.id,
        rejection_reason: action === "rejected" ? reason || null : null,
      })
      .eq("id", approvalId);

    // Find the approval to get requested_by
    const approval = approvals.find((a) => a.id === approvalId);

    // Send notification to requester
    if (approval?.requested_by) {
      await supabase.from("notifications").insert({
        user_id: approval.requested_by,
        title: action === "approved"
          ? (isBn ? "অনুমোদিত হয়েছে" : "Approved")
          : (isBn ? "প্রত্যাখ্যাত হয়েছে" : "Rejected"),
        message: `${typeLabels[approval.type]?.[isBn ? "bn" : "en"] || approval.type}: ${action === "rejected" && reason ? reason : getSummary(approval)}`,
        type: "approval_result",
      });
    }

    // Log to audit
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      actor_role: user.role,
      action: `approval_${action}`,
      target_table: "sa_approvals",
      target_id: approvalId,
      details: { type: approval?.type, reason: reason || null },
    });

    setProcessing(null);
    setRejectId(null);
    setRejectReason("");
    fetchApprovals();
  };

  const colHeaders = isBn
    ? ["ধরন", "অনুরোধকারী", "সারাংশ", "তারিখ", "অ্যাকশন"]
    : ["Type", "Requested By", "Summary", "Date", "Actions"];

  return (
    <div>
      <h3 className="font-heading text-lg font-bold text-foreground mb-4">
        {isBn ? "পেন্ডিং অনুমোদন" : "Pending Approvals"}
      </h3>

      {loading ? (
        <div className="border border-border p-8 animate-pulse">
          <div className="h-4 bg-secondary w-48 mb-4" />
          <div className="h-4 bg-secondary w-full mb-2" />
          <div className="h-4 bg-secondary w-full" />
        </div>
      ) : approvals.length === 0 ? (
        <div className="border border-border p-8 text-center">
          <p className="font-body text-sm text-muted-foreground">
            {isBn ? "কোনো পেন্ডিং অনুমোদন নেই" : "No pending approvals"}
          </p>
        </div>
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {colHeaders.map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-heading text-xs tracking-wider text-muted-foreground uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-body text-xs" style={{ color: TEAL }}>
                      {typeLabels[a.type]?.[isBn ? "bn" : "en"] || a.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-foreground">
                    {a.requester_name}
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-foreground max-w-[200px] truncate">
                    {getSummary(a)}
                  </td>
                  <td className="px-4 py-3 font-body text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(a.created_at).toLocaleDateString(isBn ? "bn-BD" : "en-US")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        disabled={processing === a.id}
                        onClick={() => handleAction(a.id, "approved")}
                        className="px-3 py-1 text-[11px] font-heading tracking-wider bg-emerald-600 text-background hover:bg-emerald-500 transition-colors disabled:opacity-50"
                      >
                        ✓ {isBn ? "অনুমোদন" : "Approve"}
                      </button>
                      <button
                        disabled={processing === a.id}
                        onClick={() => setRejectId(a.id)}
                        className="px-3 py-1 text-[11px] font-heading tracking-wider bg-destructive text-background hover:bg-red-500 transition-colors disabled:opacity-50"
                      >
                        ✗ {isBn ? "প্রত্যাখ্যান" : "Reject"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md p-6 space-y-4">
            <h4 className="font-heading text-sm font-bold text-foreground">
              {isBn ? "প্রত্যাখ্যানের কারণ (ঐচ্ছিক)" : "Rejection Reason (Optional)"}
            </h4>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full bg-transparent border border-border px-3 py-2 font-body text-sm text-foreground focus:outline-none resize-none"
              style={{ borderColor: rejectReason ? TEAL : undefined }}
              placeholder={isBn ? "কারণ লিখুন..." : "Enter reason..."}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setRejectId(null); setRejectReason(""); }}
                className="px-4 py-2 text-xs font-heading text-muted-foreground hover:text-foreground transition-colors"
              >
                {isBn ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={() => handleAction(rejectId, "rejected", rejectReason)}
                className="px-4 py-2 text-xs font-heading bg-destructive text-background hover:bg-red-500 transition-colors"
              >
                {isBn ? "প্রত্যাখ্যান করুন" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SAApprovalsTable;
