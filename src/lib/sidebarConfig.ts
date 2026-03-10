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
  ShoppingCart,
  Trash2,
  Phone,
  DollarSign,
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
    { titleKey: "audit_logs", icon: ScrollText, path: "/sa/audit-logs" },
    { titleKey: "settings", icon: Settings, path: "/sa/settings" },
  ],
  hr: [
    { titleKey: "dashboard", icon: LayoutDashboard, path: "/hr/dashboard" },
    { titleKey: "campaigns", icon: Megaphone, path: "/hr/campaigns" },
    { titleKey: "employees", icon: Users, path: "/hr/employees" },
    { titleKey: "payroll", icon: CreditCard, path: "/hr/payroll" },
    { titleKey: "attendance", icon: Clock, path: "/hr/attendance" },
    { titleKey: "leaves", icon: CalendarOff, path: "/hr/leaves" },
    { titleKey: "chat", icon: MessageSquare, path: "/hr/chat" },
    { titleKey: "settings", icon: Settings, path: "/hr/settings" },
  ],
  tl: [
    { titleKey: "dashboard", icon: LayoutDashboard, path: "/tl/dashboard" },
    { titleKey: "leads", icon: Target, path: "/tl/leads" },
    { titleKey: "my_team", icon: UserCheck, path: "/tl/my-team" },
    { titleKey: "analytics", icon: BarChart3, path: "/tl/analytics" },
    { titleKey: "chat", icon: MessageSquare, path: "/tl/chat" },
  ],
  employee: [
    { titleKey: "dashboard", icon: LayoutDashboard, path: "/employee/dashboard" },
    { titleKey: "my_leads", icon: Phone, path: "/employee/my-leads", roles: ["telesales_executive", "cso"] },
    { titleKey: "attendance", icon: Clock, path: "/employee/attendance" },
    { titleKey: "salary", icon: DollarSign, path: "/employee/salary" },
    { titleKey: "chat", icon: MessageSquare, path: "/employee/chat" },
  ],
};
