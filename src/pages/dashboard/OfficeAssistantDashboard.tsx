import SalaryCard from "@/components/SalaryCard";
import { Briefcase } from "lucide-react";

export default function OfficeAssistantDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
        <h1 className="font-heading text-xl">Office Assistant Dashboard</h1>
      </div>
      <SalaryCard />
      <div className="text-center py-12 text-muted-foreground">
        <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">আপনার চেক ইন/আউট এবং বেতন সাইডবার মেনু থেকে দেখতে পারবেন।</p>
      </div>
    </div>
  );
}
