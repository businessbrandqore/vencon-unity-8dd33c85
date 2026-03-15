import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/appVersion";
import brandQoreLogo from "@/assets/brandqore-logo.jpg";
import {
  Shield, Zap, FileText, CheckCircle2, Mail, Lock, Users,
  BarChart3, MessageSquare, Package, Clock, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const ADMIN_EMAIL = "business.brand.qore@gmail.com";

type Step = "verify" | "welcome" | "security" | "terms" | "installing" | "done";

export const SetupWizard = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState<Step>("verify");
  const [otpCode, setOtpCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);

  const sendCode = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-verification", {
        body: { action: "generate" }
      });
      if (error) throw error;
      setCodeSent(true);
      toast.success("Verification code sent!");
    } catch (err: any) {
      toast.error("Failed to send code");
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (otpCode.length !== 6) {
      toast.error("৬ ডিজিটের কোড দিন");
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-verification", {
        body: { action: "verify", code: otpCode }
      });
      if (error) throw error;
      if (data.success) {
        toast.success("✓ Verified!");
        setStep("welcome");
      } else {
        toast.error(data.error || "Invalid code");
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #111827 40%, #1a0a00 70%, #0a0a0a 100%)" }}>
      
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
              background: `radial-gradient(circle, rgba(234,88,12,${Math.random() * 0.08 + 0.02}) 0%, transparent 70%)`,
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
                    ? "linear-gradient(90deg, #ea580c, #f59e0b)"
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
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 0 80px rgba(234,88,12,0.05), 0 25px 50px rgba(0,0,0,0.5)",
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div
                className="absolute -inset-2 rounded-2xl blur-md"
                style={{ background: "linear-gradient(135deg, #ea580c40, #f59e0b40)" }}
              />
              <img
                src={brandQoreLogo}
                alt="BrandQore"
                className="relative w-20 h-20 rounded-2xl object-cover ring-2 ring-white/10"
              />
            </div>
          </div>

          {/* ── VERIFY ── */}
          {step === "verify" && (
            <div className="space-y-6 text-center" style={{ animation: "fadeIn 0.5s ease" }}>
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Admin Verification</h1>
                <p className="text-white/50 text-sm">অ্যাডমিন অ্যাক্সেস যাচাই করুন</p>
              </div>

              {!codeSent ? (
                <div className="space-y-4">
                  <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-orange-400 flex-shrink-0" />
                      <span className="text-white/70 text-sm truncate">{ADMIN_EMAIL}</span>
                    </div>
                  </div>
                  <Button
                    onClick={sendCode}
                    disabled={sending}
                    className="w-full h-12 rounded-xl font-semibold text-white border-0"
                    style={{ background: "linear-gradient(135deg, #ea580c, #d97706)" }}
                  >
                    {sending ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </span>
                    ) : "Send Verification Code"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-white/50 text-xs">
                    ইমেইলে পাঠানো ৬ ডিজিটের কোডটি লিখুন
                  </p>
                  <Input
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="text-center text-3xl tracking-[0.6em] h-16 rounded-xl font-mono border-white/10 text-white"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  />
                  <Button
                    onClick={verifyCode}
                    disabled={verifying || otpCode.length !== 6}
                    className="w-full h-12 rounded-xl font-semibold text-white border-0"
                    style={{ background: "linear-gradient(135deg, #ea580c, #d97706)" }}
                  >
                    {verifying ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Verifying...
                      </span>
                    ) : "Verify Code"}
                  </Button>
                  <button
                    onClick={() => { setCodeSent(false); setOtpCode(""); }}
                    className="text-orange-400/50 hover:text-orange-400 text-xs underline transition-colors"
                  >
                    Resend code
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── WELCOME ── */}
          {step === "welcome" && (
            <div className="space-y-6" style={{ animation: "slideIn 0.5s ease" }}>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white mb-1">Welcome to VenCon Unity</h1>
                <p className="text-orange-400/80 text-sm font-medium">Powered by BrandQore</p>
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
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(234,88,12,0.1)" }}
                    >
                      <Icon className="w-4 h-4 text-orange-400" />
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
                style={{ background: "linear-gradient(135deg, #ea580c, #d97706)" }}
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
                  style={{ background: "rgba(234,88,12,0.1)" }}
                >
                  <Shield className="w-7 h-7 text-orange-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">Security Guidelines</h1>
                <p className="text-white/50 text-sm">নিরাপত্তা নির্দেশিকা</p>
              </div>

              <div
                className="rounded-xl p-5 space-y-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
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
                    <Icon className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <p className="text-white/65 text-sm leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => setStep("terms")}
                className="w-full h-12 rounded-xl font-semibold text-white border-0"
                style={{ background: "linear-gradient(135deg, #ea580c, #d97706)" }}
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
                  style={{ background: "rgba(234,88,12,0.1)" }}
                >
                  <FileText className="w-7 h-7 text-orange-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">Terms & Conditions</h1>
                <p className="text-white/50 text-sm">ব্যবহারের শর্তাবলী</p>
              </div>

              <div
                className="rounded-xl p-5 max-h-52 overflow-y-auto space-y-3 text-sm text-white/60 leading-relaxed"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
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
                style={{ background: "linear-gradient(135deg, #ea580c, #d97706)" }}
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
                    border: "3px solid rgba(234,88,12,0.15)",
                    borderTopColor: "#ea580c",
                  }}
                />
                <div className="absolute inset-3 rounded-full flex items-center justify-center">
                  <Zap className="w-5 h-5 text-orange-400" />
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
                      background: "linear-gradient(90deg, #ea580c, #f59e0b)",
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
