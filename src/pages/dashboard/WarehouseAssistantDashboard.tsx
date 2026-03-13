import SalaryCard from "@/components/SalaryCard";
import WarehouseDispatch from "@/components/WarehouseDispatch";

export default function WarehouseAssistantDashboard() {
  return (
    <div className="space-y-6">
      <SalaryCard />
      <WarehouseDispatch showStock={false} />
    </div>
  );
}
