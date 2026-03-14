import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AttendanceGate from "@/components/AttendanceGate";

// Roles that don't need attendance check
const GATE_EXEMPT_ROLES = [
  "warehouse_assistant",
  "warehouse_supervisor",
  "inventory_manager",
  "maintenance_officer",
  "office_assistant",
];

interface Props {
  children: ReactNode;
}

export default function AttendanceGatedRoute({ children }: Props) {
  const { user } = useAuth();

  if (!user) return null;

  // Exempt roles skip the gate
  if (GATE_EXEMPT_ROLES.includes(user.role)) {
    return <>{children}</>;
  }

  return <AttendanceGate>{children}</AttendanceGate>;
}
