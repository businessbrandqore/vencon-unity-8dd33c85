import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Building2, Truck, RotateCcw } from "lucide-react";

interface CompanyInfo {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_logo_url: string;
}

interface SteadfastConfig {
  api_key: string;
  secret_key: string;
  base_url: string;
}

const SASettings = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [activeTab, setActiveTab] = useState<"company" | "steadfast" | "sitelock" | "reset">("company");
  const [siteLocked, setSiteLocked] = useState<boolean | null>(null);
  const [lockLoading, setLockLoading] = useState(false);
  const [lockPassword, setLockPassword] = useState("");

  const [company, setCompany] = useState<CompanyInfo>({
    company_name: "VENCON",
    company_address: "",
    company_phone: "",
    company_email: "",
    company_logo_url: "",
  });

  const [steadfast, setSteadfast] = useState<SteadfastConfig>({
    api_key: "",
    secret_key: "",
    base_url: "https://portal.steadfast.com.bd/api/v1",
  });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["company_info", "steadfast_config", "site_locked"]);

      if (data) {
        for (const row of data) {
          const val = row.value as Record<string, unknown> | null;
          if (!val) continue;
          if (row.key === "company_info") setCompany((p) => ({ ...p, ...val }));
          if (row.key === "steadfast_config") setSteadfast((p) => ({ ...p, ...val }));
          if (row.key === "site_locked") setSiteLocked(!!(val as any)?.locked);
        }
      }
      if (siteLocked === null) setSiteLocked(false);
      setLoading(false);
    };
    load();
  }, []);

  const handleSiteLock = async (lockAction: "lock" | "unlock") => {
    if (!lockPassword.trim()) {
      toast.error(isBn ? "BrandQore পাসওয়ার্ড দিন" : "Enter BrandQore password");
      return;
    }
    setLockLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-verification", {
        body: { action: lockAction, password: lockPassword }
      });
      if (error) throw error;
      if (data?.success) {
        setSiteLocked(lockAction === "lock");
        setLockPassword("");
        toast.success(data.message || (lockAction === "lock" ? "সাইট লক হয়েছে" : "সাইট আনলক হয়েছে"));
      } else {
        toast.error(data?.error || "ব্যর্থ হয়েছে");
      }
    } catch {
      toast.error("অপারেশন ব্যর্থ");
    } finally {
      setLockLoading(false);
    }
  };

  const saveSetting = async (key: string, value: Record<string, unknown>) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value: value as any, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) {
      toast.error(isBn ? "সেভ করতে ব্যর্থ" : "Failed to save");
    } else {
      toast.success(isBn ? "সেভ হয়েছে" : "Saved successfully");
    }
    setSaving(false);
  };

  const canProceed = confirmText === "FACTORY RESET";

  const handleFirstConfirm = () => {
    if (!canProceed) return;
    setShowFinalModal(true);
  };

  const handleFactoryReset = async () => {
    if (!user) return;
    setResetting(true);
    await supabase.from("chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("chat_conversations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("pre_orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("leads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("campaign_agent_roles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("campaign_websites").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("campaign_tls").delete().neq("campaign_id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("campaigns").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("attendance_appeals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("leave_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("attendance").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("sa_approvals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("incentive_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("profit_share_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("maintenance_expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("maintenance_budget").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("inventory").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("group_members").delete().neq("group_leader_id", "00000000-0000-0000-0000-000000000000");

    const { data: keepUsers } = await supabase.from("users").select("id").in("panel", ["sa", "hr"]);
    const keepIds = keepUsers?.map((u) => u.id) || [];
    if (keepIds.length > 0) {
      await supabase.from("user_roles").delete().not("user_id", "in", `(${keepIds.join(",")})`);
      await supabase.from("users").delete().not("id", "in", `(${keepIds.join(",")})`);
    }

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

  const tabs = [
    { key: "company" as const, label: isBn ? "কোম্পানি তথ্য" : "Company Info", icon: Building2 },
    { key: "steadfast" as const, label: "Steadfast API", icon: Truck },
    { key: "sitelock" as const, label: isBn ? "সাইট লক" : "Site Lock", icon: ShieldAlert },
    { key: "reset" as const, label: isBn ? "ফ্যাক্টরি রিসেট" : "Factory Reset", icon: RotateCcw },
  ];

  const deletedItems = isBn
    ? ["সব লিড ও লিড হিস্ট্রি", "সব অর্ডার", "সব ক্যাম্পেইন", "সব কর্মচারী (SA/HR ব্যতীত)", "পে-রোল/উপস্থিতি/ছুটির রেকর্ড", "অভ্যন্তরীণ চ্যাট হিস্ট্রি", "বিজ্ঞপ্তি হিস্ট্রি"]
    : ["All Leads & Lead History", "All Orders", "All Campaigns", "All Employees (except SA/HR)", "Payroll/Attendance/Leave Records", "Internal Chat History", "Notification History"];

  const preservedItems = isBn
    ? ["SA/HR অ্যাকাউন্ট ও পাসওয়ার্ড", "API ক্রেডেনশিয়ালস", "UI ব্র্যান্ডিং সেটিংস", "অডিট লগ (স্থায়ীভাবে সংরক্ষিত)"]
    : ["SA/HR Account & Password", "API Credentials", "UI Branding settings", "Audit Logs (permanently retained)"];

  if (loading) return <div className="h-64 animate-pulse bg-card rounded-xl" />;

  const inputClass = "w-full bg-transparent border border-border rounded-lg px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const labelClass = "font-body text-xs text-muted-foreground mb-1 block";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="font-heading text-2xl font-bold text-foreground">
        {isBn ? "সেটিংস" : "Settings"}
      </h2>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-heading tracking-wide border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "company" && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h3 className="font-heading text-sm font-bold text-foreground">
            {isBn ? "কোম্পানি তথ্য" : "Company Information"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{isBn ? "কোম্পানির নাম" : "Company Name"}</label>
              <input className={inputClass} value={company.company_name} onChange={(e) => setCompany({ ...company, company_name: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{isBn ? "ইমেইল" : "Email"}</label>
              <input className={inputClass} value={company.company_email} onChange={(e) => setCompany({ ...company, company_email: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{isBn ? "ফোন" : "Phone"}</label>
              <input className={inputClass} value={company.company_phone} onChange={(e) => setCompany({ ...company, company_phone: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{isBn ? "লোগো URL" : "Logo URL"}</label>
              <input className={inputClass} value={company.company_logo_url} onChange={(e) => setCompany({ ...company, company_logo_url: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{isBn ? "ঠিকানা" : "Address"}</label>
              <textarea className={inputClass + " min-h-[60px]"} value={company.company_address} onChange={(e) => setCompany({ ...company, company_address: e.target.value })} />
            </div>
          </div>
          <button onClick={() => saveSetting("company_info", company as any)} disabled={saving} className="px-5 py-2 text-xs font-heading bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
            {saving ? "..." : isBn ? "সেভ করুন" : "Save"}
          </button>
        </div>
      )}

      {activeTab === "steadfast" && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h3 className="font-heading text-sm font-bold text-foreground">Steadfast API Configuration</h3>
          <p className="font-body text-xs text-muted-foreground">
            {isBn ? "Steadfast Courier এর API তথ্য এখানে সেভ করুন। এটি অর্ডার dispatch-এ ব্যবহৃত হবে।" : "Save your Steadfast Courier API credentials here. Used for order dispatch."}
          </p>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>API Key</label>
              <input className={inputClass} value={steadfast.api_key} onChange={(e) => setSteadfast({ ...steadfast, api_key: e.target.value })} placeholder="Enter API Key" />
            </div>
            <div>
              <label className={labelClass}>Secret Key</label>
              <input type="password" className={inputClass} value={steadfast.secret_key} onChange={(e) => setSteadfast({ ...steadfast, secret_key: e.target.value })} placeholder="Enter Secret Key" />
            </div>
            <div>
              <label className={labelClass}>Base URL</label>
              <input className={inputClass} value={steadfast.base_url} onChange={(e) => setSteadfast({ ...steadfast, base_url: e.target.value })} />
            </div>
          </div>
          <button onClick={() => saveSetting("steadfast_config", steadfast as any)} disabled={saving} className="px-5 py-2 text-xs font-heading bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
            {saving ? "..." : isBn ? "সেভ করুন" : "Save"}
          </button>
        </div>
      )}

      {activeTab === "sitelock" && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${siteLocked ? "bg-destructive/10" : "bg-emerald-500/10"}`}>
              {siteLocked ? <Lock className="w-6 h-6 text-destructive" /> : <Unlock className="w-6 h-6 text-emerald-500" />}
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-foreground">
                {isBn ? "সাইট লক কন্ট্রোল" : "Site Lock Control"}
              </h3>
              <p className="font-body text-xs text-muted-foreground">
                {siteLocked
                  ? (isBn ? "🔴 সাইট বর্তমানে লক আছে — কেউ অ্যাক্সেস করতে পারছে না" : "🔴 Site is currently LOCKED")
                  : (isBn ? "🟢 সাইট বর্তমানে আনলক আছে — সবাই অ্যাক্সেস করতে পারছে" : "🟢 Site is currently UNLOCKED")}
              </p>
            </div>
          </div>

          <div className="rounded-xl p-4 space-y-3 border border-border bg-muted/30">
            <p className="font-heading text-xs font-bold text-foreground">
              {isBn ? "📋 সাইট লক কিভাবে কাজ করে:" : "📋 How Site Lock works:"}
            </p>
            <ul className="space-y-2 font-body text-xs text-muted-foreground">
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>{isBn ? "লক করলে সম্পূর্ণ ওয়েবসাইট BrandQore পাসওয়ার্ড স্ক্রিন দেখাবে" : "Locking shows BrandQore password screen"}</li>
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>{isBn ? "কেউ লগিন, ডাটা দেখা বা কিছু অ্যাক্সেস করতে পারবে না" : "Nobody can login or access anything"}</li>
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>{isBn ? "শুধুমাত্র BrandQore পাসওয়ার্ড দিয়ে আনলক করা যাবে" : "Only BrandQore password can unlock"}</li>
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>{isBn ? "যেকোনো হোস্টিং-এ কাজ করবে — ফ্রি বা পেইড" : "Works on any hosting"}</li>
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>{isBn ? "পেমেন্ট না পেলে বা চুক্তি ভঙ্গ হলে তাৎক্ষণিক লক সম্ভব" : "Instant lock if payment missed"}</li>
            </ul>
          </div>

          <div className="space-y-3">
            <label className={labelClass}>{isBn ? "BrandQore পাসওয়ার্ড দিন:" : "Enter BrandQore password:"}</label>
            <input
              type="password"
              value={lockPassword}
              onChange={(e) => setLockPassword(e.target.value)}
              placeholder={isBn ? "পাসওয়ার্ড লিখুন" : "Enter password"}
              className={inputClass + " max-w-sm"}
            />
            <div className="flex gap-3">
              {siteLocked ? (
                <button
                  onClick={() => handleSiteLock("unlock")}
                  disabled={lockLoading || !lockPassword.trim()}
                  className="px-6 py-2.5 text-xs font-heading tracking-wide bg-emerald-600 text-white rounded-lg disabled:opacity-40 flex items-center gap-2"
                >
                  {lockLoading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                  {isBn ? "সাইট আনলক করুন" : "Unlock Site"}
                </button>
              ) : (
                <button
                  onClick={() => handleSiteLock("lock")}
                  disabled={lockLoading || !lockPassword.trim()}
                  className="px-6 py-2.5 text-xs font-heading tracking-wide bg-destructive text-destructive-foreground rounded-lg disabled:opacity-40 flex items-center gap-2"
                >
                  {lockLoading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  {isBn ? "সাইট লক করুন" : "Lock Site"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "reset" && (
        <div className="border-2 border-destructive rounded-xl p-6 space-y-6">
          <h3 className="font-heading text-lg font-bold text-destructive">
            ⚠️ Factory Reset — {isBn ? "সতর্কতার সাথে ব্যবহার করুন" : "Use with extreme caution"}
          </h3>
          {done ? (
            <div className="p-4 border border-border rounded-lg">
              <p className="font-body text-sm text-emerald-500">
                ✓ {isBn ? "ফ্যাক্টরি রিসেট সম্পন্ন। অডিট লগে রেকর্ড করা হয়েছে।" : "Factory reset complete. Recorded in audit logs."}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="font-heading text-xs tracking-wider text-destructive uppercase">✗ {isBn ? "মুছে ফেলা হবে:" : "WILL BE DELETED:"}</p>
                <ul className="space-y-1">
                  {deletedItems.map((item) => (
                    <li key={item} className="font-body text-xs text-foreground flex items-start gap-2">
                      <span className="text-destructive mt-0.5">✗</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="h-[1px] bg-border" />
              <div className="space-y-2">
                <p className="font-heading text-xs tracking-wider text-emerald-500 uppercase">✓ {isBn ? "সংরক্ষিত থাকবে:" : "WILL BE PRESERVED:"}</p>
                <ul className="space-y-1">
                  {preservedItems.map((item) => (
                    <li key={item} className="font-body text-xs text-foreground flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="h-[1px] bg-border" />
              <div className="space-y-2">
                <p className="font-body text-xs text-muted-foreground">
                  {isBn ? 'নিশ্চিত করতে নিচে "FACTORY RESET" টাইপ করুন:' : 'Type "FACTORY RESET" below to confirm:'}
                </p>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="FACTORY RESET"
                  className="w-full max-w-sm bg-transparent border border-destructive rounded-lg px-3 py-2 font-heading text-sm text-foreground focus:outline-none tracking-widest"
                />
              </div>
              <button
                onClick={handleFirstConfirm}
                disabled={!canProceed}
                className="px-6 py-3 text-xs font-heading tracking-wider bg-destructive text-destructive-foreground rounded-lg disabled:opacity-30 transition-opacity"
              >
                {isBn ? "ফ্যাক্টরি রিসেট শুরু করুন" : "Begin Factory Reset"}
              </button>
            </>
          )}
        </div>
      )}

      {showFinalModal && (
        <div className="fixed inset-0 bg-background/90 z-50 flex items-center justify-center p-4">
          <div className="bg-card border-2 border-destructive w-full max-w-md p-6 space-y-6 rounded-xl">
            <h4 className="font-heading text-sm font-bold text-destructive text-center">
              ⚠️ {isBn ? "চূড়ান্ত নিশ্চিতকরণ" : "Final Confirmation"}
            </h4>
            <p className="font-body text-sm text-foreground text-center">
              {isBn ? "আপনি কি সম্পূর্ণ নিশ্চিত? এটি পূর্বাবস্থায় ফেরানো যাবে না।" : "Are you absolutely sure? This cannot be undone."}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowFinalModal(false)} className="px-6 py-2 text-xs font-heading border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                {isBn ? "না, বাতিল করুন" : "No, Cancel"}
              </button>
              <button onClick={handleFactoryReset} disabled={resetting} className="px-6 py-2 text-xs font-heading tracking-wider bg-destructive text-destructive-foreground rounded-lg disabled:opacity-50">
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
