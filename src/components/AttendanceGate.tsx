import { useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle, LogOut } from "lucide-react";
import { useDeductionConfig } from "@/hooks/useDeductionConfig";

const MOODS = [
  { value: "happy", emoji: "😊", label: "খুশি" },
  { value: "sad", emoji: "😢", label: "দুঃখিত" },
  { value: "excited", emoji: "🎉", label: "উৎসাহিত" },
  { value: "tired", emoji: "😴", label: "ক্লান্ত" },
  { value: "neutral", emoji: "😐", label: "সাধারণ" },
  { value: "angry", emoji: "😠", label: "রাগান্বিত" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

interface AttendanceGateProps {
  children: ReactNode;
}

export default function AttendanceGate({ children }: AttendanceGateProps) {
  const deductionConfig = useDeductionConfig();
  const { user } = useAuth();

  const [profile, setProfile] = useState<{ shift_start: string | null; shift_end: string | null } | null>(null);
  const [isWithinShift, setIsWithinShift] = useState<boolean | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deskReportDone, setDeskReportDone] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);

  const [showDeskModal, setShowDeskModal] = useState(false);
  const [deskCondition, setDeskCondition] = useState("");
  const [deskNote, setDeskNote] = useState("");
  const [phoneMins, setPhoneMins] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [deskNumber, setDeskNumber] = useState("");
  const [phoneInstruction, setPhoneInstruction] = useState("");

  const [selectedMood, setSelectedMood] = useState("");
  const [moodNote, setMoodNote] = useState("");

  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [clockOutMood, setClockOutMood] = useState("");
  const [clockOutNote, setClockOutNote] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("users").select("shift_start, shift_end").eq("id", user.id).single();
      if (data) setProfile(data);
    })();
  }, [user]);

  useEffect(() => {
    if (!profile) return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;
    if (profile.shift_start && profile.shift_end) {
      setIsWithinShift(hhmm >= profile.shift_start && hhmm <= profile.shift_end);
    } else {
      setIsWithinShift(true);
    }
  }, [profile]);

  const loadAttendance = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", todayStr()).maybeSingle();
    if (data) {
      setTodayAttendance(data);
      setDeskReportDone(!!data.desk_condition);
      setClockedIn(!!data.clock_in);
    } else {
      setTodayAttendance(null);
      setDeskReportDone(false);
      setClockedIn(false);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "phone_minutes_instruction").maybeSingle();
      if (data?.value) setPhoneInstruction(String(data.value).replace(/^"|"$/g, ""));
    })();
  }, []);

  const handleDeskReportSubmit = async () => {
    if (!user || (!deskCondition && !deskNote)) { toast.error("ডেস্কের অবস্থা নির্বাচন করুন"); return; }
    const deskValue = deskNote ? `${deskCondition}||${deskNote}` : deskCondition;
    if (todayAttendance) {
      await supabase.from("attendance").update({ desk_condition: deskValue, phone_minutes_remaining: phoneMins, phone_number: phoneNumber || null, desk_number: deskNumber || null } as any).eq("id", todayAttendance.id);
    } else {
      await supabase.from("attendance").insert({ user_id: user.id, date: todayStr(), desk_condition: deskValue, phone_minutes_remaining: phoneMins, phone_number: phoneNumber || null, desk_number: deskNumber || null } as any);
    }
    setShowDeskModal(false);
    setDeskReportDone(true);
    await loadAttendance();
    toast.success("ডেস্ক রিপোর্ট সংরক্ষণ করা হয়েছে");
  };

  const handleClockIn = async () => {
    if (!user || !selectedMood) { toast.error("মুড নির্বাচন করুন"); return; }
    const now = new Date().toISOString();
    let isLate = false;
    if (profile?.shift_start) {
      const parts = profile.shift_start.split(":");
      const shiftDate = new Date();
      shiftDate.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
      if (new Date() > shiftDate) isLate = true;
    }
    if (todayAttendance) {
      await supabase.from("attendance").update({ clock_in: now, mood_in: selectedMood, mood_note: moodNote || null, is_late: isLate, deduction_amount: isLate ? LATE_DEDUCTION : 0 }).eq("id", todayAttendance.id);
    } else {
      await supabase.from("attendance").insert({ user_id: user.id, date: todayStr(), clock_in: now, mood_in: selectedMood, mood_note: moodNote || null, is_late: isLate, deduction_amount: isLate ? LATE_DEDUCTION : 0 });
    }
    setClockedIn(true);
    await loadAttendance();
    toast.success(isLate ? "Check In হয়েছে (Late — ৳33 কর্তন)" : "Check In সফল ✓");
  };

  const handleClockOut = async () => {
    if (!user || !clockOutMood) { toast.error("মুড নির্বাচন করুন"); return; }
    const now = new Date();
    let earlyOut = false;
    let extraDeduction = 0;
    if (profile?.shift_end) {
      const parts = profile.shift_end.split(":");
      const shiftEnd = new Date();
      shiftEnd.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
      if (now < shiftEnd) { earlyOut = true; extraDeduction = LATE_DEDUCTION; }
    }
    if (todayAttendance) {
      await supabase.from("attendance").update({ clock_out: now.toISOString(), mood_out: clockOutMood, is_early_out: earlyOut, deduction_amount: (Number(todayAttendance.deduction_amount) || 0) + extraDeduction }).eq("id", todayAttendance.id);
    }
    setShowClockOutModal(false);
    await loadAttendance();
    toast.success(earlyOut ? "Check Out হয়েছে (Early — ৳33 কর্তন)" : "Check Out সফল ✓");
  };

  if (!profile || isWithinShift === null || loading) {
    return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;
  }

  if (!isWithinShift) {
    return (
      <div className="space-y-6">
        <Card className="border-[hsl(var(--panel-employee))]">
          <CardContent className="py-8 text-center">
            <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="font-heading text-xl mb-2">শিফটের বাইরে</h2>
            <p className="text-muted-foreground">আপনার শিফট এখন শুরু হয়নি বা শেষ হয়ে গেছে</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!deskReportDone) {
    return (
      <div className="space-y-6">
        <button onClick={() => setShowDeskModal(true)} className="w-full rounded-md border border-orange-500/50 bg-orange-500/10 p-6 text-center hover:bg-orange-500/20 transition-colors">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-orange-400" />
          <p className="font-heading text-lg text-orange-300">ডেস্ক ও ফোন রিপোর্ট দিন</p>
          <p className="text-sm text-muted-foreground mt-1">কাজ শুরু করতে ডেস্ক রিপোর্ট দিতে হবে</p>
        </button>
        <Dialog open={showDeskModal} onOpenChange={setShowDeskModal}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>ডেস্ক রিপোর্ট</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>ডেস্কের অবস্থা</Label>
                <RadioGroup value={deskCondition} onValueChange={setDeskCondition} className="mt-2 space-y-2">
                  <div className="flex items-center gap-2"><RadioGroupItem value="good" id="g-good" /><Label htmlFor="g-good">ভালো</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="acceptable" id="g-acc" /><Label htmlFor="g-acc">গ্রহণযোগ্য</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="needs_repair" id="g-rep" /><Label htmlFor="g-rep">মেরামত প্রয়োজন</Label></div>
                </RadioGroup>
              </div>
              <Textarea value={deskNote} onChange={(e) => setDeskNote(e.target.value)} rows={2} placeholder="বিস্তারিত (ঐচ্ছিক)" />
              <div className="grid grid-cols-2 gap-3">
                <div><Label>মোবাইল নাম্বার</Label><Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="mt-1" placeholder="01XXXXXXXXX" /></div>
                <div><Label>ডেস্ক নাম্বার</Label><Input value={deskNumber} onChange={(e) => setDeskNumber(e.target.value)} className="mt-1" placeholder="ডেস্ক নং" /></div>
              </div>
              <div>
                <Label>অবশিষ্ট ফোন মিনিট</Label>
                {phoneInstruction && (
                  <div className="mt-1 mb-2 rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-300">
                    <p className="font-medium mb-1">📱 মিনিট চেক করার নিয়ম:</p>
                    <p className="whitespace-pre-wrap">{phoneInstruction}</p>
                  </div>
                )}
                <Input type="number" min={0} value={phoneMins} onChange={(e) => setPhoneMins(Number(e.target.value))} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleDeskReportSubmit} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)]">সংরক্ষণ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (!clockedIn) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="font-heading">আজকের মুড নির্বাচন করুন</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {MOODS.map((m) => (
                <button key={m.value} onClick={() => setSelectedMood(m.value)} className={cn("flex flex-col items-center rounded-md border p-4 transition-all hover:border-[hsl(var(--panel-employee))]", selectedMood === m.value ? "border-[hsl(var(--panel-employee))] bg-[hsl(var(--panel-employee)/0.15)]" : "border-border")}>
                  <span className="text-3xl mb-1">{m.emoji}</span>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
            <Textarea value={moodNote} onChange={(e) => setMoodNote(e.target.value)} rows={2} placeholder="মন্তব্য (ঐচ্ছিক)" />
            <Button onClick={handleClockIn} disabled={!selectedMood} className="w-full bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">Check In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!todayAttendance?.clock_out ? (
          <Button variant="outline" onClick={() => { setClockOutMood(""); setClockOutNote(""); setShowClockOutModal(true); }} className="border-destructive text-destructive hover:bg-destructive/10">
            <LogOut className="h-4 w-4 mr-2" />Check Out
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground flex items-center gap-1">✓ Check Out: {new Date(todayAttendance.clock_out).toLocaleTimeString("bn-BD")}</span>
        )}
      </div>
      {children}
      <Dialog open={showClockOutModal} onOpenChange={setShowClockOutModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Check Out — মুড নির্বাচন</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {MOODS.map((m) => (
                <button key={m.value} onClick={() => setClockOutMood(m.value)} className={cn("flex flex-col items-center rounded-md border p-3 transition-all", clockOutMood === m.value ? "border-[hsl(var(--panel-employee))] bg-[hsl(var(--panel-employee)/0.15)]" : "border-border")}>
                  <span className="text-2xl mb-1">{m.emoji}</span>
                  <span className="text-xs">{m.label}</span>
                </button>
              ))}
            </div>
            <Textarea value={clockOutNote} onChange={(e) => setClockOutNote(e.target.value)} placeholder="মন্তব্য (ঐচ্ছিক)" rows={2} />
          </div>
          <DialogFooter>
            <Button onClick={handleClockOut} disabled={!clockOutMood} className="bg-destructive hover:bg-destructive/80 text-destructive-foreground">Check Out নিশ্চিত করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
