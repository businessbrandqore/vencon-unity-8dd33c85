import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { X, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import botLogo from "@/assets/vencon-bot-logo.jpg";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat-assistant`;

const TypingIndicator = () => (
  <div className="flex items-center gap-2 px-4 py-2">
    <img src={botLogo} alt="Bot" className="w-6 h-6 rounded-full object-cover" />
    <div className="flex gap-1 items-center bg-muted/60 px-3 py-2 rounded-2xl rounded-bl-sm">
      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms", animationDuration: "0.6s" }} />
      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms", animationDuration: "0.6s" }} />
      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms", animationDuration: "0.6s" }} />
    </div>
  </div>
);

const quickQuestions = [
  { emoji: "💰", text: "আমার salary কত?" },
  { emoji: "📊", text: "আজকের performance দেখাও" },
  { emoji: "📋", text: "আমার attendance report" },
  { emoji: "🏢", text: "কোম্পানির আজকের overview" },
];

const AIChatWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || !user || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: msgText };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = "40px";

    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          user_message: msgText,
          conversation_history: messages.slice(-10),
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        upsertAssistant(err.error || "কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।");
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch {
      upsertAssistant("কানেকশন সমস্যা। আবার চেষ্টা করুন।");
    }

    setIsLoading(false);
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "40px";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Bot Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 group"
        >
          <div className="relative">
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" style={{ animationDuration: "2s" }} />
            <div className="relative w-14 h-14 rounded-full border-2 border-primary shadow-lg overflow-hidden hover:scale-110 transition-transform duration-200 bg-background">
              <img src={botLogo} alt="Vencon AI" className="w-full h-full object-cover" />
            </div>
            {/* Online indicator */}
            <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed z-50 flex flex-col shadow-2xl border border-border overflow-hidden bg-background animate-scale-in
          bottom-0 right-0 w-full h-full sm:bottom-6 sm:right-6 sm:w-[380px] sm:h-[560px] sm:rounded-2xl">
          {/* Header */}
          <div className="relative px-4 py-3 flex items-center gap-3 shrink-0" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(24 95% 53%))" }}>
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-2 border-white/30 overflow-hidden">
                <img src={botLogo} alt="Vencon AI" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Vencon AI <Sparkles className="h-3.5 w-3.5 text-yellow-200" />
              </h3>
              <p className="text-[11px] text-white/70">আপনার ব্যক্তিগত সহকারী</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 bg-muted/20">
            <div className="p-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center py-6 animate-fade-in">
                  <div className="w-16 h-16 rounded-full overflow-hidden mb-3 border-2 border-primary/20 shadow-md">
                    <img src={botLogo} alt="Vencon AI" className="w-full h-full object-cover" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">Vencon AI Assistant</h4>
                  <p className="text-xs text-muted-foreground mb-4 text-center max-w-[240px]">
                    আমি আপনার কাজের তথ্য, salary, attendance সহ সকল প্রশ্নের উত্তর দিতে পারি।
                  </p>
                  <div className="w-full space-y-2">
                    {quickQuestions.map((q) => (
                      <button
                        key={q.text}
                        onClick={() => sendMessage(q.text)}
                        className="w-full text-left text-xs px-3 py-2.5 rounded-xl bg-background border border-border hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 flex items-center gap-2"
                      >
                        <span>{q.emoji}</span>
                        <span className="text-foreground">{q.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                >
                  {msg.role === "assistant" && (
                    <img src={botLogo} alt="Bot" className="w-7 h-7 rounded-full object-cover mt-1 shrink-0 border border-border" />
                  )}
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                        : "bg-background border border-border text-foreground rounded-2xl rounded-bl-md shadow-sm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-1.5 text-[13px]">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <TypingIndicator />
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-border bg-background p-3 shrink-0">
            <div className="flex items-end gap-2 bg-muted/40 rounded-xl px-3 py-1.5 border border-border focus-within:border-primary/50 transition-colors">
              <textarea
                ref={inputRef}
                placeholder="প্রশ্ন লিখুন..."
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="flex-1 bg-transparent text-sm resize-none outline-none py-2 max-h-[100px] text-foreground placeholder:text-muted-foreground"
                style={{ height: "40px" }}
                disabled={isLoading}
                rows={1}
              />
              <Button
                size="icon"
                className="h-8 w-8 rounded-lg shrink-0 mb-0.5"
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              Powered by Vencon AI • ডাটাবেজ থেকে তথ্য সংগ্রহ করে
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatWidget;
