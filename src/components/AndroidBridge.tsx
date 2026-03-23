import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Declares the global window interfaces for Android WebView bridge.
 * Only activates when userAgent contains "VenconApp".
 */
declare global {
  interface Window {
    onFCMToken?: (token: string) => Promise<void>;
    onCallAccepted?: () => void;
    onCallRejected?: () => void;
    AndroidBridge?: {
      showIncomingCall?: (callerName: string, callerNumber: string) => void;
      showChatBubble?: (senderName: string, messageText: string) => void;
    };
    // Internal refs used by the bridge
    __venconCallAccept?: () => void;
    __venconCallReject?: () => void;
  }
}

const isVenconApp = () => navigator.userAgent.includes("VenconApp");

const AndroidBridgeSetup = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!isVenconApp()) return;

    // Setup FCM token handler
    window.onFCMToken = async (token: string) => {
      if (!user?.id) return;
      await supabase
        .from("users")
        .update({ fcm_token: token } as any)
        .eq("id", user.id);
    };

    // Setup call accepted/rejected handlers
    window.onCallAccepted = () => {
      window.__venconCallAccept?.();
    };

    window.onCallRejected = () => {
      window.__venconCallReject?.();
    };

    return () => {
      delete window.onFCMToken;
      delete window.onCallAccepted;
      delete window.onCallRejected;
    };
  }, [user?.id]);

  return null;
};

export default AndroidBridgeSetup;
export { isVenconApp };
