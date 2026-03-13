import { useAuth } from "@/contexts/AuthContext";
import EmployeeLeads from "./EmployeeLeads";
import CSOLeads from "./CSOLeads";

export default function EmployeeLeadsRouter() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === "cso") {
    return <CSOLeads />;
  }

  return <EmployeeLeads />;
}
