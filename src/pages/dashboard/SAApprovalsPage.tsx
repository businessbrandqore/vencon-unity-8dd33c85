import SAApprovalsTable from "@/components/sa/SAApprovalsTable";
import { CheckSquare } from "lucide-react";

export default function SAApprovalsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl flex items-center gap-2">
        <CheckSquare className="h-5 w-5 text-primary" /> Approvals
      </h1>
      <SAApprovalsTable />
    </div>
  );
}
