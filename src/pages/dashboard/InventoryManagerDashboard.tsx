import SalaryCard from "@/components/SalaryCard";
import WarehouseDispatch from "@/components/WarehouseDispatch";

export default function InventoryManagerDashboard() {
  return (
    <div className="space-y-6">
      <SalaryCard />
      <WarehouseDispatch showStock={true} />
    </div>
  );
}
