import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PanelType } from "@/lib/panelConfig";
import TopNav from "@/components/TopNav";
import PanelSidebar from "@/components/PanelSidebar";
import AIChatWidget from "@/components/AIChatWidget";
import ATLApprovalBanner from "@/components/ATLApprovalBanner";
import BirthdayPopup from "@/components/BirthdayPopup";
import GlobalCallListener from "@/components/GlobalCallListener";

interface DashboardLayoutInnerProps {
  panel: PanelType;
}

const DashboardLayoutInner = ({ panel }: DashboardLayoutInnerProps) => {
  const { user } = useAuth();

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

  if (!user) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex-shrink-0 z-50">
        <TopNav onToggleSidebar={toggleSidebar} />
      </div>
      <div className="flex flex-1 min-h-0">
        <PanelSidebar open={sidebarOpen} onClose={closeSidebar} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
          <div className="max-w-7xl mx-auto space-y-4">
            {panel === "tl" && <ATLApprovalBanner />}
            <Outlet />
          </div>
        </main>
      </div>
      <AIChatWidget />
      <BirthdayPopup />
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
