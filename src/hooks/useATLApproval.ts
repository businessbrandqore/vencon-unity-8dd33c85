import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCallback, useEffect, useState } from "react";

/**
 * Hook for ATL approval workflow.
 * ATL users must get TL approval before performing any write operation.
 * Returns helpers to check if user is ATL and to submit approval requests.
 */
export function useATLApproval() {
  const { user } = useAuth();
  const isATL = user?.role === "Assistant Team Leader";
  const [tlId, setTlId] = useState<string | null>(null);
  const [tlName, setTlName] = useState<string | null>(null);

  // Find the TL this ATL reports to (from campaign_agent_roles)
  useEffect(() => {
    if (!isATL || !user) return;
    const fetchTL = async () => {
      const { data } = await supabase
        .from("campaign_agent_roles")
        .select("tl_id, users!campaign_agent_roles_tl_id_fkey(id, name)")
        .eq("agent_id", user.id)
        .limit(1)
        .single();
      if (data) {
        setTlId(data.tl_id);
        const tlUser = data.users as any;
        if (tlUser) setTlName(tlUser.name);
      }
    };
    fetchTL();
  }, [isATL, user]);

  /**
   * Submit an approval request. Returns true if submitted, false if failed.
   * For non-ATL users, this should not be called.
   */
  const requestApproval = useCallback(
    async (actionType: string, actionData: Record<string, any>, description?: string) => {
      if (!isATL || !user || !tlId) {
        toast.error("TL খুঁজে পাওয়া যায়নি। অনুগ্রহ করে আপনার ক্যাম্পেইন অ্যাসাইনমেন্ট চেক করুন।");
        return false;
      }

      const { error } = await supabase.from("atl_approvals" as any).insert({
        atl_id: user.id,
        tl_id: tlId,
        action_type: actionType,
        action_data: { ...actionData, description: description || actionType },
        status: "pending",
      } as any);

      if (error) {
        console.error("ATL approval request error:", error);
        toast.error("এপ্রোভাল রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে");
        return false;
      }

      // Notify TL
      await supabase.rpc("notify_user", {
        _user_id: tlId,
        _title: "ATL এপ্রোভাল রিকোয়েস্ট",
        _message: `${user.name} একটি অপারেশনের জন্য এপ্রোভাল চেয়েছে: ${description || actionType}`,
        _type: "approval",
      });

      toast.success(`এপ্রোভাল রিকোয়েস্ট ${tlName || "TL"} এর কাছে পাঠানো হয়েছে`);
      return true;
    },
    [isATL, user, tlId, tlName]
  );

  /**
   * Wraps an operation: if ATL, submits for approval. If TL/BDO, executes directly.
   * @param actionType - Type of action (e.g., 'lead_assign')
   * @param actionData - Data describing the action
   * @param description - Human-readable description
   * @param directAction - The function to execute directly (for non-ATL)
   */
  const executeOrRequestApproval = useCallback(
    async (
      actionType: string,
      actionData: Record<string, any>,
      description: string,
      directAction: () => Promise<void>
    ) => {
      if (isATL) {
        return requestApproval(actionType, actionData, description);
      } else {
        await directAction();
        return true;
      }
    },
    [isATL, requestApproval]
  );

  return {
    isATL,
    tlId,
    tlName,
    requestApproval,
    executeOrRequestApproval,
  };
}
