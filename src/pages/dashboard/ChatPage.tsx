import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, Users, MessageCircle, Plus, Reply, SmilePlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";
import { toast } from "sonner";

interface Conversation {
  id: string;
  name: string | null;
  type: string | null;
  created_at: string;
  created_by: string | null;
}

interface Message {
  id: string;
  content: string;
  sender_id: string | null;
  conversation_id: string | null;
  created_at: string;
  reactions: Record<string, string[]> | null;
  read_by: string[] | null;
  reply_to_id: string | null;
  sender_name?: string;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

const ChatPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [showNewDM, setShowNewDM] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const { data: conversations } = useQuery({
    queryKey: ["chat-conversations", user?.id],
    queryFn: async () => {
      const { data: participations } = await supabase
        .from("chat_participants")
        .select("conversation_id")
        .eq("user_id", user!.id);

      if (!participations?.length) return [];

      const convoIds = participations.map((p) => p.conversation_id);
      const { data } = await supabase
        .from("chat_conversations")
        .select("*")
        .in("id", convoIds)
        .order("created_at", { ascending: false });

      return (data || []) as Conversation[];
    },
    enabled: !!user,
  });

  // Fetch messages for selected conversation
  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["chat-messages", selectedConvo],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", selectedConvo!)
        .order("created_at", { ascending: true });

      if (!data) return [];

      // Fetch sender names
      const senderIds = [...new Set(data.map((m) => m.sender_id).filter(Boolean))];
      const { data: users } = await supabase
        .from("users")
        .select("id, name")
        .in("id", senderIds as string[]);

      const nameMap = new Map((users || []).map((u) => [u.id, u.name]));

