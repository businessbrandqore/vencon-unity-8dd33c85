import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { PanelType } from "@/lib/panelConfig";
import TopNav from "@/components/TopNav";
import PanelSidebar from "@/components/PanelSidebar";
import AIChatWidget from "@/components/AIChatWidget";

interface DashboardLayoutInnerProps {
  panel: PanelType;
}

const DashboardLayoutInner = ({ panel }: DashboardLayoutInnerProps) => {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  const storageKey = `vencon_sidebar_${panel}`;
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(sidebarOpen));
  }, [sidebarOpen, storageKey]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-body text-sm text-muted-foreground">{t("checking_access")}</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav onToggleSidebar={toggleSidebar} />
      <div className="flex flex-1 overflow-hidden">
        <PanelSidebar open={sidebarOpen} onClose={closeSidebar} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <AIChatWidget />
    </div>
  );
};

const DashboardLayout = ({ panel }: { panel: PanelType }) => {
  return (
    <AuthProvider requiredPanel={panel}>
      <DashboardLayoutInner panel={panel} />
    </AuthProvider>
  );
};

export default DashboardLayout;
