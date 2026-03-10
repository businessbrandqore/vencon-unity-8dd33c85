import { useAuth } from "@/contexts/AuthContext";
import EmployeeTSDashboard from "./EmployeeTSDashboard";
import WarehouseAssistantDashboard from "./WarehouseAssistantDashboard";
import WarehouseSupervisorDashboard from "./WarehouseSupervisorDashboard";
import InventoryManagerDashboard from "./InventoryManagerDashboard";

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
    default:
      return <EmployeeTSDashboard />;
  }
}
