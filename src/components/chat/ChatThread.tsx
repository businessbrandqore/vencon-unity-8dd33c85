import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, SmilePlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";

interface ThreadMessage {
  id: string;
  content: string;
  sender_id: string | null;
  sender_name: string;
  created_at: string;
  reactions: Record<string, string[]>;
  read_by: string[];
}

interface ChatThreadProps {
  parentMessage: {
    id: string;
    content: string;
    sender_name: string;
    created_at: string;
    conversation_id: string;
  };
  currentUserId: string;
  allowedEmojis: string[];
  onClose: () => void;
}

const ChatThread = ({ parentMessage, currentUserId, allowedEmojis, onClose }: ChatThreadProps) => {
  const [replies, setReplies] = useState<ThreadMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchReplies = async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("reply_to_id", parentMessage.id)
      .order("created_at", { ascending: true });

    if (!data) return;

    const senderIds = [...new Set(data.map((m) => m.sender_id).filter(Boolean))];
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", senderIds as string[]);

    const nameMap = new Map((users || []).map((u) => [u.id, u.name]));

    setReplies(
      data.map((m) => ({
        id: m.id,
        content: m.content,
        sender_id: m.sender_id,
        sender_name: m.sender_id ? nameMap.get(m.sender_id) || "Unknown" : "Unknown",
        created_at: m.created_at || "",
        reactions: (m.reactions as Record<string, string[]>) || {},
        read_by: m.read_by || [],
      }))
    );
  };

  useEffect(() => {
    fetchReplies();

    const channel = supabase
      .channel(`thread-${parentMessage.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `reply_to_id=eq.${parentMessage.id}` },
        () => fetchReplies()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [parentMessage.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies]);

  const sendReply = async () => {
    if (!replyText.trim()) return;
    await supabase.from("chat_messages").insert({
      content: replyText.trim(),
      conversation_id: parentMessage.conversation_id,
      sender_id: currentUserId,
      reply_to_id: parentMessage.id,
    });
    setReplyText("");
  };

  const toggleReaction = async (msgId: string, emoji: string) => {
    const msg = replies.find((m) => m.id === msgId);
    if (!msg) return;
    const reactions = { ...msg.reactions };
    const users = reactions[emoji] || [];
    if (users.includes(currentUserId)) {
      reactions[emoji] = users.filter((id) => id !== currentUserId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, currentUserId];
    }
    await supabase.from("chat_messages").update({ reactions }).eq("id", msgId);
    setShowReactions(null);
  };

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="w-80 border-l border-border flex flex-col bg-card shrink-0">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center justify-between px-3 shrink-0">
        <h4 className="text-xs font-semibold text-foreground">Thread</h4>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Parent message */}
      <div className="p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
            {getInitials(parentMessage.sender_name)}
          </div>
          <span className="text-xs font-medium text-foreground">{parentMessage.sender_name}</span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(parentMessage.created_at), { locale: bn, addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-foreground pl-8">{parentMessage.content}</p>
      </div>

      {/* Replies */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {replies.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">কোনো reply নেই</p>
          )}
          {replies.map((msg) => (
            <div key={msg.id} className="group">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[8px] font-bold text-foreground shrink-0 mt-0.5">
                  {getInitials(msg.sender_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-foreground">{msg.sender_name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(msg.created_at), { locale: bn, addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-0.5">{msg.content}</p>

                  {/* Reactions */}
                  {Object.keys(msg.reactions).length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                            (userIds as string[]).includes(currentUserId)
                              ? "border-primary bg-primary/10"
                              : "border-border bg-card"
                          }`}
                        >
                          {emoji} {(userIds as string[]).length}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Reaction picker on hover */}
                  {showReactions === msg.id && (
                    <div className="flex gap-1 mt-1 bg-card border border-border rounded-full px-2 py-1 shadow-sm">
                      {allowedEmojis.map((emoji) => (
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
                </div>

                {/* Hover actions */}
                <button
                  onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-secondary rounded transition-opacity"
                >
                  <SmilePlus className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {/* Reply input */}
      <div className="border-t border-border p-2 flex gap-1.5 shrink-0">
        <Input
          placeholder="Reply..."
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendReply();
            }
          }}
          className="flex-1 h-8 text-xs"
        />
        <Button size="icon" className="h-8 w-8" onClick={sendReply} disabled={!replyText.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default ChatThread;
