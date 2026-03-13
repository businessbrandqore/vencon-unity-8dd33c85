import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  targetUserId: string;
  canView: boolean; // only SA/HR/BDO/TL
}

export default function WarningLights({ targetUserId, canView }: Props) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!canView) return;
    (async () => {
      const { count: c } = await supabase
        .from("employee_complaints" as any)
        .select("id", { count: "exact", head: true })
        .eq("target_id", targetUserId)
        .eq("status", "approved");
      setCount(Math.min(c || 0, 4));
    })();
  }, [targetUserId, canView]);

  if (!canView) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-3 w-3 rounded-full border transition-all ${
                  i < count
                    ? "bg-red-500 border-red-600 shadow-[0_0_6px_rgba(239,68,68,0.7)]"
                    : "bg-muted border-border"
                }`}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>অভিযোগ: {count}/৪</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