      return data.map((m) => ({
        ...m,
        sender_name: m.sender_id ? nameMap.get(m.sender_id) || "Unknown" : "Unknown",
        reactions: (m.reactions as Record<string, string[]>) || {},
        read_by: m.read_by || [],
      })) as Message[];
    },
    enabled: !!selectedConvo,
  });

  // Fetch all users for new DM
  const { data: allUsers } = useQuery({
    queryKey: ["all-users-chat"],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, name, role, panel")
        .eq("is_active", true)
        .neq("id", user!.id)
        .order("name");
      return data || [];
    },
    enabled: !!user && showNewDM,
  });

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedConvo) return;

    const channel = supabase
      .channel(`chat-${selectedConvo}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${selectedConvo}`,
        },
        () => {
          refetchMessages();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${selectedConvo}`,
        },
        () => {
          refetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConvo, refetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read
  useEffect(() => {
    if (!selectedConvo || !user || !messages?.length) return;

    const unread = messages.filter(
      (m) => m.sender_id !== user.id && !(m.read_by || []).includes(user.id)
    );

    if (unread.length > 0) {
      unread.forEach(async (m) => {
        const newReadBy = [...(m.read_by || []), user.id];
        await supabase
          .from("chat_messages")
          .update({ read_by: newReadBy })
          .eq("id", m.id);
      });
    }
  }, [selectedConvo, messages, user]);

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConvo || !user) return;

    await supabase.from("chat_messages").insert({
      content: messageText.trim(),
      conversation_id: selectedConvo,
      sender_id: user.id,
      reply_to_id: replyTo?.id || null,
    });

    setMessageText("");
    setReplyTo(null);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const msg = messages?.find((m) => m.id === messageId);
    if (!msg) return;

    const reactions = { ...(msg.reactions || {}) };
    const users = reactions[emoji] || [];

    if (users.includes(user.id)) {
      reactions[emoji] = users.filter((id) => id !== user.id);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, user.id];
    }

    await supabase
      .from("chat_messages")
      .update({ reactions })
      .eq("id", messageId);

    setShowReactions(null);
  };

  const startDM = async (targetUserId: string, targetName: string) => {
    if (!user) return;

    // Create conversation
    const { data: convo, error } = await supabase
      .from("chat_conversations")
      .insert({
        name: null,
        type: "dm",
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !convo) {
      toast.error("Failed to create conversation");
      return;
    }

    // Add both participants
    await supabase.from("chat_participants").insert([
      { conversation_id: convo.id, user_id: user.id },
      { conversation_id: convo.id, user_id: targetUserId },
    ]);

    setShowNewDM(false);
    queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    setSelectedConvo(convo.id);
  };

  const filteredConvos = conversations?.filter((c) =>
    !searchTerm || (c.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groups = filteredConvos?.filter((c) => c.type === "group") || [];
  const dms = filteredConvos?.filter((c) => c.type === "dm" || c.type !== "group") || [];

  const selectedConvoData = conversations?.find((c) => c.id === selectedConvo);

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left sidebar */}
      <div className="w-72 border-r border-border flex flex-col bg-card shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-sm font-semibold text-foreground flex-1">Chat</h2>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowNewDM(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {/* Groups */}
          {groups.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 font-semibold">
                Groups
              </p>
              {groups.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedConvo(c.id)}
                  className={`w-full text-left px-2 py-2 rounded flex items-center gap-2 transition-colors ${
                    selectedConvo === c.id ? "bg-primary/10 text-foreground" : "hover:bg-secondary"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.name || "Group"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { locale: bn, addSuffix: true })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* DMs */}
          <div className="p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 font-semibold">
              Direct Messages
            </p>
            {dms.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-4 text-center">No conversations yet</p>
            ) : (
              dms.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedConvo(c.id)}
                  className={`w-full text-left px-2 py-2 rounded flex items-center gap-2 transition-colors ${
                    selectedConvo === c.id ? "bg-primary/10 text-foreground" : "hover:bg-secondary"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.name || "DM"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { locale: bn, addSuffix: true })}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {!selectedConvo ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>একটি conversation select করুন</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-12 border-b border-border flex items-center px-4 bg-card shrink-0">
              <h3 className="font-heading text-sm font-semibold text-foreground">
                {selectedConvoData?.name || "Conversation"}
              </h3>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages?.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;
                  const replyMsg = msg.reply_to_id
                    ? messages.find((m) => m.id === msg.reply_to_id)
                    : null;

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2 group ${isOwn ? "flex-row-reverse" : ""}`}
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
                        {getInitials(msg.sender_name || "?")}
                      </div>

                      <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                        {/* Sender name */}
                        <span className="text-[10px] text-muted-foreground mb-0.5">
                          {msg.sender_name}{" "}
                          <span className="opacity-60">
                            {formatDistanceToNow(new Date(msg.created_at), { locale: bn, addSuffix: true })}
                          </span>
                        </span>

                        {/* Reply reference */}
                        {replyMsg && (
                          <div className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded mb-0.5 border-l-2 border-primary">
                            {replyMsg.sender_name}: {replyMsg.content.slice(0, 60)}
                          </div>
                        )}

                        {/* Message bubble */}
                        <div
                          className={`px-3 py-2 rounded-lg text-sm relative ${
                            isOwn
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-foreground"
                          }`}
                        >
                          {msg.content}

                          {/* Action buttons on hover */}
                          <div className="absolute -top-6 right-0 hidden group-hover:flex gap-1 bg-card border border-border rounded px-1 py-0.5 shadow-sm">
                            <button
                              onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)}
                              className="p-0.5 hover:bg-secondary rounded"
                            >
                              <SmilePlus className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => setReplyTo(msg)}
                              className="p-0.5 hover:bg-secondary rounded"
                            >
                              <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </div>

                        {/* Reaction picker */}
                        {showReactions === msg.id && (
                          <div className="flex gap-1 mt-1 bg-card border border-border rounded-full px-2 py-1 shadow-sm">
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(msg.id, emoji)}
                                className="text-sm hover:scale-125 transition-transform"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Reactions display */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(msg.id, emoji)}
                                className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                                  (userIds as string[]).includes(user?.id || "")
                                    ? "border-primary bg-primary/10"
                                    : "border-border bg-card"
                                }`}
                              >
                                {emoji} {(userIds as string[]).length}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Read receipts */}
                        {isOwn && (
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            {(msg.read_by || []).length > 1 ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Reply indicator */}
            {replyTo && (
              <div className="px-4 py-2 bg-muted border-t border-border flex items-center gap-2">
                <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground flex-1 truncate">
                  Replying to {replyTo.sender_name}: {replyTo.content.slice(0, 50)}
                </span>
                <button onClick={() => setReplyTo(null)} className="text-xs text-destructive">
                  ✕
                </button>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-border p-3 flex gap-2 bg-card shrink-0">
              <Input
                placeholder="Message লিখুন..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="flex-1 text-sm"
              />
              <Button size="icon" onClick={sendMessage} disabled={!messageText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* New DM Modal */}
      {showNewDM && (
        <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center" onClick={() => setShowNewDM(false)}>
          <div className="bg-card border border-border rounded-lg w-96 max-h-[500px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border">
              <h3 className="font-heading text-sm font-semibold">New Direct Message</h3>
            </div>
            <ScrollArea className="max-h-96">
              {allUsers?.map((u) => (
                <button
                  key={u.id}
                  onClick={() => startDM(u.id, u.name)}
                  className="w-full text-left px-4 py-3 hover:bg-secondary border-b border-border flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">
                    {getInitials(u.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground">{u.role.replace(/_/g, " ")}</p>
                  </div>
                </button>
              ))}
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
