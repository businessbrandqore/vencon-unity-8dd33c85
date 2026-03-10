import { useAuth } from "@/contexts/AuthContext";
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
}
