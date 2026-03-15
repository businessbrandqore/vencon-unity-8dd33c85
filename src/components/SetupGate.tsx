import { useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/appVersion";
import { SetupWizard } from "./SetupWizard";

export const SetupGate = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<"checking" | "setup" | "locked" | "ready">("checking");
  const [lockMessage, setLockMessage] = useState("");

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("setup-verification", {
          body: { action: "check", version: APP_VERSION }
        });
        if (error) throw error;

        if (data?.lockMessage) setLockMessage(data.lockMessage);

        if (data?.isLocked) {
          setStatus("locked");
        } else if (!data?.isComplete) {
          setStatus("setup");
        } else {
          setStatus("ready");
        }
      } catch {
        setStatus("setup");
      }
    };
    checkSetup();
  }, []);

  if (status === "checking") {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#0a0a0a" }}>
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
    return <SetupWizard mode="locked" lockMessage={lockMessage} onComplete={() => setStatus("ready")} />;
  }

  if (status === "setup") {
    return <SetupWizard mode="setup" onComplete={() => setStatus("ready")} />;
  }

  return <>{children}</>;
};
