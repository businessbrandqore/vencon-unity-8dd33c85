import { useAuth } from "@/contexts/AuthContext";
import AttendanceGate from "@/components/AttendanceGate";
import EmployeeTSDashboard from "./EmployeeTSDashboard";
import WarehouseAssistantDashboard from "./WarehouseAssistantDashboard";
import WarehouseSupervisorDashboard from "./WarehouseSupervisorDashboard";
import InventoryManagerDashboard from "./InventoryManagerDashboard";
import CSExecutiveDashboard from "./CSExecutiveDashboard";
import CSODashboard from "./CSODashboard";
import DeliveryCoordinatorDashboard from "./DeliveryCoordinatorDashboard";
import GroupLeaderDashboard from "./GroupLeaderDashboard";
import MaintenanceOfficerDashboard from "./MaintenanceOfficerDashboard";
import OfficeAssistantDashboard from "./OfficeAssistantDashboard";

// Roles that bypass AttendanceGate (warehouse roles work on dispatch floor, not desk)
const GATE_EXEMPT_ROLES = ["warehouse_assistant", "warehouse_supervisor", "inventory_manager", "maintenance_officer", "office_assistant"];

export default function EmployeeDashboardRouter() {
  const { user } = useAuth();

  if (!user) return null;

  // TS/Silver/Golden dashboard handles its own attendance flow internally
  if (user.role === "telesales_executive" || user.role === "silver_agent" || user.role === "golden_agent") {
    return <EmployeeTSDashboard />;
  }

  const getDashboard = () => {
    switch (user.role) {
      case "warehouse_assistant":
        return <WarehouseAssistantDashboard />;
      case "warehouse_supervisor":
        return <WarehouseSupervisorDashboard />;
      case "inventory_manager":
        return <InventoryManagerDashboard />;
      case "cs_executive":
        return <CSExecutiveDashboard />;
      case "cso":
        return <CSODashboard />;
      case "delivery_coordinator":
        return <DeliveryCoordinatorDashboard />;
      case "group_leader":
        return <GroupLeaderDashboard />;
      case "maintenance_officer":
        return <MaintenanceOfficerDashboard />;
      case "office_assistant":
        return <OfficeAssistantDashboard />;
      default:
        // Default uses EmployeeTSDashboard which handles attendance internally
        return null;
    }
  };

  // Warehouse roles skip AttendanceGate
  if (GATE_EXEMPT_ROLES.includes(user.role)) {
    return getDashboard();
  }

  return <AttendanceGate>{getDashboard()}</AttendanceGate>;
}
