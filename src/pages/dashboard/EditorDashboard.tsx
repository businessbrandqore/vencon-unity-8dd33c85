import SalaryCard from "@/components/SalaryCard";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle } from "lucide-react";

export default function EditorDashboard() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <SalaryCard />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <Clock className="h-10 w-10 mx-auto text-primary mb-2" />
            <h3 className="font-heading font-bold text-lg">আজকের উপস্থিতি</h3>
            <p className="text-sm text-muted-foreground font-body mt-1">
              চেক ইন ও চেক আউট করুন
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-2" />
            <h3 className="font-heading font-bold text-lg">স্বাগতম, {user.name}!</h3>
            <p className="text-sm text-muted-foreground font-body mt-1">
              আপনার Editor ড্যাশবোর্ড
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
