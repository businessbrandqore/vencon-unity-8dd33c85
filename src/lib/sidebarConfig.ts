import { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CheckSquare,
  BarChart3,
  Database,
  Package,
  Wallet,
  ScrollText,
  Settings,
  Megaphone,
  Users,
  CreditCard,
  Clock,
  CalendarOff,
  MessageSquare,
  Target,
  UserCheck,
  Phone,
  DollarSign,
  Bell,
  Gift,
  Star,
  BookOpen,
} from "lucide-react";
import { PanelType } from "./panelConfig";

export interface SidebarItem {
  titleKey: string;
  icon: LucideIcon;
  path: string;
  /** If set, only show for these roles */
  roles?: string[];
}

export const sidebarMenus: Record<PanelType, SidebarItem[]> = {
  sa: [
    { titleKey: "dashboard", icon: LayoutDashboard, path: "/sa/dashboard" },
    { titleKey: "all_data", icon: Target, path: "/sa/all-data" },
    { titleKey: "data_tracker", icon: BarChart3, path: "/sa/data-tracker" },
    { titleKey: "approvals", icon: CheckSquare, path: "/sa/approvals" },
    { titleKey: "analytics", icon: BarChart3, path: "/sa/analytics" },
    { titleKey: "warehouse", icon: Package, path: "/sa/warehouse" },
    { titleKey: "budget", icon: Wallet, path: "/sa/budget" },
    { titleKey: "payroll", icon: CreditCard, path: "/sa/payroll" },
    { titleKey: "attendance", icon: Clock, path: "/sa/attendance" },
    { titleKey: "audit_logs", icon: ScrollText, path: "/sa/audit-logs" },
    { titleKey: "notifications", icon: Bell, path: "/sa/notifications" },
    { titleKey: "settings", icon: Settings, path: "/sa/settings" },
  ],
  hr: [
    { titleKey: "dashboard", icon: LayoutDashboard, path: "/hr/dashboard" },
    { titleKey: "approvals", icon: CheckSquare, path: "/hr/approvals" },
    { titleKey: "campaigns", icon: Megaphone, path: "/hr/campaigns" },
    { titleKey: "employees", icon: Users, path: "/hr/employees" },
    { titleKey: "data_monitor", icon: Target, path: "/hr/data-monitor" },
    { titleKey: "data_tracker", icon: BarChart3, path: "/hr/data-tracker" },
    { titleKey: "warehouse", icon: Package, path: "/hr/warehouse" },
    { titleKey: "payroll", icon: CreditCard, path: "/hr/payroll" },
    { titleKey: "attendance_leaves", icon: Clock, path: "/hr/attendance" },
    { titleKey: "my_attendance", icon: Clock, path: "/hr/my-attendance" },
    { titleKey: "customer_feedback", icon: Star, path: "/hr/feedback" },
    { titleKey: "chat", icon: MessageSquare, path: "/hr/chat" },
    { titleKey: "notifications", icon: Bell, path: "/hr/notifications" },
    { titleKey: "documentation", icon: BookOpen, path: "/hr/documentation" },
    { titleKey: "settings", icon: Settings, path: "/hr/settings" },
  ],
  tl: [
    { titleKey: "dashboard", icon: LayoutDashboard, path: "/tl/dashboard" },
    { titleKey: "leads", icon: Target, path: "/tl/leads" },
    { titleKey: "my_orders", icon: Package, path: "/tl/my-orders", roles: ["assistant_team_leader"] },
    { titleKey: "data_tracker", icon: BarChart3, path: "/tl/data-tracker", roles: ["team_leader", "Business Development And Marketing Manager"] },
    { titleKey: "data_requests", icon: Database, path: "/tl/data-requests", roles: ["team_leader", "Business Development And Marketing Manager"] },
    { titleKey: "my_team", icon: UserCheck, path: "/tl/my-team", roles: ["team_leader", "Business Development And Marketing Manager"] },
    { titleKey: "analytics", icon: BarChart3, path: "/tl/analytics", roles: ["team_leader", "Business Development And Marketing Manager"] },
    { titleKey: "agent_assignment", icon: UserCheck, path: "/tl/agent-assignment", roles: ["Business Development And Marketing Manager"] },
    { titleKey: "attendance", icon: Clock, path: "/tl/attendance" },
    { titleKey: "salary", icon: DollarSign, path: "/tl/salary", roles: ["assistant_team_leader"] },
    { titleKey: "chat", icon: MessageSquare, path: "/tl/chat" },
    { titleKey: "notifications", icon: Bell, path: "/tl/notifications" },
    { titleKey: "settings", icon: Settings, path: "/tl/settings" },
  ],
  employee: [
    { titleKey: "dashboard", icon: LayoutDashboard, path: "/employee/dashboard" },
    { titleKey: "leads", icon: Target, path: "/employee/leads", roles: ["telesales_executive", "assistant_team_leader"] },
    { titleKey: "my_orders", icon: Package, path: "/employee/my-orders", roles: ["telesales_executive", "assistant_team_leader"] },
    { titleKey: "attendance", icon: Clock, path: "/employee/attendance" },
    { titleKey: "salary", icon: DollarSign, path: "/employee/salary" },
    { titleKey: "chat", icon: MessageSquare, path: "/employee/chat" },
    { titleKey: "notifications", icon: Bell, path: "/employee/notifications" },
    { titleKey: "settings", icon: Settings, path: "/employee/settings" },
  ],
};
