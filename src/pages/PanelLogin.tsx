import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPanelByType, PanelType } from "@/lib/panelConfig";
import { supabase } from "@/integrations/supabase/client";
import LanguageToggle from "@/components/LanguageToggle";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const PanelLogin = () => {
  const { panel } = useParams<{ panel: string }>();
  const panelConfig = getPanelByType(panel as PanelType);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [flashColor, setFlashColor] = useState(false);

  // Lockout state
  const [attempts, setAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null);
  const [countdown, setCountdown] = useState("");

  // Load lockout state from localStorage
  useEffect(() => {
    if (!panel) return;
    const stored = localStorage.getItem(`vencon_lockout_${panel}`);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.lockoutEnd && Date.now() < data.lockoutEnd) {
        setLockoutEnd(data.lockoutEnd);
        setAttempts(data.attempts);
      } else {
        localStorage.removeItem(`vencon_lockout_${panel}`);
      }
    }
  }, [panel]);

  // Countdown timer
  useEffect(() => {
    if (!lockoutEnd) {
      setCountdown("");
      return;
    }

    const tick = () => {
      const remaining = lockoutEnd - Date.now();
      if (remaining <= 0) {
        setLockoutEnd(null);
        setAttempts(0);
        if (panel) localStorage.removeItem(`vencon_lockout_${panel}`);
        setCountdown("");
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${mins}:${secs.toString().padStart(2, "0")}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutEnd, panel]);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutEnd && Date.now() < lockoutEnd) return;
    if (!panelConfig) return;

    setError("");
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= MAX_ATTEMPTS) {
          const end = Date.now() + LOCKOUT_DURATION;
          setLockoutEnd(end);
          localStorage.setItem(
            `vencon_lockout_${panel}`,
            JSON.stringify({ attempts: newAttempts, lockoutEnd: end })
          );
        }

        setError(t("invalid_creds"));
        setLoading(false);
        return;
      }

      // Success — flash accent color
      setFlashColor(true);
      setTimeout(() => {
        navigate(panelConfig.dashboardPath);
      }, 250);
    } catch {
      setError(t("invalid_creds"));
      setLoading(false);
    }
  }, [email, password, attempts, lockoutEnd, panel, panelConfig, navigate, t]);

  if (!panelConfig) {
    navigate("/");
    return null;
  }

  const isLocked = lockoutEnd !== null && Date.now() < lockoutEnd;

  return (
    <>
      {/* Full screen flash on success */}
      {flashColor && (
        <div
          className="fixed inset-0 z-50 transition-opacity duration-200"
          style={{ backgroundColor: panelConfig.color }}
        />
      )}

      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <LanguageToggle />

        <div className="w-full max-w-[400px] space-y-12">
          {/* Logo */}
          <div className="text-center space-y-3">
            <h1 className="font-heading text-4xl font-bold tracking-[0.2em] text-foreground">
              {t("vencon")}
            </h1>
            <p
              className="font-heading text-sm tracking-wider"
              style={{ color: panelConfig.color }}
            >
              {t(panelConfig.nameKey)}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-1">
              <label className="font-body text-xs text-muted-foreground tracking-wider uppercase">
                {t("email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLocked}
                required
                className="w-full bg-transparent border border-border px-4 py-3 font-body text-foreground text-sm focus:outline-none transition-colors duration-200"
                style={{
                  borderColor: email ? panelConfig.color : undefined,
                }}
                onFocus={(e) => (e.target.style.borderColor = panelConfig.color)}
                onBlur={(e) => {
                  if (!email) e.target.style.borderColor = "";
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="font-body text-xs text-muted-foreground tracking-wider uppercase">
                {t("password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLocked}
                required
                className="w-full bg-transparent border border-border px-4 py-3 font-body text-foreground text-sm focus:outline-none transition-colors duration-200"
                style={{
                  borderColor: password ? panelConfig.color : undefined,
                }}
                onFocus={(e) => (e.target.style.borderColor = panelConfig.color)}
                onBlur={(e) => {
                  if (!password) e.target.style.borderColor = "";
                }}
              />
            </div>

            {/* Error / Lockout message */}
            {isLocked && (
              <p className="font-body text-xs text-center" style={{ color: panelConfig.color }}>
                {t("locked_msg")} {countdown}
              </p>
            )}
            {error && !isLocked && (
              <p className="font-body text-xs text-destructive text-center">{error}</p>
            )}

            {/* Login Button — Signature Moment */}
            <button
              type="submit"
              disabled={isLocked || loading}
              onMouseDown={() => setIsPressed(true)}
              onMouseUp={() => setIsPressed(false)}
              className="w-full py-4 font-heading text-sm tracking-[0.15em] uppercase transition-all duration-200 disabled:opacity-30"
              style={{
                backgroundColor: isPressed ? panelConfig.color : "transparent",
                color: isPressed ? "#0A0A0A" : "hsl(var(--foreground))",
                border: "1px solid hsl(var(--border))",
                outline: "none",
                boxShadow: "none",
              }}
              onMouseEnter={(e) => {
                if (!isPressed) {
                  e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${panelConfig.color}`;
                  e.currentTarget.style.border = `1px solid ${panelConfig.color}`;
                }
              }}
              onMouseLeave={(e) => {
                setIsPressed(false);
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.border = "1px solid hsl(var(--border))";
              }}
            >
              {loading ? "..." : t("login")}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default PanelLogin;
