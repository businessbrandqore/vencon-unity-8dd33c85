import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPanelByType, PanelType } from "@/lib/panelConfig";
import { supabase } from "@/integrations/supabase/client";
import LanguageToggle from "@/components/LanguageToggle";
import { Shield, Eye, EyeOff } from "lucide-react";
import LoginBackground from "@/components/LoginBackground";
import venconLogo from "@/assets/vencon-logo.png";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

const PanelLogin = () => {
  const { panel } = useParams<{ panel: string }>();
  const panelConfig = getPanelByType(panel as PanelType);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [flashColor, setFlashColor] = useState(false);

  const [attempts, setAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null);
  const [countdown, setCountdown] = useState("");

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

  useEffect(() => {
    if (!lockoutEnd) { setCountdown(""); return; }
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
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          const end = Date.now() + LOCKOUT_DURATION;
          setLockoutEnd(end);
          localStorage.setItem(`vencon_lockout_${panel}`, JSON.stringify({ attempts: newAttempts, lockoutEnd: end }));
        }
        setError(t("invalid_creds"));
        setLoading(false);
        return;
      }
      const { data: userData, error: userError } = await supabase.from("users").select("panel").eq("auth_id", authData.user.id).single();
      if (userError || !userData) {
        await supabase.auth.signOut();
        setError(t("invalid_creds"));
        setLoading(false);
        return;
      }
      if (userData.panel !== panel) {
        await supabase.auth.signOut();
        const correctPanel = getPanelByType(userData.panel as PanelType);
        setError(t("no_panel_access"));
        setLoading(false);
        if (correctPanel) setTimeout(() => navigate(correctPanel.loginPath), 2000);
        return;
      }
      setFlashColor(true);
      setTimeout(() => navigate(panelConfig.dashboardPath), 250);
    } catch {
      setError(t("invalid_creds"));
      setLoading(false);
    }
  }, [email, password, attempts, lockoutEnd, panel, panelConfig, navigate, t]);

  if (!panelConfig) { navigate("/"); return null; }
  const isLocked = lockoutEnd !== null && Date.now() < lockoutEnd;

  return (
    <>
      {flashColor && (
        <div className="fixed inset-0 z-50 transition-opacity duration-200" style={{ backgroundColor: panelConfig.color }} />
      )}

      <div className="min-h-screen bg-background flex relative overflow-hidden">
        <LoginBackground />
        <LanguageToggle />

        {/* Left branding */}
        <div className="hidden lg:flex flex-1 flex-col justify-end p-12">
          <img src={venconLogo} alt="Vencon" className="w-24 h-24 rounded-2xl shadow-lg mb-6" />
          <h1 className="font-heading text-6xl font-bold tracking-[0.25em] text-foreground">
            VENCON
          </h1>
          <p className="mt-3 font-body text-base text-muted-foreground">
            অপারেশন ম্যানেজমেন্ট
          </p>
          <div className="mt-auto pt-12">
            <div className="w-20 h-1 rounded-full bg-primary" />
            <p className="mt-4 font-body text-xs text-muted-foreground">© ২০২৬ ভেনকন</p>
          </div>
        </div>

        {/* Right form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 space-y-6 shadow-sm">
            {/* Icon */}
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: panelConfig.color }}
            >
              <Shield className="h-6 w-6 text-white" />
            </div>

            <div>
              <h2 className="font-heading text-xl font-bold text-foreground">
                {t(panelConfig.nameKey)} Login
              </h2>
              <p className="font-body text-sm text-muted-foreground mt-1">
                Access {t(panelConfig.nameKey).toLowerCase()} management
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="font-body text-sm font-medium text-foreground">
                  {t("email")}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLocked}
                  required
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-body text-sm font-medium text-foreground">
                  {t("password")}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLocked}
                    required
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 pr-10 font-body text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isLocked && (
                <p className="font-body text-xs text-center text-primary">
                  {t("locked_msg")} {countdown}
                </p>
              )}
              {error && !isLocked && (
                <p className="font-body text-xs text-destructive text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLocked || loading}
                className="w-full py-3.5 rounded-lg font-heading text-sm font-semibold tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 disabled:opacity-30"
              >
                {loading ? "..." : t("login")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default PanelLogin;
