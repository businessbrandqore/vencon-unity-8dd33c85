import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import PanelLogin from "./pages/PanelLogin";
import DashboardLayout from "./layouts/DashboardLayout";
import EmployeeDashboardRouter from "./pages/dashboard/EmployeeDashboardRouter";
import SADashboard from "./pages/dashboard/SADashboard";
import SAApprovalsPage from "./pages/dashboard/SAApprovalsPage";
import SAAuditLogs from "./pages/dashboard/SAAuditLogs";
import SAAnalytics from "./pages/dashboard/SAAnalytics";
import SAWarehouse from "./pages/dashboard/SAWarehouse";
import SABudget from "./pages/dashboard/SABudget";
import SASettings from "./pages/dashboard/SASettings";
import SAAllData from "./pages/dashboard/SAAllData";
import SAPayroll from "./pages/dashboard/SAPayroll";
import HRDashboard from "./pages/dashboard/HRDashboard";
import HRCampaigns from "./pages/dashboard/HRCampaigns";
import HREmployees from "./pages/dashboard/HREmployees";
import HREmployeeNew from "./pages/dashboard/HREmployeeNew";
import HREmployeeProfile from "./pages/dashboard/HREmployeeProfile";
import HRPayroll from "./pages/dashboard/HRPayroll";
import HRAttendance from "./pages/dashboard/HRAttendance";
import HRLeaves from "./pages/dashboard/HRLeaves";
import HRSettings from "./pages/dashboard/HRSettings";
import HRCampaignIntegration from "./pages/dashboard/HRCampaignIntegration";
import HRLeadImport from "./pages/dashboard/HRLeadImport";
import HRApprovals from "./pages/dashboard/HRApprovals";
import HRWarehouse from "./pages/dashboard/HRWarehouse";
import HRDataMonitor from "./pages/dashboard/HRDataMonitor";
import HRFeedback from "./pages/dashboard/HRFeedback";
import HRChatAdmin from "./pages/dashboard/HRChatAdmin";
import WebhookDocumentation from "./pages/dashboard/WebhookDocumentation";
import TLDashboard from "./pages/dashboard/TLDashboard";
import TLLeads from "./pages/dashboard/TLLeads";
import TLTeam from "./pages/dashboard/TLTeam";
import TLAnalytics from "./pages/dashboard/TLAnalytics";
import EmployeeAttendance from "./pages/dashboard/EmployeeAttendance";
import EmployeeSalary from "./pages/dashboard/EmployeeSalary";
import EmployeeLeads from "./pages/dashboard/EmployeeLeads";
import ProfileSettings from "./pages/dashboard/ProfileSettings";
import EmployeeMyOrders from "./pages/dashboard/EmployeeMyOrders";
import DataTracker from "./pages/dashboard/DataTracker";
import ManagerAttendance from "./pages/dashboard/ManagerAttendance";
import NotificationsPage from "./pages/dashboard/NotificationsPage";
import ChatPage from "./pages/dashboard/ChatPage";
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
              <Route path="/sa/approvals" element={<SAApprovalsPage />} />
              <Route path="/sa/analytics" element={<SAAnalytics />} />
              <Route path="/sa/warehouse" element={<SAWarehouse />} />
              <Route path="/sa/budget" element={<SABudget />} />
              <Route path="/sa/payroll" element={<SAPayroll />} />
              <Route path="/sa/audit-logs" element={<SAAuditLogs />} />
              <Route path="/sa/all-data" element={<SAAllData />} />
              <Route path="/sa/data-tracker" element={<DataTracker />} />
              <Route path="/sa/attendance" element={<ManagerAttendance />} />
              <Route path="/sa/settings" element={<SASettings />} />
              <Route path="/sa/notifications" element={<NotificationsPage />} />
              <Route path="/sa/profile" element={<ProfileSettings />} />
            </Route>

            {/* HR Panel Routes */}
            <Route element={<DashboardLayout panel="hr" />}>
              <Route path="/hr/dashboard" element={<HRDashboard />} />
              <Route path="/hr/approvals" element={<HRApprovals />} />
              <Route path="/hr/campaigns" element={<HRCampaigns />} />
              <Route path="/hr/employees" element={<HREmployees />} />
              <Route path="/hr/employees/new" element={<HREmployeeNew />} />
              <Route path="/hr/employees/:id" element={<HREmployeeProfile />} />
              <Route path="/hr/payroll" element={<HRPayroll />} />
              <Route path="/hr/attendance" element={<HRAttendance />} />
              <Route path="/hr/leaves" element={<HRLeaves />} />
              <Route path="/hr/chat" element={<ChatPage />} />
              <Route path="/hr/chat-admin" element={<HRChatAdmin />} />
              <Route path="/hr/campaigns/:id/integration" element={<HRCampaignIntegration />} />
              <Route path="/hr/leads/import" element={<HRLeadImport />} />
              <Route path="/hr/warehouse" element={<HRWarehouse />} />
              <Route path="/hr/data-monitor" element={<HRDataMonitor />} />
              <Route path="/hr/data-tracker" element={<DataTracker />} />
              <Route path="/hr/feedback" element={<HRFeedback />} />
              <Route path="/hr/documentation" element={<WebhookDocumentation />} />
              <Route path="/hr/settings" element={<HRSettings />} />
              <Route path="/hr/notifications" element={<NotificationsPage />} />
              <Route path="/hr/profile" element={<ProfileSettings />} />
            </Route>

            {/* TL Panel Routes */}
            <Route element={<DashboardLayout panel="tl" />}>
              <Route path="/tl/dashboard" element={<TLDashboard />} />
              <Route path="/tl/leads" element={<TLLeads />} />
              <Route path="/tl/data-tracker" element={<DataTracker />} />
              <Route path="/tl/my-team" element={<TLTeam />} />
              <Route path="/tl/analytics" element={<TLAnalytics />} />
              <Route path="/tl/chat" element={<ChatPage />} />
              <Route path="/tl/notifications" element={<NotificationsPage />} />
              <Route path="/tl/settings" element={<ProfileSettings />} />
              <Route path="/tl/profile" element={<ProfileSettings />} />
            </Route>

            {/* Employee Panel Routes */}
            <Route element={<DashboardLayout panel="employee" />}>
              <Route path="/employee/dashboard" element={<EmployeeDashboardRouter />} />
              <Route path="/employee/leads" element={<EmployeeLeads />} />
              <Route path="/employee/my-orders" element={<EmployeeMyOrders />} />
              <Route path="/employee/attendance" element={<EmployeeAttendance />} />
              <Route path="/employee/salary" element={<EmployeeSalary />} />
              <Route path="/employee/chat" element={<ChatPage />} />
              <Route path="/employee/notifications" element={<NotificationsPage />} />
              <Route path="/employee/settings" element={<ProfileSettings />} />
              <Route path="/employee/profile" element={<ProfileSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
