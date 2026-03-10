import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

const SASettings = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [confirmText, setConfirmText] = useState("");
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);

  const canProceed = confirmText === "FACTORY RESET";

  const handleFirstConfirm = () => {
    if (!canProceed) return;
    setShowFinalModal(true);
  };

  const handleFactoryReset = async () => {
    if (!user) return;
    setResetting(true);

    // Delete in dependency order — preserve SA/HR users, audit_logs
    // 1. Delete chat messages & conversations
    await supabase.from("chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("chat_conversations").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 2. Delete notifications
    await supabase.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 3. Delete pre_orders
    await supabase.from("pre_orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 4. Delete orders
    await supabase.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 5. Delete leads
    await supabase.from("leads").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 6. Delete campaigns
    await supabase.from("campaigns").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 7. Delete attendance appeals, leave requests, attendance
    await supabase.from("attendance_appeals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("leave_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("attendance").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 8. Delete sa_approvals, incentive_config, profit_share_config
    await supabase.from("sa_approvals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("incentive_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("profit_share_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 9. Delete maintenance data
    await supabase.from("maintenance_expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("maintenance_budget").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 10. Delete inventory
    await supabase.from("inventory").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 11. Delete group_members
    await supabase.from("group_members").delete().neq("group_leader_id", "00000000-0000-0000-0000-000000000000");

    // 12. Delete user_roles for non SA/HR
    // 13. Delete non-SA/HR users
    const { data: keepUsers } = await supabase
      .from("users")
      .select("id")
      .in("panel", ["sa", "hr"]);
    const keepIds = keepUsers?.map((u) => u.id) || [];

    if (keepIds.length > 0) {
      await supabase.from("user_roles").delete().not("user_id", "in", `(${keepIds.join(",")})`);
      await supabase.from("users").delete().not("id", "in", `(${keepIds.join(",")})`);
    }

    // Log to audit_logs (permanent)
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      actor_role: user.role,
      action: "factory_reset",
      target_table: "system",
      details: { timestamp: new Date().toISOString(), performed_by: user.email },
    });

    setResetting(false);
    setShowFinalModal(false);
    setDone(true);
  };

  const deletedItems = isBn
    ? [
        "সব লিড ও লিড হিস্ট্রি",
        "সব অর্ডার",
        "সব ক্যাম্পেইন",
        "সব কর্মচারী (SA/HR ব্যতীত)",
        "পে-রোল/উপস্থিতি/ছুটির রেকর্ড",
        "অভ্যন্তরীণ চ্যাট হিস্ট্রি",
        "বিজ্ঞপ্তি হিস্ট্রি",
      ]
    : [
        "All Leads & Lead History",
        "All Orders",
        "All Campaigns",
        "All Employees (except SA/HR)",
        "Payroll/Attendance/Leave Records",
        "Internal Chat History",
        "Notification History",
      ];

  const preservedItems = isBn
    ? [
        "SA/HR অ্যাকাউন্ট ও পাসওয়ার্ড",
        "API ক্রেডেনশিয়ালস",
        "UI ব্র্যান্ডিং সেটিংস",
        "অডিট লগ (স্থায়ীভাবে সংরক্ষিত, মুছে ফেলা যায় না)",
      ]
    : [
        "SA/HR Account & Password",
        "API Credentials",
        "UI Branding settings",
        "Audit Logs (permanently retained, cannot be deleted)",
      ];

  return (
    <div className="space-y-8">
      <h2 className="font-heading text-2xl font-bold text-foreground">
        {isBn ? "সেটিংস" : "Settings"}
      </h2>

      {/* Placeholder for other settings */}
      <div className="border border-border p-6">
        <p className="font-body text-sm text-muted-foreground">
          {isBn ? "সাধারণ সেটিংস শীঘ্রই আসছে..." : "General settings coming soon..."}
        </p>
      </div>

      {/* Factory Reset Warning */}
      <div className="border-2 border-destructive p-6 space-y-6">
        <h3 className="font-heading text-lg font-bold text-destructive">
          ⚠️ Factory Reset — {isBn ? "সতর্কতার সাথে ব্যবহার করুন" : "Use with extreme caution"}
        </h3>

        {done ? (
          <div className="p-4 border border-border">
            <p className="font-body text-sm text-foreground" style={{ color: "#0D9488" }}>
              ✓ {isBn ? "ফ্যাক্টরি রিসেট সম্পন্ন। অডিট লগে রেকর্ড করা হয়েছে।" : "Factory reset complete. Recorded in audit logs."}
            </p>
          </div>
        ) : (
          <>
            {/* What will be deleted */}
            <div className="space-y-2">
              <p className="font-heading text-xs tracking-wider text-destructive uppercase">
                ✗ {isBn ? "মুছে ফেলা হবে:" : "WILL BE DELETED:"}
              </p>
              <ul className="space-y-1">
                {deletedItems.map((item) => (
                  <li key={item} className="font-body text-xs text-foreground flex items-start gap-2">
                    <span className="text-destructive mt-0.5">✗</span> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="h-[1px] bg-border" />

            {/* What will be preserved */}
            <div className="space-y-2">
              <p className="font-heading text-xs tracking-wider uppercase" style={{ color: "#0D9488" }}>
                ✓ {isBn ? "সংরক্ষিত থাকবে:" : "WILL BE PRESERVED:"}
              </p>
              <ul className="space-y-1">
                {preservedItems.map((item) => (
                  <li key={item} className="font-body text-xs text-foreground flex items-start gap-2">
                    <span style={{ color: "#0D9488" }} className="mt-0.5">✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="h-[1px] bg-border" />

            {/* Confirmation input */}
            <div className="space-y-2">
              <p className="font-body text-xs text-muted-foreground">
                {isBn
                  ? 'নিশ্চিত করতে নিচে "FACTORY RESET" টাইপ করুন:'
                  : 'Type "FACTORY RESET" below to confirm:'}
              </p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="FACTORY RESET"
                className="w-full max-w-sm bg-transparent border border-destructive px-3 py-2 font-heading text-sm text-foreground focus:outline-none tracking-widest"
              />
            </div>

            <button
              onClick={handleFirstConfirm}
              disabled={!canProceed}
              className="px-6 py-3 text-xs font-heading tracking-wider bg-destructive text-background disabled:opacity-30 transition-opacity"
            >
              {isBn ? "ফ্যাক্টরি রিসেট শুরু করুন" : "Begin Factory Reset"}
            </button>
          </>
        )}
      </div>

      {/* Final confirmation modal */}
      {showFinalModal && (
        <div className="fixed inset-0 bg-background/90 z-50 flex items-center justify-center p-4">
          <div className="bg-card border-2 border-destructive w-full max-w-md p-6 space-y-6">
            <h4 className="font-heading text-sm font-bold text-destructive text-center">
              ⚠️ {isBn ? "চূড়ান্ত নিশ্চিতকরণ" : "Final Confirmation"}
            </h4>
            <p className="font-body text-sm text-foreground text-center">
              {isBn
                ? "আপনি কি সম্পূর্ণ নিশ্চিত? এটি পূর্বাবস্থায় ফেরানো যাবে না।"
                : "Are you absolutely sure? This cannot be undone."}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowFinalModal(false)}
                className="px-6 py-2 text-xs font-heading border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                {isBn ? "না, বাতিল করুন" : "No, Cancel"}
              </button>
              <button
                onClick={handleFactoryReset}
                disabled={resetting}
                className="px-6 py-2 text-xs font-heading tracking-wider bg-destructive text-background disabled:opacity-50"
              >
                {resetting ? "..." : isBn ? "হ্যাঁ, মুছে ফেলুন" : "Yes, Delete Everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SASettings;
