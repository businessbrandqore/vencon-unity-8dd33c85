import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import PanelLogin from "./pages/PanelLogin";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import SADashboard from "./pages/dashboard/SADashboard";
import SAAnalytics from "./pages/dashboard/SAAnalytics";
import SAWarehouse from "./pages/dashboard/SAWarehouse";
import SABudget from "./pages/dashboard/SABudget";
import SASettings from "./pages/dashboard/SASettings";
import HRDashboard from "./pages/dashboard/HRDashboard";
import HRCampaigns from "./pages/dashboard/HRCampaigns";
import HREmployees from "./pages/dashboard/HREmployees";
import HREmployeeNew from "./pages/dashboard/HREmployeeNew";
import HREmployeeProfile from "./pages/dashboard/HREmployeeProfile";
import PlaceholderPage from "./pages/dashboard/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/:panel/login" element={<PanelLogin />} />

            {/* SA Panel Routes */}
            <Route element={<DashboardLayout panel="sa" />}>
              <Route path="/sa/dashboard" element={<SADashboard />} />
              <Route path="/sa/approvals" element={<PlaceholderPage titleKey="approvals" />} />
              <Route path="/sa/analytics" element={<SAAnalytics />} />
              <Route path="/sa/warehouse" element={<SAWarehouse />} />
              <Route path="/sa/budget" element={<SABudget />} />
              <Route path="/sa/audit-logs" element={<PlaceholderPage titleKey="audit_logs" />} />
              <Route path="/sa/settings" element={<SASettings />} />
              <Route path="/sa/profile" element={<PlaceholderPage titleKey="profile" />} />
            </Route>

            {/* HR Panel Routes */}
            <Route element={<DashboardLayout panel="hr" />}>
              <Route path="/hr/dashboard" element={<HRDashboard />} />
              <Route path="/hr/campaigns" element={<HRCampaigns />} />
              <Route path="/hr/employees" element={<HREmployees />} />
              <Route path="/hr/employees/new" element={<HREmployeeNew />} />
              <Route path="/hr/employees/:id" element={<HREmployeeProfile />} />
              <Route path="/hr/payroll" element={<PlaceholderPage titleKey="payroll" />} />
              <Route path="/hr/attendance" element={<PlaceholderPage titleKey="attendance" />} />
              <Route path="/hr/leaves" element={<PlaceholderPage titleKey="leaves" />} />
              <Route path="/hr/chat" element={<PlaceholderPage titleKey="chat" />} />
              <Route path="/hr/settings" element={<PlaceholderPage titleKey="settings" />} />
              <Route path="/hr/profile" element={<PlaceholderPage titleKey="profile" />} />
            </Route>

            {/* TL Panel Routes */}
            <Route element={<DashboardLayout panel="tl" />}>
              <Route path="/tl/dashboard" element={<DashboardHome />} />
              <Route path="/tl/leads" element={<PlaceholderPage titleKey="leads" />} />
              <Route path="/tl/my-team" element={<PlaceholderPage titleKey="my_team" />} />
              <Route path="/tl/pre-orders" element={<PlaceholderPage titleKey="pre_orders" />} />
              <Route path="/tl/delete-sheet" element={<PlaceholderPage titleKey="delete_sheet" />} />
              <Route path="/tl/analytics" element={<PlaceholderPage titleKey="analytics" />} />
              <Route path="/tl/chat" element={<PlaceholderPage titleKey="chat" />} />
              <Route path="/tl/profile" element={<PlaceholderPage titleKey="profile" />} />
            </Route>

            {/* Employee Panel Routes */}
            <Route element={<DashboardLayout panel="employee" />}>
              <Route path="/employee/dashboard" element={<DashboardHome />} />
              <Route path="/employee/my-leads" element={<PlaceholderPage titleKey="my_leads" />} />
              <Route path="/employee/attendance" element={<PlaceholderPage titleKey="attendance" />} />
              <Route path="/employee/salary" element={<PlaceholderPage titleKey="salary" />} />
              <Route path="/employee/chat" element={<PlaceholderPage titleKey="chat" />} />
              <Route path="/employee/profile" element={<PlaceholderPage titleKey="profile" />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
