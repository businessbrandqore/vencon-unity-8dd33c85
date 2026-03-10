import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { sidebarMenus } from "@/lib/sidebarConfig";
import { getPanelByType } from "@/lib/panelConfig";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface PanelSidebarProps {
  open: boolean;
  onClose?: () => void;
}

const PanelSidebar = ({ open, onClose }: PanelSidebarProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const panelConfig = getPanelByType(user.panel);
  const items = sidebarMenus[user.panel].filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(user.role);
  });

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "h-[calc(100vh-3.5rem)] border-r border-border bg-background transition-all duration-200 overflow-hidden flex-shrink-0 z-50",
          // Desktop: normal sidebar
          "hidden md:block",
          open ? "md:w-56" : "md:w-12",
          // Mobile: overlay slide-in
        )}
      >
        <nav className="flex flex-col py-2">
          {items.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== `/${user.panel}/dashboard` && location.pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); onClose?.(); }}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 group relative",
                  isActive
                    ? "text-foreground bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <Icon
                  className="h-4 w-4 flex-shrink-0"
                  style={isActive && panelConfig ? { color: panelConfig.color } : undefined}
                />
                {open && (
                  <span className="font-body text-xs tracking-wide whitespace-nowrap">
                    {t(item.titleKey)}
                  </span>
                )}
                {!open && (
                  <span className="hidden md:block absolute left-12 bg-card border border-border px-2 py-1 font-body text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {t(item.titleKey)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed top-14 left-0 h-[calc(100vh-3.5rem)] w-64 border-r border-border bg-background z-50 transition-transform duration-200 md:hidden overflow-y-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-heading text-sm font-bold text-foreground">VENCON</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex flex-col py-2">
          {items.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== `/${user.panel}/dashboard` && location.pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); onClose?.(); }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150",
                  isActive
                    ? "text-foreground bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <Icon
                  className="h-4 w-4 flex-shrink-0"
                  style={isActive && panelConfig ? { color: panelConfig.color } : undefined}
                />
                <span className="font-body text-sm tracking-wide">
                  {t(item.titleKey)}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default PanelSidebar;
