import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDistanceToNow } from "date-fns";
import { bn as bnLocale } from "date-fns/locale";
import { enUS } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  info: "ℹ️",
  success: "✅",
  warning: "⚠️",
  error: "❌",
};

const playNotificationSound = (volume: number) => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime((volume / 100) * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio not available
  }
};

const NotificationBell = () => {
  let authContext: { user: any } | undefined;
  try { authContext = useAuth(); } catch { return null; }
  const { user } = authContext;
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [volume, setVolume] = useState(70);
  const ref = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, message, type, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
      initialLoadDone.current = true;
    };
    fetch();
    const fetchVol = async () => {
      const { data } = await supabase
        .from("users")
        .select("notification_volume")
        .eq("id", user.id)
        .single();
      if (data?.notification_volume != null) setVolume(data.notification_volume);
    };
    fetchVol();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const newNotif = payload.new as Notification;
        setNotifications((prev) => [newNotif, ...prev].slice(0, 10));
        setUnreadCount((c) => c + 1);
        if (initialLoadDone.current) playNotificationSound(volume);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, volume]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [notifications, user]);

  const markOneRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  if (!user) return null;

  const locale = lang === "bn" ? bnLocale : enUS;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-1.5 text-muted-foreground hover:text-foreground transition-colors">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 text-[10px] font-bold flex items-center justify-center px-1 bg-destructive text-destructive-foreground rounded-full">
            {n(unreadCount > 99 ? 99 : unreadCount)}{unreadCount > 99 ? "+" : ""}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-card border border-border z-50 shadow-lg rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="font-heading text-sm font-semibold text-foreground">{t("notifications")}</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                <Check className="h-3 w-3" />
                {t("mark_all_read")}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-6 text-xs text-muted-foreground text-center">{t("no_notifications")}</p>
            ) : (
              notifications.map((ntf) => (
                <button
                  key={ntf.id}
                  onClick={() => { if (!ntf.is_read) markOneRead(ntf.id); setOpen(false); }}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-secondary/50 transition-colors flex gap-3 ${!ntf.is_read ? "bg-primary/5" : ""}`}
                >
                  <span className="text-sm mt-0.5 shrink-0">{TYPE_ICONS[ntf.type || "info"] || "ℹ️"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{ntf.title}</p>
                    {ntf.message && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{ntf.message}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(ntf.created_at), { addSuffix: true, locale })}
                    </p>
                  </div>
                  {!ntf.is_read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-border px-4 py-2.5">
            <button
              onClick={() => { setOpen(false); navigate(`/${user.panel}/notifications`); }}
              className="text-[11px] text-primary hover:underline"
            >
              {t("view_all_notifications")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
