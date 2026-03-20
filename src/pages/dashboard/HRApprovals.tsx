import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";

interface ApprovalRow {
  id: string;
  type: string;
  status: string;
  details: any;
  created_at: string;
  rejection_reason: string | null;
}

const TYPE_LABELS: Record<string, { bn: string; en: string }> = {
  non_agent_hire: { bn: "কর্মী নিয়োগ", en: "Employee Hire" },
  hire: { bn: "কর্মী নিয়োগ", en: "Employee Hire" },
  new_campaign: { bn: "নতুন ক্যাম্পেইন", en: "New Campaign" },
  campaign_delete: { bn: "ক্যাম্পেইন ডিলিট", en: "Campaign Delete" },
  incentive_config: { bn: "ইনসেন্টিভ কনফিগ", en: "Incentive Config" },
  profit_share_config: { bn: "প্রফিট শেয়ার", en: "Profit Share Config" },
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

const HRApprovals = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchApprovals = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sa_approvals")
        .select("id, type, status, details, created_at, rejection_reason")
        .eq("requested_by", user.id)
        .order("created_at", { ascending: false });
      setApprovals((data as ApprovalRow[]) || []);
      setLoading(false);
    };
    fetchApprovals();
  }, [user]);

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold text-foreground">
        {isBn ? "অনুমোদনের অবস্থা" : "Approval Status"}
      </h2>
      <p className="text-sm text-muted-foreground font-body">
        {isBn ? "আপনার জমা দেওয়া সকল অনুমোদনের তালিকা" : "All your submitted approvals"}
      </p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-secondary animate-pulse" />
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-border p-8 text-center font-body">
          {isBn ? "কোনো অনুমোদন জমা দেওয়া হয়নি" : "No approvals submitted"}
        </p>
      ) : (
        <div className="border border-border">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="bg-secondary text-muted-foreground text-[11px]">
                <th className="text-left p-3">{isBn ? "ধরন" : "Type"}</th>
                <th className="text-left p-3">{isBn ? "বিবরণ" : "Details"}</th>
                <th className="text-left p-3">{isBn ? "তারিখ" : "Date"}</th>
                <th className="text-left p-3">{isBn ? "অবস্থা" : "Status"}</th>
                <th className="text-left p-3">{isBn ? "কারণ" : "Reason"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {approvals.map((a) => {
                const typeLabel = TYPE_LABELS[a.type] || { bn: a.type, en: a.type };
                const detail = a.details;
                const summary = detail?.name
                  ? `${detail.name}${detail.role ? ` — ${detail.role}` : ""}`
                  : detail?.campaign_name || JSON.stringify(detail).slice(0, 50);
                return (
                  <tr key={a.id}>
                    <td className="p-3 text-foreground font-bold">
                      {isBn ? typeLabel.bn : typeLabel.en}
                    </td>
                    <td className="p-3 text-foreground text-xs max-w-xs truncate">
                      {summary}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={STATUS_COLORS[a.status] || ""}>
                        {a.status === "pending"
                          ? isBn ? "অপেক্ষমাণ" : "Pending"
                          : a.status === "approved"
                          ? isBn ? "অনুমোদিত" : "Approved"
                          : isBn ? "প্রত্যাখ্যাত" : "Rejected"}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {a.rejection_reason || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HRApprovals;
