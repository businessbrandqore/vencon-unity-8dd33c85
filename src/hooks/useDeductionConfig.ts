import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DeductionTier {
  min_minutes: number;
  max_minutes: number;
  amount: number;
}

export interface DeductionConfig {
  late_tiers: DeductionTier[];
  early_tiers: DeductionTier[];
  break_tiers: DeductionTier[];
}

const DEFAULT_CONFIG: DeductionConfig = {
  late_tiers: [{ min_minutes: 1, max_minutes: 9999, amount: 33 }],
  early_tiers: [{ min_minutes: 1, max_minutes: 9999, amount: 33 }],
  break_tiers: [{ min_minutes: 31, max_minutes: 9999, amount: 20 }],
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
        const val = data.value as any;
        if (val?.late_tiers && val?.early_tiers) {
          setConfig({
            late_tiers: val.late_tiers,
            early_tiers: val.early_tiers,
            break_tiers: val.break_tiers || DEFAULT_CONFIG.break_tiers,
          });
        } else if (val?.late_checkin_amount) {
          // Legacy format
          setConfig({
            late_tiers: [{ min_minutes: 1, max_minutes: 9999, amount: Number(val.late_checkin_amount) || 33 }],
            early_tiers: [{ min_minutes: 1, max_minutes: 9999, amount: Number(val.early_checkout_amount) || 33 }],
            break_tiers: DEFAULT_CONFIG.break_tiers,
          });
        }
      }
    })();
  }, []);

  return config;
}

export function getDeductionAmount(tiers: DeductionTier[], minutesDiff: number): number {
  if (minutesDiff <= 0) return 0;
  for (const tier of tiers) {
    if (minutesDiff >= tier.min_minutes && minutesDiff <= tier.max_minutes) {
      return tier.amount;
    }
  }
  // If no tier matches, use the last tier's amount
  return tiers.length > 0 ? tiers[tiers.length - 1].amount : 33;
}
