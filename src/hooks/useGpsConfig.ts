import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GpsConfig {
  latitude: number;
  longitude: number;
  radius_meters: number;
  enabled: boolean;
}

const DEFAULT_GPS: GpsConfig = {
  latitude: 0,
  longitude: 0,
  radius_meters: 500,
  enabled: false,
};

/**
 * Calculate distance in meters between two lat/lng points using Haversine formula
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useGpsConfig() {
  const [config, setConfig] = useState<GpsConfig>(DEFAULT_GPS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "gps_config")
        .maybeSingle();
      if (data?.value) {
        const val = data.value as any;
        setConfig({
          latitude: val.latitude ?? 0,
          longitude: val.longitude ?? 0,
          radius_meters: val.radius_meters ?? 500,
          enabled: val.enabled ?? false,
        });
      }
      setLoading(false);
    })();
  }, []);

  return { config, loading };
}

export interface GpsValidationResult {
  allowed: boolean;
  distance: number | null;
  error: string | null;
  errorBn: string | null;
}

/**
 * Validate user's current GPS position against configured office location.
 * Returns a promise that resolves with the result.
 */
export async function validateGpsPosition(config: GpsConfig): Promise<GpsValidationResult> {
  if (!config.enabled || (config.latitude === 0 && config.longitude === 0)) {
    // GPS not configured — block and ask HR to set it
    return {
      allowed: false,
      distance: null,
      error: "GPS location not configured. Please ask HR to set the office location.",
      errorBn: "GPS লোকেশন সেট করা নেই। HR-কে অফিসের লোকেশন সেট করতে বলুন।",
    };
  }

  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        allowed: false,
        distance: null,
        error: "GPS is not supported in this browser.",
        errorBn: "এই ব্রাউজারে GPS সাপোর্ট করে না।",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const dist = haversineDistance(
          config.latitude,
          config.longitude,
          position.coords.latitude,
          position.coords.longitude
        );
        if (dist <= config.radius_meters) {
          resolve({ allowed: true, distance: Math.round(dist), error: null, errorBn: null });
        } else {
          resolve({
            allowed: false,
            distance: Math.round(dist),
            error: `You are ${Math.round(dist)}m away from office. Maximum allowed: ${config.radius_meters}m.`,
            errorBn: `আপনি অফিস থেকে ${Math.round(dist)} মিটার দূরে আছেন। সর্বোচ্চ অনুমতি: ${config.radius_meters} মিটার।`,
          });
        }
      },
      (err) => {
        let msg = "Location access denied. Please allow GPS permission.";
        let msgBn = "লোকেশন অ্যাক্সেস প্রত্যাখ্যান হয়েছে। GPS অনুমতি দিন।";
        if (err.code === err.TIMEOUT) {
          msg = "GPS request timed out. Please try again.";
          msgBn = "GPS রিকোয়েস্ট টাইম আউট হয়েছে। আবার চেষ্টা করুন।";
        }
        resolve({ allowed: false, distance: null, error: msg, errorBn: msgBn });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}
