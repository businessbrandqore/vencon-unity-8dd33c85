import { useLocation, useNavigate } from "react-router-dom";
import { Menu, Globe, Sun, Moon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPanelByType } from "@/lib/panelConfig";
import { useEffect, useState, useRef } from "react";
import NotificationBell from "@/components/NotificationBell";

interface TopNavProps {
  onToggleSidebar: () => void;
}

const TopNav = ({ onToggleSidebar }: TopNavProps) => {
  const { user, signOut } = useAuth();
  const { t, lang, toggleLang, roleName } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const panelConfig = user ? getPanelByType(user.panel) : null;

  const [showUserMenu, setShowUserMenu] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  // Theme state
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("vencon_theme");
    if (saved) return saved === "dark";
    return false; // default light
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("vencon_theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = user
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "";

  if (!user || !panelConfig) return null;

  return (
    <header className="h-14 border-b border-border flex items-center px-4 gap-4 bg-background z-30">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <NotificationBell />

        {/* Theme toggle */}
        <button
          onClick={() => setDark((p) => !p)}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          title={dark ? "Light Mode" : "Dark Mode"}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
        >
          <Globe className="h-4 w-4" />
          <span className="font-heading text-xs tracking-wider">
            {lang === "bn" ? "EN" : "বাং"}
          </span>
        </button>

        {/* User avatar + name */}
        <div ref={userRef} className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-heading font-bold text-primary-foreground"
              style={{ backgroundColor: panelConfig.color }}
            >
              {initials}
            </div>
            <span className="hidden sm:block font-heading text-sm text-foreground">
              {user.name}
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-10 w-56 bg-card border border-border rounded-lg z-50 shadow-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="font-heading text-sm text-foreground">{user.name}</p>
                <p className="font-body text-[11px] text-muted-foreground mt-0.5">
                  {roleName(user.role)}
                </p>
              </div>
              <button
                onClick={() => { setShowUserMenu(false); navigate(`/${user.panel}/profile`); }}
                className="w-full text-left px-4 py-2.5 font-body text-xs text-foreground hover:bg-secondary transition-colors"
              >
                {t("profile")}
              </button>
              <button
                onClick={() => { setShowUserMenu(false); signOut(); }}
                className="w-full text-left px-4 py-2.5 font-body text-xs text-destructive hover:bg-secondary transition-colors"
              >
                {t("logout")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopNav;