export type PanelType = "sa" | "hr" | "tl" | "employee";

export interface PanelConfig {
  type: PanelType;
  nameKey: string;
  descKey: string;
  color: string;
  cssVar: string;
  loginPath: string;
  dashboardPath: string;
}

export const panels: PanelConfig[] = [
  {
    type: "sa",
    nameKey: "sa_panel",
    descKey: "sa_desc",
    color: "#0D9488",
    cssVar: "var(--panel-sa)",
    loginPath: "/sa/login",
    dashboardPath: "/sa/dashboard",
  },
  {
    type: "hr",
    nameKey: "hr_panel",
    descKey: "hr_desc",
    color: "#1D4ED8",
    cssVar: "var(--panel-hr)",
    loginPath: "/hr/login",
    dashboardPath: "/hr/dashboard",
  },
  {
    type: "tl",
    nameKey: "tl_panel",
    descKey: "tl_desc",
    color: "#7C3AED",
    cssVar: "var(--panel-tl)",
    loginPath: "/tl/login",
    dashboardPath: "/tl/dashboard",
  },
  {
    type: "employee",
    nameKey: "employee_panel",
    descKey: "employee_desc",
    color: "#EA580C",
    cssVar: "var(--panel-employee)",
    loginPath: "/employee/login",
    dashboardPath: "/employee/dashboard",
  },
];

export const getPanelByType = (type: PanelType): PanelConfig | undefined =>
  panels.find((p) => p.type === type);
