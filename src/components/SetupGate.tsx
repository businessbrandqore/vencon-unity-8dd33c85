import { useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/appVersion";
import { SetupWizard } from "./SetupWizard";

const invokeWithTimeout = async (body: any, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { data, error } = await supabase.functions.invoke("setup-verification", {
      body,
    });
    clearTimeout(timer);
    if (error) throw error;
    return data;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
};

export const SetupGate = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<"checking" | "setup" | "locked" | "ready">("checking");
  const [lockMessage, setLockMessage] = useState("");

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const data = await invokeWithTimeout({ action: "check", version: APP_VERSION });

        if (data?.lockMessage) setLockMessage(data.lockMessage);

        if (data?.isLocked) {
          setStatus("locked");
        } else if (!data?.isComplete) {
          setStatus("setup");
        } else {
          setStatus("ready");
        }
      } catch {
        // If edge function is unreachable, skip the gate to avoid blocking the app
        console.warn("SetupGate: Edge function unreachable, skipping gate");
        setStatus("ready");
      }
    };
    checkSetup();

    // Poll every 30 seconds (reduced from 15s) to auto-detect unlock
    const interval = setInterval(async () => {
      try {
        const data = await invokeWithTimeout({ action: "check", version: APP_VERSION }, 5000);
        if (data && !data.isLocked && data.isComplete) {
          setStatus("ready");
        } else if (data && !data.isLocked && !data.isComplete) {
          setStatus("setup");
        }
      } catch {}
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (status === "checking") {
    return (
      <div data-bq-gate="active" className="fixed inset-0 flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-full animate-spin"
            style={{ border: "3px solid rgba(234,88,12,0.2)", borderTopColor: "#ea580c" }}
          />
          <p className="text-white/30 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "locked") {
    return <div data-bq-gate="locked"><SetupWizard mode="locked" lockMessage={lockMessage} onComplete={() => setStatus("ready")} /></div>;
  }

  if (status === "setup") {
    return <div data-bq-gate="setup"><SetupWizard mode="setup" onComplete={() => setStatus("ready")} /></div>;
  }

  return <div data-bq-gate="ready">{children}</div>;
};
