import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle, LogIn, LogOut, MapPin, Loader2 } from "lucide-react";

const OFFICE_RADIUS_METERS = 500;

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface AttendanceRow {
  id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  mood_in: string | null;
  mood_out: string | null;
  is_late: boolean | null;
  is_early_out: boolean | null;
  deduction_amount: number | null;
}

const MOOD_EMOJIS: Record<string, string> = {
  happy: "😊", sad: "😢", excited: "🎉", tired: "😴", neutral: "😐", angry: "😠",
};

const MOODS = [
  { value: "happy", emoji: "😊", label: "খুশি" },
  { value: "sad", emoji: "😢", label: "দুঃখিত" },
  { value: "excited", emoji: "🎉", label: "উৎসাহিত" },
  { value: "tired", emoji: "😴", label: "ক্লান্ত" },
  { value: "neutral", emoji: "😐", label: "সাধারণ" },
  { value: "angry", emoji: "😠", label: "রাগান্বিত" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function ManagerAttendance() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayRecord, setTodayRecord] = useState<AttendanceRow | null>(null);

  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInMood, setCheckInMood] = useState("");
  const [checkInNote, setCheckInNote] = useState("");

  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [checkOutMood, setCheckOutMood] = useState("");

  const [officeLocation, setOfficeLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsChecking, setGpsChecking] = useState(false);
  const [gpsError, setGpsError] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;

    // Load office GPS from user profile
    const { data: profileData } = await supabase.from("users").select("gps_location").eq("id", user.id).single();
    if (profileData?.gps_location) {
      const [lat, lon] = profileData.gps_location.split(",").map(Number);
      if (!isNaN(lat) && !isNaN(lon)) setOfficeLocation({ lat, lon });
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data } = await supabase.from("attendance").select("*").eq("user_id", user.id)
      .gte("date", monthStart.toISOString().slice(0, 10))
      .order("date", { ascending: false });

    if (data) {
      const rows = data as AttendanceRow[];
      setAttendance(rows);
      setTodayRecord(rows.find(a => a.date === todayStr()) || null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const presentDays = attendance.filter((a) => a.clock_in).length;

  // Check In — NO deduction, NO shift restriction
  const handleCheckIn = async () => {
    if (!user || !checkInMood) { toast.error("মুড নির্বাচন করুন"); return; }
    const now = new Date().toISOString();

    if (todayRecord) {
      await supabase.from("attendance").update({
        clock_in: now,
        mood_in: checkInMood,
        mood_note: checkInNote || null,
        is_late: false,
        deduction_amount: 0,
      }).eq("id", todayRecord.id);
    } else {
      await supabase.from("attendance").insert({
        user_id: user.id,
        date: todayStr(),
        clock_in: now,
        mood_in: checkInMood,
        mood_note: checkInNote || null,
        is_late: false,
        deduction_amount: 0,
      });
    }

    setShowCheckInModal(false);
    setCheckInMood("");
    setCheckInNote("");
    await loadData();
    toast.success("Check In সফল ✓");
  };

  // Check Out — NO deduction
  const handleCheckOut = async () => {
    if (!user || !checkOutMood) { toast.error("মুড নির্বাচন করুন"); return; }
    const now = new Date().toISOString();

    if (todayRecord) {
      await supabase.from("attendance").update({
        clock_out: now,
        mood_out: checkOutMood,
        is_early_out: false,
        deduction_amount: 0,
      }).eq("id", todayRecord.id);
    }

    setShowCheckOutModal(false);
    setCheckOutMood("");
    await loadData();
    toast.success("Check Out সফল ✓");
  };

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  const hasCheckedIn = !!todayRecord?.clock_in;
  const hasCheckedOut = !!todayRecord?.clock_out;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" /> উপস্থিতি
        </h1>
        <Badge variant="outline" className="text-xs border-primary/30 text-primary">
          <MapPin className="h-3 w-3 mr-1" />
          যেকোনো স্থান থেকে — কোনো কর্তন নেই
        </Badge>
      </div>

      {/* Check In / Check Out Action Card */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Check In</p>
                <p className="font-heading text-sm">
                  {hasCheckedIn ? (
                    <span className="text-green-500">{new Date(todayRecord!.clock_in!).toLocaleTimeString("bn-BD")}</span>
                  ) : (
                    <span className="text-orange-400">করা হয়নি</span>
                  )}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Check Out</p>
                <p className="font-heading text-sm">
                  {hasCheckedOut ? (
                    <span className="text-green-500">{new Date(todayRecord!.clock_out!).toLocaleTimeString("bn-BD")}</span>
                  ) : hasCheckedIn ? (
                    <span className="text-blue-400">চলমান</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">মুড</p>
                <p className="text-xl">{todayRecord?.mood_in ? MOOD_EMOJIS[todayRecord.mood_in] || "—" : "—"}</p>
              </div>
            </div>

            <div className="flex gap-2 sm:flex-col">
              {!hasCheckedIn && (
                <Button
                  onClick={() => { setCheckInMood(""); setCheckInNote(""); setShowCheckInModal(true); }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <LogIn className="h-4 w-4 mr-2" /> Check In
                </Button>
              )}
              {hasCheckedIn && !hasCheckedOut && (
                <Button
                  onClick={() => { setCheckOutMood(""); setShowCheckOutModal(true); }}
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 mr-2" /> Check Out
                </Button>
              )}
              {hasCheckedIn && hasCheckedOut && (
                <Badge variant="outline" className="text-green-500 border-green-600/50 px-4 py-2">✓ সম্পূর্ণ</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
          <p className="text-2xl font-heading">{presentDays}</p>
          <p className="text-xs text-muted-foreground">এই মাসে উপস্থিত</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-heading text-green-500">৳০</p>
          <p className="text-xs text-muted-foreground">কোনো কর্তন নেই</p>
        </CardContent></Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading">এই মাসের উপস্থিতি</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-2 text-left">তারিখ</th>
                  <th className="py-2 px-2 text-left">Check In</th>
                  <th className="py-2 px-2 text-left">Check Out</th>
                  <th className="py-2 px-2 text-center">মুড</th>
                  <th className="py-2 px-2 text-center">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id} className="border-b border-border">
                    <td className="py-2 px-2">{new Date(a.date).toLocaleDateString("bn-BD")}</td>
                    <td className="py-2 px-2 text-xs">{a.clock_in ? new Date(a.clock_in).toLocaleTimeString("bn-BD") : "—"}</td>
                    <td className="py-2 px-2 text-xs">{a.clock_out ? new Date(a.clock_out).toLocaleTimeString("bn-BD") : "—"}</td>
                    <td className="py-2 px-2 text-center text-lg">{a.mood_in ? MOOD_EMOJIS[a.mood_in] || "—" : "—"}</td>
                    <td className="py-2 px-2 text-center">
                      {a.clock_in ? <Badge variant="outline" className="text-green-400 border-green-600/50 text-xs">OK</Badge> : "—"}
                    </td>
                  </tr>
                ))}
                {attendance.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">এই মাসে কোনো রেকর্ড নেই</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Check In Modal */}
      <Dialog open={showCheckInModal} onOpenChange={setShowCheckInModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Check In — মুড নির্বাচন</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {MOODS.map((m) => (
                <button key={m.value} onClick={() => setCheckInMood(m.value)} className={cn(
                  "flex flex-col items-center rounded-md border p-3 transition-all hover:border-primary",
                  checkInMood === m.value ? "border-primary bg-primary/15" : "border-border"
                )}>
                  <span className="text-2xl mb-1">{m.emoji}</span>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
            <Textarea value={checkInNote} onChange={(e) => setCheckInNote(e.target.value)} rows={2} placeholder="মন্তব্য (ঐচ্ছিক)" />
          </div>
          <DialogFooter>
            <Button onClick={handleCheckIn} disabled={!checkInMood} className="bg-green-600 hover:bg-green-700 text-white">Check In নিশ্চিত করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check Out Modal */}
      <Dialog open={showCheckOutModal} onOpenChange={setShowCheckOutModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Check Out — মুড নির্বাচন</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {MOODS.map((m) => (
                <button key={m.value} onClick={() => setCheckOutMood(m.value)} className={cn(
                  "flex flex-col items-center rounded-md border p-3 transition-all hover:border-primary",
                  checkOutMood === m.value ? "border-primary bg-primary/15" : "border-border"
                )}>
                  <span className="text-2xl mb-1">{m.emoji}</span>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCheckOut} disabled={!checkOutMood} className="bg-destructive hover:bg-destructive/80 text-destructive-foreground">Check Out নিশ্চিত করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
