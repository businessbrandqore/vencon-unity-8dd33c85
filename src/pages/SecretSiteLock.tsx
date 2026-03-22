import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Unlock, Eye, EyeOff, ShieldAlert, MessageSquareWarning, AlertTriangle, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import brandQoreLogo from "@/assets/brandqore-logo.jpg";

const NAVY = "#0a0a2e";
const PURPLE = "#7c3aed";
const PURPLE_LIGHT = "#a78bfa";
const PURPLE_GLOW = "rgba(124,58,237,0.3)";

const getClientId = () => {
  let cid = localStorage.getItem("bq_client_id");
  if (!cid) {
    cid = crypto.randomUUID();
    localStorage.setItem("bq_client_id", cid);
  }
  return cid;
};

const SecretSiteLock = () => {
  const [accessPassword, setAccessPassword] = useState("");
  const [lockPassword, setLockPassword] = useState("");
  const [showAccessPw, setShowAccessPw] = useState(false);
  const [showLockPw, setShowLockPw] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [siteLocked, setSiteLocked] = useState<boolean | null>(null);
  const [lockLoading, setLockLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockMessage, setBlockMessage] = useState("");

  // Custom message state
  const [customMessage, setCustomMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);

  // Warning broadcast state
  const [warningMessage, setWarningMessage] = useState("");
  const [warningDuration, setWarningDuration] = useState("30"); // minutes
  const [customDuration, setCustomDuration] = useState(false);
  const [customHours, setCustomHours] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const [sendingWarning, setSendingWarning] = useState(false);

  // Setup gate state
  const [setupGateDisabled, setSetupGateDisabled] = useState<boolean | null>(null);
  const [togglingSetupGate, setTogglingSetupGate] = useState(false);
  const [activeWarning, setActiveWarning] = useState<{ message: string; expires_at: string } | null>(null);

  useEffect(() => {
    // Check if this client is already blocked
    const checkBlock = async () => {
      const { data } = await supabase.functions.invoke("setup-verification", {
        body: { action: "check_lockout", clientId: getClientId() }
      });
      if (data?.locked) {
        setBlocked(true);
        setBlockMessage(`আপনি ৫ বার ভুল পাসওয়ার্ড দিয়েছেন। ${data.remainText} পর আবার চেষ্টা করুন।`);
      }
    };
    checkBlock();
  }, []);

  const verifyAccess = async () => {
    if (!accessPassword.trim() || blocked) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-verification", {
        body: { action: "verify", password: accessPassword, clientId: getClientId() }
      });
      if (error) throw error;
      if (data?.blocked) {
        setBlocked(true);
        setBlockMessage(data.error);
        return;
      }
      if (data?.success) {
        setAuthenticated(true);
        toast.success("✓ অ্যাক্সেস অনুমোদিত");
        checkLockStatus();
      } else {
        toast.error(data?.error || "পাসওয়ার্ড ভুল");
      }
    } catch {
      toast.error("ভেরিফিকেশন ব্যর্থ");
    } finally {
      setVerifying(false);
    }
  };

  const checkLockStatus = async () => {
    setCheckingStatus(true);
    try {
      const { data } = await supabase.functions.invoke("setup-verification", {
        body: { action: "check", version: "0" }
      });
      setSiteLocked(!!data?.isLocked);
      setSavedMessage(data?.lockMessage || "");
      setCustomMessage(data?.lockMessage || "");
    } catch {
      setSiteLocked(false);
    } finally {
      setCheckingStatus(false);
    }
    // Also fetch active warning
    try {
      const { data: wData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "broadcast_warning")
        .maybeSingle();
      if (wData?.value) {
        const val = wData.value as unknown as { message: string; expires_at: string };
        if (val.message && val.expires_at && new Date(val.expires_at).getTime() > Date.now()) {
          setActiveWarning(val);
        } else {
          setActiveWarning(null);
        }
      } else {
        setActiveWarning(null);
      }
    } catch { /* silent */ }
  };

  const handleSendWarning = async () => {
    if (!lockPassword.trim()) { toast.error("পাসওয়ার্ড দিন"); return; }
    if (!warningMessage.trim()) { toast.error("ওয়ার্নিং মেসেজ লিখুন"); return; }
    setSendingWarning(true);
    try {
      // Verify password first
      const { data: verifyData } = await supabase.functions.invoke("setup-verification", {
        body: { action: "verify", password: lockPassword, clientId: getClientId() }
      });
      if (!verifyData?.success) { toast.error("পাসওয়ার্ড ভুল"); setSendingWarning(false); return; }

      const finalMinutes = customDuration
        ? (parseInt(customHours || "0") * 60 + parseInt(customMinutes || "0"))
        : parseInt(warningDuration);
      if (finalMinutes <= 0) { toast.error("সময়কাল নির্ধারণ করুন"); setSendingWarning(false); return; }
      const expiresAt = new Date(Date.now() + finalMinutes * 60000).toISOString();
      const warningVal = { message: warningMessage, expires_at: expiresAt };

      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "broadcast_warning")
        .maybeSingle();

      if (existing) {
        await supabase.from("app_settings").update({ value: warningVal as any }).eq("key", "broadcast_warning");
      } else {
        await supabase.from("app_settings").insert({ key: "broadcast_warning", value: warningVal as any });
      }

      setActiveWarning(warningVal);
      setWarningMessage("");
      toast.success("⚠️ ওয়ার্নিং পাঠানো হয়েছে!");
    } catch {
      toast.error("ওয়ার্নিং পাঠানো ব্যর্থ");
    } finally {
      setSendingWarning(false);
    }
  };

  const handleClearWarning = async () => {
    if (!lockPassword.trim()) { toast.error("পাসওয়ার্ড দিন"); return; }
    try {
      await supabase.from("app_settings").update({ value: null }).eq("key", "broadcast_warning");
      setActiveWarning(null);
      toast.success("ওয়ার্নিং সরানো হয়েছে");
    } catch {
      toast.error("ব্যর্থ");
    }
  };

  const handleLockAction = async (action: "lock" | "unlock") => {
    if (!lockPassword.trim()) {
      toast.error("পাসওয়ার্ড দিন");
      return;
    }
    setLockLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-verification", {
        body: { action, password: lockPassword, clientId: getClientId() }
      });
      if (error) throw error;
      if (data?.success) {
        setSiteLocked(action === "lock");
        setLockPassword("");
        toast.success(data.message || (action === "lock" ? "🔒 সাইট লক হয়েছে" : "🔓 সাইট আনলক হয়েছে"));
      } else {
        toast.error(data?.error || "ব্যর্থ");
      }
    } catch {
      toast.error("অপারেশন ব্যর্থ");
    } finally {
      setLockLoading(false);
    }
  };

  const handleSaveMessage = async () => {
    if (!lockPassword.trim()) {
      toast.error("পাসওয়ার্ড দিন");
      return;
    }
    setSavingMessage(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-verification", {
        body: { action: "set_message", password: lockPassword, customMessage, clientId: getClientId() }
      });
      if (error) throw error;
      if (data?.success) {
        setSavedMessage(customMessage);
        toast.success("✓ মেসেজ সেভ হয়েছে");
      } else {
        toast.error(data?.error || "ব্যর্থ");
      }
    } catch {
      toast.error("সেভ ব্যর্থ");
    } finally {
      setSavingMessage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto py-8"
      style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0f0f3d 40%, #1a0a3e 70%, ${NAVY} 100%)` }}>
      
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="absolute rounded-full"
            style={{
              width: Math.random() * 100 + 10,
              height: Math.random() * 100 + 10,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: `radial-gradient(circle, rgba(124,58,237,${Math.random() * 0.06 + 0.02}) 0%, transparent 70%)`,
              animation: `pulse ${Math.random() * 4 + 3}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-md mx-4">
        <div className="rounded-2xl p-8 shadow-2xl"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(124,58,237,0.15)",
            boxShadow: `0 0 80px ${PURPLE_GLOW}, 0 25px 50px rgba(0,0,0,0.5)`,
          }}>

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute -inset-3 rounded-2xl blur-lg"
                style={{ background: `linear-gradient(135deg, ${PURPLE}60, ${PURPLE_LIGHT}40)` }} />
              <img src={brandQoreLogo} alt="BrandQore" className="relative w-20 h-20 rounded-2xl object-cover ring-2 ring-purple-400/20" />
            </div>
          </div>

          {!authenticated ? (
            /* ── ACCESS GATE ── */
            <div className="space-y-6 text-center">
              <div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(239,68,68,0.12)" }}>
                  <ShieldAlert className="w-6 h-6 text-red-400" />
                </div>
                <h1 className="text-xl font-bold text-white mb-1">Restricted Access</h1>
                <p className="text-white/40 text-xs">অনুমোদিত ব্যক্তি ব্যতীত প্রবেশ নিষেধ</p>
              </div>

              {blocked ? (
                <div className="rounded-xl p-4 space-y-2"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
                  <p className="text-red-300 text-sm font-medium">{blockMessage}</p>
                  <p className="text-red-400/50 text-xs">৫ ঘন্টা পর আবার চেষ্টা করুন।</p>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Input
                      value={accessPassword}
                      onChange={(e) => setAccessPassword(e.target.value)}
                      type={showAccessPw ? "text" : "password"}
                      placeholder="পাসওয়ার্ড দিন"
                      className="h-12 rounded-xl border-purple-500/20 text-white pr-10"
                      style={{ background: "rgba(124,58,237,0.06)" }}
                      onKeyDown={(e) => e.key === "Enter" && verifyAccess()}
                    />
                    <button type="button" onClick={() => setShowAccessPw(!showAccessPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                      {showAccessPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button onClick={verifyAccess} disabled={verifying || !accessPassword.trim()}
                    className="w-full h-11 rounded-xl font-semibold text-white border-0"
                    style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}>
                    {verifying ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Verify"}
                  </Button>
                </>
              )}
            </div>
          ) : (
            /* ── LOCK CONTROL PANEL ── */
            <div className="space-y-5">
              <div className="text-center">
                <h1 className="text-xl font-bold text-white mb-1">Site Lock Control</h1>
                <p className="text-white/40 text-xs">BrandQore সাইট লক কন্ট্রোল প্যানেল</p>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3 rounded-xl p-4"
                style={{ background: siteLocked ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)", border: `1px solid ${siteLocked ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}` }}>
                {checkingStatus ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                ) : siteLocked ? (
                  <Lock className="w-5 h-5 text-red-400" />
                ) : (
                  <Unlock className="w-5 h-5 text-green-400" />
                )}
                <div>
                  <p className="text-white text-sm font-medium">
                    {checkingStatus ? "চেক করা হচ্ছে..." : siteLocked ? "🔴 সাইট লক আছে" : "🟢 সাইট আনলক আছে"}
                  </p>
                  <p className="text-white/30 text-xs">
                    {siteLocked ? "কেউ অ্যাক্সেস করতে পারছে না" : "সবাই স্বাভাবিকভাবে ব্যবহার করছে"}
                  </p>
                </div>
              </div>

              {/* Custom Message */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquareWarning className="w-4 h-4 text-orange-400" />
                  <p className="text-white/60 text-xs font-medium">কাস্টম সতর্কতা মেসেজ (লক স্ক্রিনে দেখাবে):</p>
                </div>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="যেমন: সিস্টেম রক্ষণাবেক্ষণের কারণে সাময়িকভাবে বন্ধ..."
                  rows={3}
                  className="w-full rounded-xl border border-purple-500/20 text-white text-sm p-3 resize-none placeholder:text-white/20"
                  style={{ background: "rgba(124,58,237,0.06)" }}
                />
                {savedMessage && (
                  <div className="rounded-lg p-2.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <p className="text-red-300/60 text-[10px] mb-1">বর্তমান সেভ করা মেসেজ:</p>
                    <p className="text-red-300 text-xs">{savedMessage}</p>
                  </div>
                )}
                <Button onClick={handleSaveMessage} disabled={savingMessage || !lockPassword.trim()}
                  size="sm"
                  className="w-full h-9 rounded-lg font-medium text-white text-xs border-0"
                  style={{ background: "linear-gradient(135deg, #ea580c, #c2410c)" }}>
                  {savingMessage ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "মেসেজ সেভ করুন"}
                </Button>
              </div>

              {/* Action */}
              <div className="space-y-3">
                <p className="text-white/50 text-xs">পাসওয়ার্ড দিয়ে লক/আনলক/মেসেজ সেভ করুন:</p>
                <div className="relative">
                  <Input
                    value={lockPassword}
                    onChange={(e) => setLockPassword(e.target.value)}
                    type={showLockPw ? "text" : "password"}
                    placeholder="পাসওয়ার্ড"
                    className="h-11 rounded-xl border-purple-500/20 text-white pr-10"
                    style={{ background: "rgba(124,58,237,0.06)" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLockAction(siteLocked ? "unlock" : "lock");
                    }}
                  />
                  <button type="button" onClick={() => setShowLockPw(!showLockPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                    {showLockPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => handleLockAction("lock")}
                    disabled={lockLoading || !lockPassword.trim()}
                    className="flex-1 h-10 rounded-xl font-semibold text-white border-0 gap-2"
                    style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)" }}>
                    {lockLoading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                    লক করুন
                  </Button>
                  <Button onClick={() => handleLockAction("unlock")}
                    disabled={lockLoading || !lockPassword.trim()}
                    className="flex-1 h-10 rounded-xl font-semibold text-white border-0 gap-2"
                    style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
                    {lockLoading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                    আনলক করুন
                  </Button>
                </div>
              </div>

              {/* ── WARNING BROADCAST ── */}
              <div className="space-y-3 pt-2" style={{ borderTop: "1px solid rgba(234,179,8,0.15)" }}>
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-yellow-400" />
                  <p className="text-white text-sm font-medium">ওয়ার্নিং ব্রডকাস্ট</p>
                  <span className="text-white/30 text-[10px]">(HR ও SA প্যানেলে দেখাবে)</span>
                </div>

                {activeWarning && (
                  <div className="rounded-xl p-3 flex items-start justify-between gap-2"
                    style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)" }}>
                    <div className="flex-1">
                      <p className="text-yellow-300/60 text-[10px] mb-1">সক্রিয় ওয়ার্নিং:</p>
                      <p className="text-yellow-200 text-xs">{activeWarning.message}</p>
                      <p className="text-yellow-400/40 text-[10px] mt-1">
                        মেয়াদ: {new Date(activeWarning.expires_at).toLocaleString("bn-BD")}
                      </p>
                    </div>
                    <button onClick={handleClearWarning}
                      className="text-red-400 hover:text-red-300 text-[10px] underline whitespace-nowrap">
                      সরান
                    </button>
                  </div>
                )}

                <textarea
                  value={warningMessage}
                  onChange={(e) => setWarningMessage(e.target.value)}
                  placeholder="ওয়ার্নিং মেসেজ লিখুন..."
                  rows={2}
                  className="w-full rounded-xl border border-yellow-500/20 text-white text-sm p-3 resize-none placeholder:text-white/20"
                  style={{ background: "rgba(234,179,8,0.04)" }}
                />

                <div className="space-y-2">
                  <p className="text-white/40 text-xs">কাউন্টডাউন:</p>
                  <div className="flex items-center gap-2">
                    <select
                      value={customDuration ? "custom" : warningDuration}
                      onChange={(e) => {
                        if (e.target.value === "custom") {
                          setCustomDuration(true);
                        } else {
                          setCustomDuration(false);
                          setWarningDuration(e.target.value);
                        }
                      }}
                      className="flex-1 h-9 rounded-lg border border-purple-500/20 text-white text-xs px-2"
                      style={{ background: "rgba(124,58,237,0.06)" }}>
                      <option value="15" className="bg-gray-900">১৫ মিনিট</option>
                      <option value="30" className="bg-gray-900">৩০ মিনিট</option>
                      <option value="60" className="bg-gray-900">১ ঘণ্টা</option>
                      <option value="120" className="bg-gray-900">২ ঘণ্টা</option>
                      <option value="360" className="bg-gray-900">৬ ঘণ্টা</option>
                      <option value="720" className="bg-gray-900">১২ ঘণ্টা</option>
                      <option value="1440" className="bg-gray-900">২৪ ঘণ্টা</option>
                      <option value="2880" className="bg-gray-900">২ দিন</option>
                      <option value="4320" className="bg-gray-900">৩ দিন</option>
                      <option value="10080" className="bg-gray-900">৭ দিন</option>
                      <option value="custom" className="bg-gray-900">কাস্টম...</option>
                    </select>
                  </div>
                  {customDuration && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        placeholder="ঘণ্টা"
                        value={customHours}
                        onChange={(e) => setCustomHours(e.target.value)}
                        className="flex-1 h-9 rounded-lg border border-purple-500/20 text-white text-xs"
                        style={{ background: "rgba(124,58,237,0.06)" }}
                      />
                      <span className="text-white/40 text-xs">ঘণ্টা</span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        placeholder="মিনিট"
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(e.target.value)}
                        className="flex-1 h-9 rounded-lg border border-purple-500/20 text-white text-xs"
                        style={{ background: "rgba(124,58,237,0.06)" }}
                      />
                      <span className="text-white/40 text-xs">মিনিট</span>
                    </div>
                  )}
                </div>

                <Button onClick={handleSendWarning}
                  disabled={sendingWarning || !lockPassword.trim() || !warningMessage.trim()}
                  className="w-full h-9 rounded-lg font-medium text-white text-xs border-0 gap-2"
                  style={{ background: "linear-gradient(135deg, #ca8a04, #a16207)" }}>
                  {sendingWarning ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Megaphone className="w-3.5 h-3.5" />}
                  ওয়ার্নিং পাঠান
                </Button>
              </div>

              <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.1)" }}>
                <p className="text-white/50 text-[10px] leading-relaxed">
                  ⚠️ লক করলে সম্পূর্ণ ওয়েবসাইট বন্ধ হয়ে যাবে। কেউ লগইন বা কিছু অ্যাক্সেস করতে পারবে না। শুধুমাত্র এই প্যানেল থেকে আনলক করা যাবে।
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecretSiteLock;
