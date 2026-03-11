import { useAuth } from "@/contexts/AuthContext";
import AttendanceGate from "@/components/AttendanceGate";
import EmployeeTSDashboard from "./EmployeeTSDashboard";
import WarehouseAssistantDashboard from "./WarehouseAssistantDashboard";
import WarehouseSupervisorDashboard from "./WarehouseSupervisorDashboard";
import InventoryManagerDashboard from "./InventoryManagerDashboard";
import CSExecutiveDashboard from "./CSExecutiveDashboard";
import DeliveryCoordinatorDashboard from "./DeliveryCoordinatorDashboard";
import GroupLeaderDashboard from "./GroupLeaderDashboard";
import MaintenanceOfficerDashboard from "./MaintenanceOfficerDashboard";

export default function EmployeeDashboardRouter() {
  const { user } = useAuth();

  if (!user) return null;

  // TS dashboard handles its own attendance flow internally
  if (user.role === "telesales_executive" || user.role === "assistant_team_leader") {
    return <EmployeeTSDashboard />;
  }

  // All other roles use AttendanceGate wrapper
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
      case "delivery_coordinator":
        return <DeliveryCoordinatorDashboard />;
      case "group_leader":
        return <GroupLeaderDashboard />;
      case "maintenance_officer":
        return <MaintenanceOfficerDashboard />;
      default:
        return <EmployeeTSDashboard />;
    }
  };

  return <AttendanceGate>{getDashboard()}</AttendanceGate>;
}
