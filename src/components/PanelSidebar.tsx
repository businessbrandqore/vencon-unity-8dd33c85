import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { sidebarMenus } from "@/lib/sidebarConfig";
import { getPanelByType } from "@/lib/panelConfig";
import { cn } from "@/lib/utils";

interface PanelSidebarProps {
  open: boolean;
}

const PanelSidebar = ({ open }: PanelSidebarProps) => {
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
    <aside
      className={cn(
        "h-[calc(100vh-3.5rem)] border-r border-border bg-background transition-all duration-200 overflow-hidden flex-shrink-0",
        open ? "w-56" : "w-0 md:w-12"
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
              onClick={() => navigate(item.path)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 group",
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
              {/* Show text on hover in collapsed desktop mode */}
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
  );
};

export default PanelSidebar;
