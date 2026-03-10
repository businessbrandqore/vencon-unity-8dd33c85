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
import EmployeeDashboardRouter from "./pages/dashboard/EmployeeDashboardRouter";
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
import HRPayroll from "./pages/dashboard/HRPayroll";
import HRAttendance from "./pages/dashboard/HRAttendance";
import HRLeaves from "./pages/dashboard/HRLeaves";
import HRSettings from "./pages/dashboard/HRSettings";
import TLDashboard from "./pages/dashboard/TLDashboard";
import TLLeads from "./pages/dashboard/TLLeads";
import TLTeam from "./pages/dashboard/TLTeam";
import TLAnalytics from "./pages/dashboard/TLAnalytics";
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
              <Route path="/hr/payroll" element={<HRPayroll />} />
              <Route path="/hr/attendance" element={<HRAttendance />} />
              <Route path="/hr/leaves" element={<HRLeaves />} />
              <Route path="/hr/chat" element={<PlaceholderPage titleKey="chat" />} />
              <Route path="/hr/settings" element={<HRSettings />} />
              <Route path="/hr/profile" element={<PlaceholderPage titleKey="profile" />} />
            </Route>

            {/* TL Panel Routes */}
            <Route element={<DashboardLayout panel="tl" />}>
              <Route path="/tl/dashboard" element={<TLDashboard />} />
              <Route path="/tl/leads" element={<TLLeads />} />
              <Route path="/tl/my-team" element={<TLTeam />} />
              <Route path="/tl/analytics" element={<TLAnalytics />} />
              <Route path="/tl/chat" element={<PlaceholderPage titleKey="chat" />} />
              <Route path="/tl/profile" element={<PlaceholderPage titleKey="profile" />} />
            </Route>

            {/* Employee Panel Routes */}
            <Route element={<DashboardLayout panel="employee" />}>
              <Route path="/employee/dashboard" element={<EmployeeDashboardRouter />} />
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
