import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { sidebarMenus, SidebarItem } from "@/lib/sidebarConfig";
import { getPanelByType } from "@/lib/panelConfig";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PanelSidebarProps {
  open: boolean;
  onClose?: () => void;
}

// Group items into sections
const getSections = (items: SidebarItem[], panel: string) => {
  const settingsKeys = ["settings"];
  const main = items.filter((i) => !settingsKeys.includes(i.titleKey));
  const settings = items.filter((i) => settingsKeys.includes(i.titleKey));
  return { main, settings };
};

const PanelSidebar = ({ open, onClose }: PanelSidebarProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("VENCON");

  useEffect(() => {
    const fetchBranding = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "ui_config")
        .single();
      if (data?.value) {
        const val = data.value as Record<string, string>;
        localStorage.setItem("vencon_ui_branding", JSON.stringify(val));
        if (val.company_logo) setCompanyLogo(val.company_logo);
        if (val.company_name) setCompanyName(val.company_name);
      }
    };
    fetchBranding();
  }, []);

  if (!user) return null;

  const panelConfig = getPanelByType(user.panel);
  const items = sidebarMenus[user.panel].filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(user.role);
  });
  const { main, settings } = getSections(items, user.panel);

  const renderItem = (item: SidebarItem) => {
    const isActive = location.pathname === item.path ||
      (item.path !== `/${user.panel}/dashboard` && item.path !== `/${user.panel}/leads` && location.pathname.startsWith(item.path));
    const Icon = item.icon;

    return (
      <button
        key={item.path}
        onClick={() => { navigate(item.path); onClose?.(); }}
        className={cn(
          "flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-left transition-colors duration-150",
          isActive
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        )}
      >
        <Icon
          className="h-4 w-4 flex-shrink-0"
          style={isActive && panelConfig ? { color: panelConfig.color } : undefined}
        />
        <span className="font-body text-sm tracking-wide whitespace-nowrap">
          {t(item.titleKey)}
        </span>
      </button>
    );
  };

  const logoSection = (
    <div className="px-4 py-4 flex items-center gap-3">
      {companyLogo ? (
        <img src={companyLogo} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
      ) : (
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-heading text-sm font-bold"
          style={{ backgroundColor: panelConfig?.color, color: "#0A0A0A" }}
        >
          {companyName.charAt(0)}
        </div>
      )}
      <div>
        <span className="font-heading text-sm font-bold text-foreground tracking-wider">{companyName}</span>
        <p className="font-body text-[10px] text-muted-foreground">
          {user.role === "Business Development And Marketing Manager" ? t("bdo_panel") : user.role === "Assistant Team Leader" ? t("atl_panel") : (panelConfig ? t(panelConfig.nameKey) : "")}
        </p>
      </div>
    </div>
  );

  const navContent = (
    <>
      {/* Main section */}
      <div className="px-4 pt-2 pb-1">
        <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">{t("main_section") || "প্রধান"}</span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {main.map(renderItem)}
      </nav>

      {/* Settings section */}
      {settings.length > 0 && (
        <>
          <div className="px-4 pt-4 pb-1">
            <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">{t("settings_section") || "সেটিংস"}</span>
          </div>
          <nav className="flex flex-col gap-0.5">
            {settings.map(renderItem)}
          </nav>
        </>
      )}
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "h-[calc(100vh-3.5rem)] border-r border-border bg-background transition-all duration-200 overflow-y-auto overflow-x-hidden flex-shrink-0 z-50",
          "hidden md:flex md:flex-col",
          open ? "md:w-56" : "md:w-0"
        )}
      >
        {open && (
          <>
            {logoSection}
            {navContent}
            <div className="mt-auto px-4 py-3 border-t border-border">
              <p className="font-body text-[10px] text-muted-foreground">© ২০২৬ ভেনকন</p>
            </div>
          </>
        )}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed top-14 left-0 h-[calc(100vh-3.5rem)] w-64 border-r border-border bg-background z-50 transition-transform duration-200 md:hidden overflow-y-auto flex flex-col",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            {companyLogo ? (
              <img src={companyLogo} alt="Logo" className="w-7 h-7 rounded-lg object-contain" />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-heading text-xs font-bold"
                style={{ backgroundColor: panelConfig?.color, color: "#0A0A0A" }}
              >
                {companyName.charAt(0)}
              </div>
            )}
            <span className="font-heading text-sm font-bold text-foreground">{companyName}</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {navContent}
      </aside>
    </>
  );
};

export default PanelSidebar;
