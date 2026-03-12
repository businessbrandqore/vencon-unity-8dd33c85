import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DeductionConfig {
  late_checkin_amount: number;
  early_checkout_amount: number;
}

const DEFAULT_CONFIG: DeductionConfig = {
  late_checkin_amount: 33,
  early_checkout_amount: 33,
};

export function useDeductionConfig() {
  const [config, setConfig] = useState<DeductionConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "attendance_deduction_config")
        .maybeSingle();
      if (data?.value) {
        const val = data.value as Record<string, number>;
        setConfig({
          late_checkin_amount: val.late_checkin_amount ?? 33,
          early_checkout_amount: val.early_checkout_amount ?? 33,
        });
      }
    })();
  }, []);

  return config;
}
