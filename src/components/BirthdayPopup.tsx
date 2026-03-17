import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Cake, PartyPopper, X } from "lucide-react";

interface BirthdayPerson {
  id: string;
  name: string;
  avatar_url: string | null;
}

const BirthdayPopup = () => {
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const [birthdayPeople, setBirthdayPeople] = useState<BirthdayPerson[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [messageBn, setMessageBn] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const checkBirthdays = async () => {
      // Check if already dismissed today
      const dismissedKey = `birthday_dismissed_${new Date().toISOString().split("T")[0]}`;
      if (sessionStorage.getItem(dismissedKey)) return;

      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      // Fetch birthday config
      const { data: configData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "birthday_config")
        .maybeSingle();

      const config = configData?.value as any;
      const msgEn = config?.message || "🎂 Happy Birthday {name}! Wishing you a wonderful day!";
      const msgBn = config?.message_bn || "🎂 শুভ জন্মদিন {name}! আপনার জন্মদিন শুভ হোক!";
      setMessage(msgEn);
      setMessageBn(msgBn);

      // Fetch users with today's birthday
      // We query all active users with date_of_birth set, then filter client-side
      const { data: users } = await supabase
        .from("users")
        .select("id, name, avatar_url, date_of_birth")
        .eq("is_active", true)
        .not("date_of_birth", "is", null);

      if (!users || users.length === 0) return;

      const todayBirthdays = users.filter((u: any) => {
        if (!u.date_of_birth) return false;
        const dob = new Date(u.date_of_birth);
        return dob.getMonth() + 1 === month && dob.getDate() === day;
      });

      if (todayBirthdays.length > 0) {
        setBirthdayPeople(todayBirthdays.map((u: any) => ({
          id: u.id,
          name: u.name,
          avatar_url: u.avatar_url,
        })));
        setCurrentIndex(0);
        setOpen(true);
      }
    };

    // Small delay to let the dashboard load first
    const timer = setTimeout(checkBirthdays, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    if (currentIndex < birthdayPeople.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setOpen(false);
      const dismissedKey = `birthday_dismissed_${new Date().toISOString().split("T")[0]}`;
      sessionStorage.setItem(dismissedKey, "true");
    }
  };

  if (!open || birthdayPeople.length === 0) return null;

  const person = birthdayPeople[currentIndex];
  const displayMessage = (isBn ? messageBn : message).replace(/\{name\}/g, person.name);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none bg-transparent shadow-none">
        <div className="relative bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 rounded-2xl p-1">
          <div className="bg-card rounded-xl overflow-hidden">
            {/* Confetti Header */}
            <div className="relative bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-indigo-500/20 p-6 text-center">
              <div className="absolute top-2 right-2">
                <button
                  onClick={handleDismiss}
                  className="p-1.5 rounded-full bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Decorative elements */}
              <div className="flex justify-center gap-2 mb-3">
                <PartyPopper className="h-6 w-6 text-yellow-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <Cake className="h-8 w-8 text-pink-500 animate-bounce" style={{ animationDelay: "200ms" }} />
                <PartyPopper className="h-6 w-6 text-yellow-500 animate-bounce" style={{ animationDelay: "400ms" }} />
              </div>

              {/* Avatar */}
              <div className="mx-auto w-24 h-24 rounded-full border-4 border-primary/30 overflow-hidden bg-muted mb-3">
                {person.avatar_url ? (
                  <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-3xl font-heading font-bold">
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <h2 className="font-heading text-xl font-bold text-foreground">
                🎉 {isBn ? "শুভ জন্মদিন!" : "Happy Birthday!"}
              </h2>
              <p className="font-heading text-lg font-bold text-primary mt-1">
                {person.name}
              </p>
            </div>

            {/* Message */}
            <div className="p-6 text-center">
              <p className="font-body text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {displayMessage}
              </p>

              {birthdayPeople.length > 1 && (
                <p className="text-xs text-muted-foreground mt-4 font-body">
                  {isBn
                    ? `${currentIndex + 1} / ${birthdayPeople.length} জনের জন্মদিন আজ 🎂`
                    : `${currentIndex + 1} of ${birthdayPeople.length} birthdays today 🎂`}
                </p>
              )}

              <Button
                onClick={handleDismiss}
                className="mt-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-heading"
              >
                {currentIndex < birthdayPeople.length - 1
                  ? (isBn ? "পরবর্তী 🎂" : "Next 🎂")
                  : (isBn ? "ধন্যবাদ! 🎉" : "Thanks! 🎉")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BirthdayPopup;
