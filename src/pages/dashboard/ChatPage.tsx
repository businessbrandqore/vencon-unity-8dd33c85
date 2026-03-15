import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Send, Users, MessageCircle, SmilePlus, Phone,
  Hash, MessageSquare, Lock, ImagePlus, Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";
import { toast } from "sonner";
import ChatThread from "@/components/chat/ChatThread";
import ChatCallOverlay from "@/components/chat/ChatCallOverlay";

interface ConvoDisplay {
  id: string;
  name: string | null;
  type: string | null;
  created_at: string;
  created_by: string | null;
  displayName: string;
  memberCount: number;
  isAdmin: boolean;
  is_muted: boolean;
}

interface Message {
  id: string;
  content: string;
  sender_id: string | null;
  conversation_id: string | null;
  created_at: string;
  reactions: Record<string, string[]>;
  read_by: string[];
  reply_to_id: string | null;
  sender_name: string;
  reply_count: number;
}

const ChatPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarTab, setSidebarTab] = useState<"dm" | "group">("dm");
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<{ conversationId: string; callerName: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch allowed emojis
  const { data: allowedEmojis } = useQuery({
    queryKey: ["chat-reaction-emojis"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "chat_reaction_emojis")
        .maybeSingle();
      return (data?.value as string[]) || ["👍", "❤️", "😂", "😮", "😢", "🎉"];
    },
  });

  // Fetch Cloudinary config
  const { data: cloudinaryConfig } = useQuery({
    queryKey: ["cloudinary-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "cloudinary_config")
        .maybeSingle();
      if (!data?.value) return null;
      const val = data.value as Record<string, string>;
      return val.cloud_name && val.upload_preset ? val : null;
    },
  });

  // Fetch conversations with display names
  const { data: conversations, refetch: refetchConvos } = useQuery({
    queryKey: ["chat-conversations", user?.id],
    queryFn: async () => {
      const { data: parts } = await supabase
        .from("chat_participants")
        .select("conversation_id, is_admin")
        .eq("user_id", user!.id);

      if (!parts?.length) return [];

      const convoIds = parts.map((p) => p.conversation_id);

      const { data: convos } = await supabase
        .from("chat_conversations")
        .select("*")
        .in("id", convoIds)
        .order("created_at", { ascending: false });

      if (!convos?.length) return [];

      // Get all participants
      const { data: allParts } = await supabase
        .from("chat_participants")
        .select("conversation_id, user_id, is_admin")
        .in("conversation_id", convoIds);

      // Get user names
      const userIds = [...new Set((allParts || []).map((p) => p.user_id))];
      const { data: usersData } = await supabase
        .from("users")
        .select("id, name")
        .in("id", userIds);

      const nameMap = new Map((usersData || []).map((u) => [u.id, u.name]));

      return convos.map((c) => {
        const members = (allParts || []).filter((p) => p.conversation_id === c.id);
        const myPart = parts.find((p) => p.conversation_id === c.id);

        let displayName = c.name || "Group";
        if (c.type === "direct") {
          const otherMember = members.find((m) => m.user_id !== user!.id);
          if (otherMember) {
            displayName = nameMap.get(otherMember.user_id) || "Unknown";
          }
        }

        return {
          id: c.id,
          name: c.name,
          type: c.type,
          created_at: c.created_at || "",
          created_by: c.created_by,
          displayName,
          memberCount: members.length,
          isAdmin: myPart?.is_admin || false,
          is_muted: (c as any).is_muted || false,
        } as ConvoDisplay;
      });
    },
    enabled: !!user,
  });

  // Fetch messages (top-level only)
  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["chat-messages", selectedConvo],
    queryFn: async () => {
      // Fetch top-level messages
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", selectedConvo!)
        .is("reply_to_id", null)
        .order("created_at", { ascending: true });

      if (!data) return [];

      // Get reply counts
      const { data: replies } = await supabase
        .from("chat_messages")
        .select("reply_to_id")
        .eq("conversation_id", selectedConvo!)
        .not("reply_to_id", "is", null);

      const countMap = new Map<string, number>();
      (replies || []).forEach((r) => {
        if (r.reply_to_id) {
          countMap.set(r.reply_to_id, (countMap.get(r.reply_to_id) || 0) + 1);
        }
      });

      // Get sender names
      const senderIds = [...new Set(data.map((m) => m.sender_id).filter(Boolean))];
      const { data: usersData } = await supabase
        .from("users")
        .select("id, name")
        .in("id", senderIds as string[]);

      const nameMap = new Map((usersData || []).map((u) => [u.id, u.name]));

      return data.map((m) => ({
        id: m.id,
        content: m.content,
        sender_id: m.sender_id,
        conversation_id: m.conversation_id,
        created_at: m.created_at || "",
        reactions: (m.reactions as Record<string, string[]>) || {},
        read_by: m.read_by || [],
        reply_to_id: m.reply_to_id,
        sender_name: m.sender_id ? nameMap.get(m.sender_id) || "Unknown" : "Unknown",
        reply_count: countMap.get(m.id) || 0,
      })) as Message[];
    },
    enabled: !!selectedConvo,
  });

  // All active users for DM list
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
    enabled: !!user,
  });

  // Realtime for messages
  useEffect(() => {
    if (!selectedConvo) return;
    const channel = supabase
      .channel(`chat-${selectedConvo}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${selectedConvo}` }, () => {
        refetchMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConvo, refetchMessages]);

  // Realtime for conversations (mute changes, etc)
  useEffect(() => {
    const channel = supabase
      .channel("chat-convos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => {
        refetchConvos();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_participants" }, () => {
        refetchConvos();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetchConvos]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark as read
  useEffect(() => {
    if (!selectedConvo || !user || !messages?.length) return;
    const unread = messages.filter(
      (m) => m.sender_id !== user.id && !(m.read_by || []).includes(user.id)
    );
    unread.forEach(async (m) => {
      await supabase
        .from("chat_messages")
        .update({ read_by: [...(m.read_by || []), user.id] })
        .eq("id", m.id);
    });
  }, [selectedConvo, messages, user]);

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConvo || !user) return;
    const convo = conversations?.find((c) => c.id === selectedConvo);
    if (convo?.is_muted && !convo.isAdmin && user.role !== "hr_manager") {
      toast.error("এই গ্রুপ সাময়িক বন্ধ আছে");
      return;
    }
    await supabase.from("chat_messages").insert({
      content: messageText.trim(),
      conversation_id: selectedConvo,
      sender_id: user.id,
    });
    setMessageText("");
  };

  const toggleReaction = async (msgId: string, emoji: string) => {
    if (!user) return;
    const msg = messages?.find((m) => m.id === msgId);
    if (!msg) return;
    const reactions = { ...msg.reactions };
    const users = reactions[emoji] || [];
    if (users.includes(user.id)) {
      reactions[emoji] = users.filter((id) => id !== user.id);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, user.id];
    }
    await supabase.from("chat_messages").update({ reactions }).eq("id", msgId);
    setShowReactions(null);
  };

  const startDM = async (targetUserId: string) => {
    if (!user) return;

    // Check for existing DM
    const { data: myParts } = await supabase
      .from("chat_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (myParts?.length) {
      const { data: targetParts } = await supabase
        .from("chat_participants")
        .select("conversation_id")
        .eq("user_id", targetUserId)
        .in("conversation_id", myParts.map((p) => p.conversation_id));

      if (targetParts?.length) {
        const { data: dmConvos } = await supabase
          .from("chat_conversations")
          .select("id")
          .eq("type", "direct")
          .in("id", targetParts.map((p) => p.conversation_id));

        if (dmConvos?.length) {
          setSelectedConvo(dmConvos[0].id);
          return;
        }
      }
    }

    const { data: convo, error } = await supabase
      .from("chat_conversations")
      .insert({ name: null, type: "direct", created_by: user.id })
      .select()
      .single();

    if (error || !convo) {
      toast.error("Failed to create conversation");
      return;
    }

    await supabase.from("chat_participants").insert([
      { conversation_id: convo.id, user_id: user.id },
      { conversation_id: convo.id, user_id: targetUserId },
    ]);

    queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    setSelectedConvo(convo.id);
  };

  const initiateCall = async () => {
    if (!selectedConvo || !user) return;
    const convoName = selectedConvoData?.displayName || "Call";
    setOutgoingCall({ conversationId: selectedConvo, callerName: convoName });
  };

  const uploadImage = async (file: File) => {
    if (!cloudinaryConfig || !selectedConvo || !user) {
      toast.error("Cloudinary কনফিগারেশন সেট করা হয়নি। HR Settings → API ট্যাবে সেট করুন।");
      return;
    }
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", cloudinaryConfig.upload_preset);
      formData.append("folder", "chat_images");
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloud_name}/image/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        await supabase.from("chat_messages").insert({
          content: `[image](${data.secure_url})`,
          conversation_id: selectedConvo,
          sender_id: user.id,
        });
      } else {
        toast.error("ছবি আপলোড ব্যর্থ হয়েছে");
      }
    } catch {
      toast.error("ছবি আপলোড ব্যর্থ হয়েছে");
    } finally {
      setUploadingImage(false);
    }
  };

  const filteredConvos = conversations?.filter((c) =>
    !searchTerm || c.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groups = filteredConvos?.filter((c) => c.type === "group") || [];
  const selectedConvoData = conversations?.find((c) => c.id === selectedConvo);

  // Filter users for DM tab
  const filteredUsers = allUsers?.filter((u) =>
    !searchTerm || u.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const emojis = allowedEmojis || ["👍", "❤️", "😂", "😮", "😢", "🎉"];

  return (
    <div className="-m-4 sm:-m-6 h-[calc(100vh-3.5rem)] flex overflow-hidden bg-background">
      {/* Call overlay */}
      {user && <ChatCallOverlay currentUserId={user.id} />}

      {/* Sidebar */}
      <div className="w-72 border-r border-border flex flex-col bg-card/50 shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="font-heading text-sm font-bold text-foreground flex-1">Chat</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-7 text-xs"
            />
          </div>
          {/* Tabs */}
          <div className="flex gap-1 bg-secondary/50 rounded-md p-0.5">
            <button
              onClick={() => setSidebarTab("dm")}
              className={`flex-1 text-[11px] py-1 rounded font-medium transition-colors flex items-center justify-center gap-1 ${
                sidebarTab === "dm" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageCircle className="h-3 w-3" /> Direct Message
            </button>
            <button
              onClick={() => setSidebarTab("group")}
              className={`flex-1 text-[11px] py-1 rounded font-medium transition-colors flex items-center justify-center gap-1 ${
                sidebarTab === "group" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-3 w-3" /> Groups
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {sidebarTab === "group" ? (
            <div className="px-2 pt-2 pb-2">
              {groups.length === 0 ? (
                <p className="text-[10px] text-muted-foreground px-2 py-6 text-center">কোনো গ্রুপ নেই</p>
              ) : (
                groups.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedConvo(c.id); setThreadParent(null); }}
                    className={`w-full text-left px-2 py-1.5 rounded-md flex items-center gap-2 transition-colors text-xs ${
                      selectedConvo === c.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground/70 hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {c.is_muted ? <Lock className="h-3 w-3 shrink-0 text-muted-foreground" /> : <Hash className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{c.displayName}</span>
                    <span className="text-[9px] text-muted-foreground ml-auto">{c.memberCount}</span>
                    {c.is_muted && <Badge variant="outline" className="text-[8px] px-1 py-0">Muted</Badge>}
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="px-2 pt-2 pb-2">
              {filteredUsers.length === 0 ? (
                <p className="text-[10px] text-muted-foreground px-2 py-6 text-center">কোনো ব্যবহারকারী নেই</p>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { startDM(u.id); setThreadParent(null); }}
                    className={`w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 transition-colors hover:bg-secondary`}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {getInitials(u.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{u.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{u.role.replace(/_/g, " ")}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConvo ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-sm">একটি conversation select করুন</p>
              <p className="text-xs text-muted-foreground/60 mt-1">বা নতুন message শুরু করুন</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-12 border-b border-border flex items-center px-4 bg-card shrink-0 gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  {selectedConvoData?.type === "group" ? <Hash className="h-3.5 w-3.5" /> : null}
                  {selectedConvoData?.displayName || "Conversation"}
                </h3>
                {selectedConvoData?.type === "group" && (
                  <p className="text-[10px] text-muted-foreground">{selectedConvoData.memberCount} members</p>
                )}
              </div>
              {selectedConvoData?.is_muted && (
                <Badge variant="outline" className="text-[10px] text-orange-500 border-orange-500/30">
                  <Lock className="h-3 w-3 mr-1" /> Muted
                </Badge>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={initiateCall}>
                <Phone className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-1">
                {messages?.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className="group hover:bg-secondary/30 px-2 py-1.5 rounded-md transition-colors">
                      <div className="flex items-start gap-2.5">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                          {getInitials(msg.sender_name)}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Name + time */}
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold text-foreground">{msg.sender_name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(msg.created_at), { locale: bn, addSuffix: true })}
                            </span>
                          </div>

                          {/* Content */}
                          <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap break-words">{msg.content}</p>

                          {/* Reactions */}
                          {Object.keys(msg.reactions).length > 0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                                <button
                                  key={emoji}
                                  onClick={() => toggleReaction(msg.id, emoji)}
                                  className={`text-xs px-1.5 py-0.5 rounded-md border transition-colors ${
                                    (userIds as string[]).includes(user?.id || "")
                                      ? "border-primary/40 bg-primary/10 text-foreground"
                                      : "border-border bg-card text-foreground/70 hover:bg-secondary"
                                  }`}
                                >
                                  {emoji} {(userIds as string[]).length}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Thread link */}
                          {msg.reply_count > 0 && (
                            <button
                              onClick={() => setThreadParent(msg)}
                              className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
                            >
                              <MessageCircle className="h-3 w-3" />
                              {msg.reply_count} replies
                            </button>
                          )}

                          {/* Read receipt for own messages */}
                          {isOwn && (
                            <span className="text-[10px] text-muted-foreground/50 mt-0.5 block">
                              {(msg.read_by || []).length > 1 ? "✓✓ seen" : "✓"}
                            </span>
                          )}
                        </div>

                        {/* Hover action bar */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 bg-card border border-border rounded-md px-1 py-0.5 shadow-sm transition-opacity shrink-0">
                          <button
                            onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)}
                            className="p-1 hover:bg-secondary rounded"
                            title="React"
                          >
                            <SmilePlus className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => setThreadParent(msg)}
                            className="p-1 hover:bg-secondary rounded"
                            title="Reply in thread"
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      </div>

                      {/* Reaction picker */}
                      {showReactions === msg.id && (
                        <div className="flex gap-1 mt-1.5 ml-10 bg-card border border-border rounded-full px-2 py-1 shadow-sm w-fit">
                          {emojis.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(msg.id, emoji)}
                              className="text-base hover:scale-125 transition-transform px-0.5"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Muted banner */}
            {selectedConvoData?.is_muted && !selectedConvoData.isAdmin && user?.role !== "hr_manager" ? (
              <div className="border-t border-border p-3 bg-muted text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                  <Lock className="h-3 w-3" /> এই গ্রুপ সাময়িক বন্ধ আছে
                </p>
              </div>
            ) : (
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
            )}
          </>
        )}
      </div>

      {/* Thread panel */}
      {threadParent && selectedConvo && (
        <ChatThread
          parentMessage={{
            id: threadParent.id,
            content: threadParent.content,
            sender_name: threadParent.sender_name,
            created_at: threadParent.created_at,
            conversation_id: selectedConvo,
          }}
          currentUserId={user?.id || ""}
          allowedEmojis={emojis}
          onClose={() => setThreadParent(null)}
        />
      )}

    </div>
  );
};

export default ChatPage;
