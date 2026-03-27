import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, CheckCircle, XCircle, HelpCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadRatioBarProps {
  total: number | null;
  success: number | null;
  cancel: number | null;
  error: string | null;
  checkedAt: string | null;
  className?: string;
}

export default function LeadRatioBar({ total, success, cancel, error, checkedAt, className }: LeadRatioBarProps) {
  // Not checked yet
  if (!checkedAt && !error) {
    return (
      <div className={cn("flex items-center gap-1 text-[10px] text-muted-foreground", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>চেক হচ্ছে...</span>
      </div>
    );
  }

  // Error case
  if (error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1 text-[10px] text-destructive cursor-help", className)}>
              <AlertTriangle className="h-3 w-3" />
              <span>চেক ব্যর্থ</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[250px]">
            <p className="text-xs font-medium">ফ্রড চেক ব্যর্থ হয়েছে</p>
            <p className="text-[10px] text-muted-foreground mt-1">{error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // No data from courier
  if (total === 0 || total === null) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1 text-[10px] text-blue-500 cursor-help", className)}>
              <HelpCircle className="h-3 w-3" />
              <span>নতুন কাস্টমার</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">কুরিয়ারে কোনো হিস্টোরি পাওয়া যায়নি</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const successCount = success || 0;
  const cancelCount = cancel || 0;
  const successPct = Math.round((successCount / total) * 100);
  const cancelPct = Math.round((cancelCount / total) * 100);

  // Risk color
  let barColor = "bg-emerald-500";
  let riskIcon = <CheckCircle className="h-3 w-3 text-emerald-500" />;
  if (successPct < 40) {
    barColor = "bg-red-500";
    riskIcon = <XCircle className="h-3 w-3 text-red-500" />;
  } else if (successPct < 60) {
    barColor = "bg-orange-500";
    riskIcon = <AlertTriangle className="h-3 w-3 text-orange-500" />;
  } else if (successPct < 80) {
    barColor = "bg-yellow-500";
    riskIcon = <AlertTriangle className="h-3 w-3 text-yellow-500" />;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("space-y-0.5 cursor-help min-w-[100px]", className)}>
            {/* Bar */}
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
              {successPct > 0 && (
                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${successPct}%` }} />
              )}
              {cancelPct > 0 && (
                <div className="bg-red-500 h-full transition-all" style={{ width: `${cancelPct}%` }} />
              )}
            </div>
            {/* Stats */}
            <div className="flex items-center gap-1 text-[10px]">
              {riskIcon}
              <span className="text-muted-foreground">
                Total: <span className="text-foreground font-medium">{total}</span>
                {" "}Success: <span className="text-emerald-600 font-medium">{successCount}</span>
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground pl-4">
              Cancel: <span className="text-red-500 font-medium">{cancelCount}</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs font-medium">কুরিয়ার রেশিও</p>
          <p className="text-[10px]">সাকসেস: {successPct}% | ক্যানসেল: {cancelPct}%</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
