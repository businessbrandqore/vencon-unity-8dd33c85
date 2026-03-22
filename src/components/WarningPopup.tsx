import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, AlertTriangle } from "lucide-react";
import brandQoreLogo from "@/assets/brandqore-logo.jpg";

const NAVY = "#0a0a2e";
const PURPLE = "#7c3aed";

interface WarningData {
  message: string;
  expires_at: string; // ISO timestamp
}

interface WarningPopupProps {
  panel: "sa" | "hr" | "tl" | "employee";
}

const WarningPopup = ({ panel }: WarningPopupProps) => {
  const [warning, setWarning] = useState<WarningData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [remaining, setRemaining] = useState("");

  const fetchWarning = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "broadcast_warning")
        .maybeSingle();

      if (!data?.value) { setWarning(null); return; }

      const val = data.value as unknown as WarningData;
      if (!val.message || !val.expires_at) { setWarning(null); return; }

      const expiresAt = new Date(val.expires_at).getTime();
      if (Date.now() >= expiresAt) { setWarning(null); return; }

      // Check if already dismissed this exact warning
      const dismissedKey = `bq_warning_dismissed_${val.expires_at}`;
      if (localStorage.getItem(dismissedKey) === "1") {
        setDismissed(true);
        setWarning(val);
        return;
      }

      setDismissed(false);
      setWarning(val);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (panel !== "sa" && panel !== "hr") return;
    fetchWarning();
    const interval = setInterval(fetchWarning, 30000);
    return () => clearInterval(interval);
  }, [panel, fetchWarning]);

  // Countdown timer
  useEffect(() => {
    if (!warning) return;

    const tick = () => {
      const diff = new Date(warning.expires_at).getTime() - Date.now();
      if (diff <= 0) {
        setWarning(null);
        setRemaining("");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(
        `${h > 0 ? `${h} ঘণ্টা ` : ""}${m} মিনিট ${s} সেকেন্ড`
      );
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [warning]);

  if (panel !== "sa" && panel !== "hr") return null;
  if (!warning || dismissed) return null;

  const handleDismiss = () => {
    const dismissedKey = `bq_warning_dismissed_${warning.expires_at}`;
    localStorage.setItem(dismissedKey, "1");
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
      <div className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-300"
        style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, #0f0f3d 50%, #1a0a3e 100%)`,
          border: "1px solid rgba(124,58,237,0.3)",
          boxShadow: `0 0 60px rgba(124,58,237,0.25), 0 25px 50px rgba(0,0,0,0.5)`,
        }}>

        {/* Close button */}
        <button onClick={handleDismiss}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
          <X className="w-4 h-4" />
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="absolute -inset-2 rounded-xl blur-md"
              style={{ background: `linear-gradient(135deg, ${PURPLE}60, #a78bfa40)` }} />
            <img src={brandQoreLogo} alt="BrandQore" className="relative w-14 h-14 rounded-xl object-cover ring-2 ring-purple-400/20" />
          </div>
        </div>

        {/* Warning icon */}
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center animate-pulse"
            style={{ background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)" }}>
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
          </div>
        </div>

        <h2 className="text-center text-lg font-bold text-white mb-1">⚠️ সতর্কতা</h2>
        <p className="text-center text-white/40 text-xs mb-4">BrandQore System Warning</p>

        {/* Message */}
        <div className="rounded-xl p-4 mb-4"
          style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)" }}>
          <p className="text-yellow-200 text-sm leading-relaxed text-center whitespace-pre-wrap">
            {warning.message}
          </p>
        </div>

        {/* Countdown */}
        <div className="rounded-xl p-3 text-center"
          style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)" }}>
          <p className="text-white/40 text-[10px] mb-1">এই সতর্কতা শেষ হবে:</p>
          <p className="text-purple-300 text-sm font-mono font-semibold">{remaining}</p>
        </div>
      </div>
    </div>
  );
};

export default WarningPopup;
