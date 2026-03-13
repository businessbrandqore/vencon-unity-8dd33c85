import WarehouseDispatch from "@/components/WarehouseDispatch";
import { useAuth } from "@/contexts/AuthContext";

export default function WarehouseDispatchPage() {
  const { user } = useAuth();
  if (!user) return null;
  
  const showStock = user.role === "inventory_manager";
  
  return <WarehouseDispatch showStock={showStock} />;
}
