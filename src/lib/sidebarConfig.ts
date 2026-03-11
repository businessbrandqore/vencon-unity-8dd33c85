import { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CheckSquare,
  BarChart3,
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
    { titleKey: "approvals", icon: CheckSquare, path: "/sa/approvals" },
    { titleKey: "analytics", icon: BarChart3, path: "/sa/analytics" },
    { titleKey: "warehouse", icon: Package, path: "/sa/warehouse" },
    { titleKey: "budget", icon: Wallet, path: "/sa/budget" },
    { titleKey: "payroll", icon: CreditCard, path: "/sa/payroll" },
    { titleKey: "audit_logs", icon: ScrollText, path: "/sa/audit-logs" },
    { titleKey: "notifications", icon: Bell, path: "/sa/notifications" },
    { titleKey: "settings", icon: Settings, path: "/sa/settings" },
  ],
  hr: [
    { titleKey: "dashboard", icon: LayoutDashboard, path: "/hr/dashboard" },
    { titleKey: "approvals", icon: CheckSquare, path: "/hr/approvals" },
    { titleKey: "campaigns", icon: Megaphone, path: "/hr/campaigns" },
    { titleKey: "employees", icon: Users, path: "/hr/employees" },
    { titleKey: "warehouse", icon: Package, path: "/hr/warehouse" },
    { titleKey: "payroll", icon: CreditCard, path: "/hr/payroll" },
    { titleKey: "attendance_leaves", icon: Clock, path: "/hr/attendance" },
    { titleKey: "customer_feedback", icon: Star, path: "/hr/feedback" },
    { titleKey: "chat", icon: MessageSquare, path: "/hr/chat" },
    { titleKey: "notifications", icon: Bell, path: "/hr/notifications" },
    { titleKey: "documentation", icon: BookOpen, path: "/hr/documentation" },
    { titleKey: "settings", icon: Settings, path: "/hr/settings" },
  ],
  tl: [
    { titleKey: "dashboard", icon: LayoutDashboard, path: "/tl/dashboard" },
    { titleKey: "leads", icon: Target, path: "/tl/leads" },
    { titleKey: "my_team", icon: UserCheck, path: "/tl/my-team" },
    { titleKey: "analytics", icon: BarChart3, path: "/tl/analytics" },
    { titleKey: "chat", icon: MessageSquare, path: "/tl/chat" },
    { titleKey: "notifications", icon: Bell, path: "/tl/notifications" },
    { titleKey: "settings", icon: Settings, path: "/tl/settings" },
  ],
  employee: [
    { titleKey: "dashboard", icon: LayoutDashboard, path: "/employee/dashboard" },
    { titleKey: "my_leads", icon: Phone, path: "/employee/my-leads", roles: ["telesales_executive", "cso"] },
    { titleKey: "attendance", icon: Clock, path: "/employee/attendance" },
    { titleKey: "salary", icon: DollarSign, path: "/employee/salary" },
    { titleKey: "chat", icon: MessageSquare, path: "/employee/chat" },
    { titleKey: "notifications", icon: Bell, path: "/employee/notifications" },
    { titleKey: "settings", icon: Settings, path: "/employee/settings" },
  ],
};
