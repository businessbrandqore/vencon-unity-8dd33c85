import { useAuth } from "@/contexts/AuthContext";
import { useATLApproval } from "@/hooks/useATLApproval";
import { ShieldCheck } from "lucide-react";

/**
 * Banner shown to ATL users reminding them that their operations require TL approval.
 */
export default function ATLApprovalBanner() {
  const { user } = useAuth();
  const { isATL, tlName } = useATLApproval();

  if (!isATL || !user) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 text-sm">
      <ShieldCheck className="h-4 w-4 shrink-0" />
      <span>
        আপনার সব অপারেশন <strong>{tlName || "TL"}</strong> এর এপ্রোভালের পর কার্যকর হবে।
        <a href="/tl/atl-approvals" className="ml-1 underline">রিকোয়েস্ট দেখুন →</a>
      </span>
    </div>
  );
}
