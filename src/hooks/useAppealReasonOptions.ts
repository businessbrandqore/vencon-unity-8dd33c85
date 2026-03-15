import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppealReasonConfig {
  attendance_reasons: string[];
  leave_reasons: string[];
}

const DEFAULT_CONFIG: AppealReasonConfig = {
  attendance_reasons: [],
  leave_reasons: [],
};

export function useAppealReasonOptions() {
  const [config, setConfig] = useState<AppealReasonConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "appeal_reason_options")
        .maybeSingle();
      if (data?.value) {
        const val = data.value as any;
        setConfig({
          attendance_reasons: val?.attendance_reasons || [],
          leave_reasons: val?.leave_reasons || [],
        });
      }
    })();
  }, []);

  return config;
}
