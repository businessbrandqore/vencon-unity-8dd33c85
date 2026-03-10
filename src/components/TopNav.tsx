import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPanelByType } from "@/lib/panelConfig";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sidebarMenus } from "@/lib/sidebarConfig";

interface TopNavProps {
  onToggleSidebar: () => void;
}

const TopNav = ({ onToggleSidebar }: TopNavProps) => {
  const { user, signOut } = useAuth();
  const { t, lang, toggleLang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const panelConfig = user ? getPanelByType(user.panel) : null;

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Get current page title
  const currentPath = location.pathname;
  const menuItems = user ? sidebarMenus[user.panel] : [];
  const currentItem = menuItems.find((item) => currentPath.startsWith(item.path));
  const pageTitle = currentItem ? t(currentItem.titleKey) : t("dashboard");

  // Fetch notifications
  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((n: any) => !n.is_read).length);
      }
    };
    fetchNotifications();
  }, [user]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length > 0) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", unreadIds);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

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
      {/* Hamburger / Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Logo */}
      <button
        onClick={() => navigate(panelConfig.dashboardPath)}
        className="font-heading text-base font-bold tracking-[0.15em] text-foreground"
      >
        VENCON
      </button>

      {/* Page title — center */}
      <div className="flex-1 text-center">
        <span className="font-heading text-sm tracking-wider text-muted-foreground">
          {pageTitle}
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="font-heading text-xs tracking-wider text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
        >
          {lang === "bn" ? "EN" : "বাং"}
        </button>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
              if (!showNotifications) markAllRead();
            }}
            className="relative p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 text-[10px] font-bold flex items-center justify-center px-1"
                style={{ backgroundColor: panelConfig.color, color: "#0A0A0A" }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-10 w-72 bg-card border border-border z-50 max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">
                  {t("no_notifications")}
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="px-4 py-3 border-b border-border last:border-0"
                  >
                    <p className="font-body text-xs text-foreground">{n.title}</p>
                    {n.message && (
                      <p className="font-body text-[11px] text-muted-foreground mt-0.5">
                        {n.message}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* User avatar */}
        <div ref={userRef} className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="w-8 h-8 flex items-center justify-center text-xs font-heading font-bold tracking-wider transition-colors"
            style={{
              backgroundColor: panelConfig.color,
              color: "#0A0A0A",
            }}
          >
            {initials}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-10 w-56 bg-card border border-border z-50">
              <div className="px-4 py-3 border-b border-border">
                <p className="font-heading text-sm text-foreground">{user.name}</p>
                <p className="font-body text-[11px] text-muted-foreground mt-0.5">
                  {user.role.replace(/_/g, " ")}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  navigate(`/${user.panel}/profile`);
                }}
                className="w-full text-left px-4 py-2.5 font-body text-xs text-foreground hover:bg-secondary transition-colors"
              >
                {t("profile")}
              </button>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  signOut();
                }}
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
