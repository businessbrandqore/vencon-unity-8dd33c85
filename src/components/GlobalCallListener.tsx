import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ChatCallOverlay from "@/components/chat/ChatCallOverlay";

/**
 * Mounts ChatCallOverlay globally so incoming calls are detected
 * on ANY page, not just the chat page.
 * When user is already on /chat, this component renders nothing
 * (ChatPage has its own overlay).
 */
const GlobalCallListener = () => {
  const { user } = useAuth();
  const location = useLocation();

  // If the user is on the chat page, ChatPage already has its own overlay
  const isOnChatPage = location.pathname.endsWith("/chat");

  if (!user || isOnChatPage) return null;

  return (
    <ChatCallOverlay
      currentUserId={user.id}
    />
  );
};

export default GlobalCallListener;
