import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/appVersion";
import brandQoreLogo from "@/assets/brandqore-logo.jpg";
import {
  Shield, Zap, FileText, CheckCircle2, Lock, Users,
  BarChart3, MessageSquare, Package, Clock, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Step = "verify" | "welcome" | "security" | "terms" | "installing" | "done";
type WizardMode = "setup" | "locked";

export const SetupWizard = ({ onComplete, mode = "setup" }: { onComplete: () => void; mode?: WizardMode }) => {
  const [step, setStep] = useState<Step>("verify");
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);

  const verifyPassword = async () => {
    if (!password.trim()) {
      toast.error("পাসওয়ার্ড লিখুন");
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-verification", {
        body: { action: "verify", password }
      });
      if (error) throw error;
      if (data.success) {
        toast.success("✓ Verified!");
        if (mode === "locked") {
          // Unlock the site and go directly to app
          await supabase.functions.invoke("setup-verification", {
            body: { action: "unlock", password }
          });
          onComplete();
        } else {
          setStep("welcome");
        }
      } else {
        toast.error(data.error || "Invalid password");
      }
    } catch (err: any) {
      toast.error("Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const completeSetup = async () => {
    setStep("installing");
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 12 + 3;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        supabase.functions.invoke("setup-verification", {
          body: { action: "complete", version: APP_VERSION }
        }).then(() => {
          setTimeout(() => {
            setStep("done");
            setTimeout(onComplete, 2000);
          }, 600);
        });
      }
      setInstallProgress(Math.min(progress, 100));
    }, 250);
  };

  const stepIndicators = ["verify", "welcome", "security", "terms"];
  const currentStepIndex = stepIndicators.indexOf(step);

  // BrandQore theme colors
  const NAVY = "#0a0a2e";
  const PURPLE = "#7c3aed";
  const PURPLE_LIGHT = "#a78bfa";
  const PURPLE_GLOW = "rgba(124,58,237,0.3)";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #0f0f3d 40%, #1a0a3e 70%, ${NAVY} 100%)` }}>
      
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 120 + 10,
              height: Math.random() * 120 + 10,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: `radial-gradient(circle, rgba(124,58,237,${Math.random() * 0.08 + 0.02}) 0%, transparent 70%)`,
              animation: `pulse ${Math.random() * 4 + 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-md mx-4">
        {/* Step dots */}
        {!["installing", "done"].includes(step) && (
          <div className="flex justify-center gap-2 mb-8">
            {stepIndicators.map((s, i) => (
              <div
                key={s}
                className="rounded-full transition-all duration-500"
                style={{
                  width: i <= currentStepIndex ? 32 : 16,
                  height: 6,
                  background: i <= currentStepIndex
                    ? `linear-gradient(90deg, ${PURPLE}, ${PURPLE_LIGHT})`
                    : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>
        )}

        {/* Main card */}
        <div
          className="relative rounded-2xl p-8 shadow-2xl transition-all duration-500"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(124,58,237,0.15)",
            boxShadow: `0 0 80px ${PURPLE_GLOW}, 0 25px 50px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div
                className="absolute -inset-3 rounded-2xl blur-lg"
                style={{ background: `linear-gradient(135deg, ${PURPLE}60, ${PURPLE_LIGHT}40)` }}
              />
              <img
                src={brandQoreLogo}
                alt="BrandQore"
                className="relative w-24 h-24 rounded-2xl object-cover ring-2 ring-purple-400/20"
              />
            </div>
          </div>

          {/* ── VERIFY ── */}
          {step === "verify" && (
            <div className="space-y-6 text-center" style={{ animation: "fadeIn 0.5s ease" }}>
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">
                  {mode === "locked" ? "🔒 Site Locked" : "Admin Verification"}
                </h1>
                <p className="text-white/50 text-sm">
                  {mode === "locked"
                    ? "সাইটটি BrandQore দ্বারা লক করা হয়েছে। অ্যাক্সেস পেতে পাসওয়ার্ড দিন।"
                    : "অ্যাডমিন অ্যাক্সেস যাচাই করুন"}
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl p-4" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)" }}>
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 flex-shrink-0" style={{ color: PURPLE_LIGHT }} />
                    <span className="text-white/70 text-sm">সেটআপ পাসওয়ার্ড দিন</span>
                  </div>
                </div>
                <div className="relative">
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    placeholder="পাসওয়ার্ড লিখুন"
                    className="h-14 rounded-xl text-lg border-purple-500/20 text-white pr-12"
                    style={{ background: "rgba(124,58,237,0.06)" }}
                    onKeyDown={(e) => e.key === "Enter" && verifyPassword()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
                <Button
                  onClick={verifyPassword}
                  disabled={verifying || !password.trim()}
                  className="w-full h-12 rounded-xl font-semibold text-white border-0"
                  style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
                >
                  {verifying ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verifying...
                    </span>
                  ) : "Verify & Continue"}
                </Button>
              </div>
            </div>
          )}

          {/* ── WELCOME ── */}
          {step === "welcome" && (
            <div className="space-y-6" style={{ animation: "slideIn 0.5s ease" }}>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white mb-1">Welcome to VenCon Unity</h1>
                <p className="text-sm font-medium" style={{ color: PURPLE_LIGHT }}>Powered by BrandQore</p>
              </div>

              <div className="space-y-2.5">
                {[
                  { icon: Users, label: "Employee Management", desc: "HR, Attendance, Payroll, Leave System" },
                  { icon: BarChart3, label: "Lead & Order Pipeline", desc: "Bronze → Silver → Golden tracking" },
                  { icon: MessageSquare, label: "Real-time Communication", desc: "Chat, Calls, Typing indicators" },
                  { icon: Package, label: "Warehouse & Dispatch", desc: "Inventory, Steadfast integration" },
                  { icon: Zap, label: "AI Assistant", desc: "Database-aware smart assistant" },
                  { icon: Eye, label: "Multi-Panel System", desc: "SA, HR, TL, Employee panels" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-xl p-3 transition-colors"
                    style={{ background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.08)" }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(124,58,237,0.12)" }}
                    >
                      <Icon className="w-4 h-4" style={{ color: PURPLE_LIGHT }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm">{label}</p>
                      <p className="text-white/35 text-xs truncate">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => setStep("security")}
                className="w-full h-12 rounded-xl font-semibold text-white border-0"
                style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
              >
                Next →
              </Button>
            </div>
          )}

          {/* ── SECURITY ── */}
          {step === "security" && (
            <div className="space-y-6" style={{ animation: "slideIn 0.5s ease" }}>
              <div className="text-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(124,58,237,0.12)" }}
                >
                  <Shield className="w-7 h-7" style={{ color: PURPLE_LIGHT }} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">Security Guidelines</h1>
                <p className="text-white/50 text-sm">নিরাপত্তা নির্দেশিকা</p>
              </div>

              <div
                className="rounded-xl p-5 space-y-4"
                style={{ background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.1)" }}
              >
                {[
                  { icon: Lock, text: "প্রতিটি ইউজারের পাসওয়ার্ড শক্তিশালী ও ইউনিক হতে হবে" },
                  { icon: Shield, text: "৫ বার ভুল পাসওয়ার্ড দিলে ১৫ মিনিট লকআউট হবে" },
                  { icon: Users, text: "প্রতিটি ইউজার শুধুমাত্র নিজের ডাটা দেখতে ও পরিবর্তন করতে পারবে" },
                  { icon: Clock, text: "অন্য ডিভাইসে লগইন করলে আগের সেশন স্বয়ংক্রিয়ভাবে লগআউট হবে" },
                  { icon: Eye, text: "AI চ্যাটবট থেকে অন্যের তথ্য বা অনুমোদনহীন ডাটা অ্যাক্সেস করা যাবে না" },
                  { icon: Lock, text: "সকল কার্যক্রম Audit Log-এ রেকর্ড করা হয়" },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: PURPLE_LIGHT }} />
                    <p className="text-white/65 text-sm leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => setStep("terms")}
                className="w-full h-12 rounded-xl font-semibold text-white border-0"
                style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
              >
                Next →
              </Button>
            </div>
          )}

          {/* ── TERMS ── */}
          {step === "terms" && (
            <div className="space-y-6" style={{ animation: "slideIn 0.5s ease" }}>
              <div className="text-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(124,58,237,0.12)" }}
                >
                  <FileText className="w-7 h-7" style={{ color: PURPLE_LIGHT }} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">Terms & Conditions</h1>
                <p className="text-white/50 text-sm">ব্যবহারের শর্তাবলী</p>
              </div>

              <div
                className="rounded-xl p-5 max-h-52 overflow-y-auto space-y-3 text-sm text-white/60 leading-relaxed"
                style={{ background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.1)" }}
              >
                <p className="text-white/80 font-medium">এই সিস্টেম BrandQore দ্বারা তৈরি ও রক্ষণাবেক্ষণ করা হয়।</p>
                <p>• সকল ডাটা এনক্রিপ্টেড এবং সুরক্ষিতভাবে সংরক্ষিত থাকবে</p>
                <p>• অনুমতি ছাড়া অন্যের তথ্য অ্যাক্সেস করা সম্পূর্ণ নিষিদ্ধ</p>
                <p>• সিস্টেমের যেকোনো ধরনের অপব্যবহার শাস্তিযোগ্য অপরাধ</p>
                <p>• BrandQore যেকোনো সময় সিস্টেম আপডেট ও পরিবর্তন করার অধিকার সংরক্ষণ করে</p>
                <p>• ব্যবহারকারীর সকল কার্যক্রম অডিট লগে রেকর্ড ও সংরক্ষিত থাকবে</p>
                <p>• সিস্টেমে প্রবেশের জন্য প্রতিটি ব্যবহারকারীকে অনুমোদিত ক্রেডেনশিয়াল ব্যবহার করতে হবে</p>
                <p>• তৃতীয় পক্ষের কাছে সিস্টেমের তথ্য শেয়ার করা নিষিদ্ধ</p>
              </div>

              <Button
                onClick={completeSetup}
                className="w-full h-12 rounded-xl font-semibold text-white border-0"
                style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)` }}
              >
                ✓ Accept & Complete Setup
              </Button>
            </div>
          )}

          {/* ── INSTALLING ── */}
          {step === "installing" && (
            <div className="space-y-6 text-center py-4" style={{ animation: "fadeIn 0.5s ease" }}>
              <div className="relative w-16 h-16 mx-auto">
                <div
                  className="absolute inset-0 rounded-full animate-spin"
                  style={{
                    border: `3px solid rgba(124,58,237,0.15)`,
                    borderTopColor: PURPLE,
                  }}
                />
                <div className="absolute inset-3 rounded-full flex items-center justify-center">
                  <Zap className="w-5 h-5" style={{ color: PURPLE_LIGHT }} />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white mb-2">Installing...</h1>
                <p className="text-white/40 text-sm">Setting up your environment</p>
              </div>
              <div className="space-y-2">
                <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${installProgress}%`,
                      background: `linear-gradient(90deg, ${PURPLE}, ${PURPLE_LIGHT})`,
                    }}
                  />
                </div>
                <p className="text-white/30 text-xs font-mono">{Math.round(installProgress)}%</p>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {step === "done" && (
            <div className="space-y-4 text-center py-8" style={{ animation: "scaleIn 0.5s ease" }}>
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                style={{ background: "rgba(34,197,94,0.1)" }}
              >
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Setup Complete!</h1>
              <p className="text-white/50 text-sm">Redirecting to application...</p>
            </div>
          )}
        </div>

        {/* Footer credit */}
        <p className="text-center text-white/15 text-xs mt-6 tracking-wide">
          Developed by BrandQore • v{APP_VERSION}
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
