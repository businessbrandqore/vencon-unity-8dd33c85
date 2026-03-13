import SalaryCard from "@/components/SalaryCard";
import WarehouseDispatch from "@/components/WarehouseDispatch";

export default function WarehouseSupervisorDashboard() {
  return (
    <div className="space-y-6">
      <SalaryCard />
      <WarehouseDispatch showStock={false} />
    </div>
  );
}
