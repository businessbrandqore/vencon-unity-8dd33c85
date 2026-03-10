import { useLocation, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPanelByType } from "@/lib/panelConfig";
import { useEffect, useState, useRef } from "react";
import { sidebarMenus } from "@/lib/sidebarConfig";
import NotificationBell from "@/components/NotificationBell";

interface TopNavProps {
  onToggleSidebar: () => void;
}

const TopNav = ({ onToggleSidebar }: TopNavProps) => {
  const { user, signOut } = useAuth();
  const { t, lang, toggleLang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const panelConfig = user ? getPanelByType(user.panel) : null;

  const [showUserMenu, setShowUserMenu] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  // Get current page title
  const currentPath = location.pathname;
  const menuItems = user ? sidebarMenus[user.panel] : [];
  const currentItem = menuItems.find((item) => currentPath.startsWith(item.path));
  const pageTitle = currentItem ? t(currentItem.titleKey) : t("dashboard");

  // Close dropdown on outside click
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
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
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

      <button
        onClick={() => navigate(panelConfig.dashboardPath)}
        className="font-heading text-base font-bold tracking-[0.15em] text-foreground"
      >
        VENCON
      </button>

      <div className="flex-1 text-center">
        <span className="font-heading text-sm tracking-wider text-muted-foreground">
          {pageTitle}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleLang}
          className="font-heading text-xs tracking-wider text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
        >
          {lang === "bn" ? "EN" : "বাং"}
        </button>

        <NotificationBell />

        <div ref={userRef} className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-8 h-8 flex items-center justify-center text-xs font-heading font-bold tracking-wider transition-colors"
            style={{ backgroundColor: panelConfig.color, color: "#0A0A0A" }}
          >
            {initials}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-10 w-56 bg-card border border-border z-50">
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
