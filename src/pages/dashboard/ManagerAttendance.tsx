import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { bn } from "date-fns/locale";
import { Clock, CheckCircle, LogIn, LogOut, MapPin, Loader2, Users, Send, CalendarIcon } from "lucide-react";

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
  user_id: string | null;
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

  // Team attendance state
  const isTL = user?.panel === "tl";
  const [teamAttendance, setTeamAttendance] = useState<(AttendanceRow & { userName?: string })[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamFilter, setTeamFilter] = useState<"daily" | "monthly" | "yearly">("daily");
  const [teamFilterDate, setTeamFilterDate] = useState<Date>(new Date());

  // Data distribution state
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; data_mode: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [distDataMode, setDistDataMode] = useState<"lead" | "processing">("lead");
  const [campaignAgents, setCampaignAgents] = useState<{ id: string; name: string }[]>([]);
  const [distAgent, setDistAgent] = useState("");
  const [distCount, setDistCount] = useState("");
  const [distributing, setDistributing] = useState(false);
  const [availableLeads, setAvailableLeads] = useState(0);

  const isBDO = user?.role === "bdo" || user?.role === "business_development_officer" || user?.role === "Business Development And Marketing Manager";

  const loadData = useCallback(async () => {
    if (!user) return;

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

  // Load team attendance for TL
  const loadTeamAttendance = useCallback(async () => {
    if (!user || (!isTL && !isBDO)) return;
    setTeamLoading(true);

    const { data: roles } = await supabase
      .from("campaign_agent_roles")
      .select("agent_id, users!campaign_agent_roles_agent_id_fkey(id, name)")
      .eq("tl_id", user.id);

    if (roles) {
      const members = roles.map((r: any) => ({ id: r.users.id, name: r.users.name }));
      const unique = Array.from(new Map(members.map((m: any) => [m.id, m])).values()) as { id: string; name: string }[];
      setTeamMembers(unique);

      const agentIds = unique.map((m) => m.id);
      if (agentIds.length > 0) {
        let dateStart: string;
        let dateEnd: string;

        if (teamFilter === "daily") {
          const d = format(teamFilterDate, "yyyy-MM-dd");
          dateStart = d;
          dateEnd = d;
        } else if (teamFilter === "monthly") {
          dateStart = format(startOfMonth(teamFilterDate), "yyyy-MM-dd");
          dateEnd = format(endOfMonth(teamFilterDate), "yyyy-MM-dd");
        } else {
          dateStart = format(startOfYear(teamFilterDate), "yyyy-MM-dd");
          dateEnd = format(endOfYear(teamFilterDate), "yyyy-MM-dd");
        }

        const { data: attData } = await supabase
          .from("attendance")
          .select("*")
          .in("user_id", agentIds)
          .gte("date", dateStart)
          .lte("date", dateEnd)
          .order("date", { ascending: false });

        if (attData) {
          const enriched = attData.map((a: any) => ({
            ...a,
            userName: unique.find((m) => m.id === a.user_id)?.name || "Unknown",
          }));
          setTeamAttendance(enriched);
        }
      }
    }
    setTeamLoading(false);
  }, [user, isTL, isBDO, teamFilter, teamFilterDate]);

  // Load campaigns for data distribution
  const loadCampaigns = useCallback(async () => {
    if (!user || (!isTL && !isBDO)) return;
    if (isBDO) {
      const { data } = await supabase.from("campaigns").select("id, name").order("created_at", { ascending: false });
      if (data) setCampaigns(data.map((c: any) => ({ id: c.id, name: c.name })));
    } else {
      const { data } = await supabase.from("campaign_tls").select("campaign_id, campaigns(id, name)").eq("tl_id", user.id);
      if (data) {
        const list = data.map((d: any) => d.campaigns).filter(Boolean).map((c: any) => ({ id: c.id, name: c.name }));
        setCampaigns(list);
      }
    }
  }, [user, isTL, isBDO]);

  // Load agents for selected campaign
  const loadCampaignAgents = useCallback(async () => {
    if (!user || !selectedCampaign) { setCampaignAgents([]); setAvailableLeads(0); return; }

    let q = supabase
      .from("campaign_agent_roles")
      .select("agent_id, users!campaign_agent_roles_agent_id_fkey(id, name)")
      .eq("campaign_id", selectedCampaign);
    if (!isBDO) q = q.eq("tl_id", user.id);

    const { data: roles } = await q;
    if (roles) {
      const agents = roles.map((r: any) => ({ id: r.users.id, name: r.users.name }));
      const unique = Array.from(new Map(agents.map((a: any) => [a.id, a])).values());
      setCampaignAgents(unique);
    }

    // Count available unassigned leads
    let leadQ = supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", selectedCampaign)
      .is("assigned_to", null)
      .eq("status", "fresh");
    if (!isBDO) leadQ = leadQ.eq("tl_id", user.id);
    const { count } = await leadQ;
    setAvailableLeads(count || 0);
  }, [user, selectedCampaign, isBDO]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (isTL || isBDO) { loadTeamAttendance(); loadCampaigns(); } }, [loadTeamAttendance, loadCampaigns, isTL, isBDO]);
  useEffect(() => { loadCampaignAgents(); }, [loadCampaignAgents]);

  // Set first campaign as default
  useEffect(() => {
    if (campaigns.length > 0 && !selectedCampaign) setSelectedCampaign(campaigns[0].id);
  }, [campaigns]);

  const presentDays = attendance.filter((a) => a.clock_in).length;

  const verifyLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error("GPS সাপোর্ট নেই")); return; }
      navigator.geolocation.getCurrentPosition(resolve, (err) => {
        if (err.code === 1) reject(new Error("লোকেশন অনুমতি দিন"));
        else if (err.code === 2) reject(new Error("লোকেশন পাওয়া যাচ্ছে না"));
        else reject(new Error("লোকেশন টাইমআউট"));
      }, { enableHighAccuracy: true, timeout: 15000 });
    });
  };

  const handleCheckIn = async () => {
    if (!user || !checkInMood) { toast.error("মুড নির্বাচন করুন"); return; }
    setGpsChecking(true);
    setGpsError("");
    try {
      const pos = await verifyLocation();
      const { latitude, longitude } = pos.coords;
      if (officeLocation) {
        const dist = getDistanceMeters(latitude, longitude, officeLocation.lat, officeLocation.lon);
        if (dist > OFFICE_RADIUS_METERS) {
          setGpsError(`আপনি অফিস থেকে ${Math.round(dist)} মিটার দূরে আছেন। অফিসে এসে Check In করুন।`);
          setGpsChecking(false);
          return;
        }
      }
      const now = new Date().toISOString();
      if (todayRecord) {
        await supabase.from("attendance").update({
          clock_in: now, mood_in: checkInMood, mood_note: checkInNote || null,
          is_late: false, deduction_amount: 0,
        }).eq("id", todayRecord.id);
      } else {
        await supabase.from("attendance").insert({
          user_id: user.id, date: todayStr(), clock_in: now,
          mood_in: checkInMood, mood_note: checkInNote || null,
          is_late: false, deduction_amount: 0,
        });
      }
      setShowCheckInModal(false);
      setCheckInMood("");
      setCheckInNote("");
      await loadData();
      toast.success("Check In সফল ✓");
    } catch (err: any) {
      setGpsError(err.message || "লোকেশন যাচাই ব্যর্থ");
    } finally {
      setGpsChecking(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user || !checkOutMood) { toast.error("মুড নির্বাচন করুন"); return; }
    const now = new Date().toISOString();
    if (todayRecord) {
      await supabase.from("attendance").update({
        clock_out: now, mood_out: checkOutMood, is_early_out: false, deduction_amount: 0,
      }).eq("id", todayRecord.id);
    }
    setShowCheckOutModal(false);
    setCheckOutMood("");
    await loadData();
    toast.success("Check Out সফল ✓");
  };

  // Data distribution handler
  const handleDistribute = async () => {
    if (!user || !distAgent || !distCount || !selectedCampaign) return;
    const count = parseInt(distCount);
    if (isNaN(count) || count <= 0) { toast.error("সঠিক সংখ্যা দিন"); return; }
    if (count > availableLeads) { toast.error(`মাত্র ${availableLeads} টি ডাটা আছে`); return; }

    setDistributing(true);
    try {
      // Fetch unassigned leads for this campaign
      let q = supabase
        .from("leads")
        .select("id")
        .eq("campaign_id", selectedCampaign)
        .is("assigned_to", null)
        .eq("status", "fresh")
        .order("created_at", { ascending: true })
        .limit(count);
      if (!isBDO) q = q.eq("tl_id", user.id);

      const { data: leads, error: fetchErr } = await q;
      if (fetchErr) throw fetchErr;
      if (!leads || leads.length === 0) { toast.error("কোনো ডাটা পাওয়া যায়নি"); return; }

      // Assign each lead to the selected agent
      const ids = leads.map((l: any) => l.id);
      const { error: updateErr } = await supabase
        .from("leads")
        .update({ assigned_to: distAgent, agent_type: "bronze" })
        .in("id", ids);

      if (updateErr) throw updateErr;

      toast.success(`${leads.length} টি ডাটা সফলভাবে হস্তান্তর হয়েছে`);
      setDistAgent("");
      setDistCount("");
      await loadCampaignAgents();
    } catch (err: any) {
      toast.error("হস্তান্তর ব্যর্থ: " + (err.message || ""));
    } finally {
      setDistributing(false);
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  const hasCheckedIn = !!todayRecord?.clock_in;
  const hasCheckedOut = !!todayRecord?.clock_out;

  const MyAttendanceContent = () => (
    <div className="space-y-6">
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
                <Button onClick={() => { setCheckInMood(""); setCheckInNote(""); setShowCheckInModal(true); }} className="bg-green-600 hover:bg-green-700 text-white">
                  <LogIn className="h-4 w-4 mr-2" /> Check In
                </Button>
              )}
              {hasCheckedIn && !hasCheckedOut && (
                <Button onClick={() => { setCheckOutMood(""); setShowCheckOutModal(true); }} variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
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
    </div>
  );

  const TeamAttendanceContent = () => {
    const presentCount = teamFilter === "daily"
      ? teamAttendance.filter(a => a.clock_in).length
      : new Set(teamAttendance.filter(a => a.clock_in).map(a => a.user_id)).size;

    const filterLabel = teamFilter === "daily"
      ? format(teamFilterDate, "dd MMMM yyyy", { locale: bn })
      : teamFilter === "monthly"
        ? format(teamFilterDate, "MMMM yyyy", { locale: bn })
        : format(teamFilterDate, "yyyy");

    return (
      <div className="space-y-4">
        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={teamFilter} onValueChange={(v) => setTeamFilter(v as any)} className="w-auto">
            <TabsList className="h-8">
              <TabsTrigger value="daily" className="text-xs px-3 h-7">দৈনিক</TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs px-3 h-7">মাসিক</TabsTrigger>
              <TabsTrigger value="yearly" className="text-xs px-3 h-7">বাৎসরিক</TabsTrigger>
            </TabsList>
          </Tabs>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {filterLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={teamFilterDate}
                onSelect={(d) => d && setTeamFilterDate(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setTeamFilterDate(new Date())}>
            আজ
          </Button>
        </div>

        {/* Summary badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">{filterLabel}</Badge>
          <Badge variant="outline" className="text-xs">মোট সদস্য: {teamMembers.length}</Badge>
          {teamFilter === "daily" && (
            <>
              <Badge variant="outline" className="text-xs text-green-400 border-green-600/50">
                উপস্থিত: {presentCount}
              </Badge>
              <Badge variant="outline" className="text-xs text-red-400 border-red-600/50">
                অনুপস্থিত: {teamMembers.length - presentCount}
              </Badge>
            </>
          )}
          {teamFilter !== "daily" && (
            <Badge variant="outline" className="text-xs">মোট রেকর্ড: {teamAttendance.length}</Badge>
          )}
        </div>

        {teamLoading ? (
          <div className="py-8 text-center text-muted-foreground">লোড হচ্ছে...</div>
        ) : teamFilter === "daily" ? (
          /* Daily view: one row per member */
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 px-2 text-left">নাম</th>
                      <th className="py-2 px-2 text-left">Check In</th>
                      <th className="py-2 px-2 text-left">Check Out</th>
                      <th className="py-2 px-2 text-center">মুড</th>
                      <th className="py-2 px-2 text-center">স্ট্যাটাস</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member) => {
                      const att = teamAttendance.find(a => a.user_id === member.id);
                      return (
                        <tr key={member.id} className="border-b border-border">
                          <td className="py-2 px-2 font-medium">{member.name}</td>
                          <td className="py-2 px-2 text-xs">
                            {att?.clock_in ? new Date(att.clock_in).toLocaleTimeString("bn-BD") : "—"}
                          </td>
                          <td className="py-2 px-2 text-xs">
                            {att?.clock_out ? new Date(att.clock_out).toLocaleTimeString("bn-BD") : att?.clock_in ? <span className="text-blue-400">চলমান</span> : "—"}
                          </td>
                          <td className="py-2 px-2 text-center text-lg">
                            {att?.mood_in ? MOOD_EMOJIS[att.mood_in] || "—" : "—"}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {att?.clock_in ? (
                              <Badge variant="outline" className="text-green-400 border-green-600/50 text-xs">উপস্থিত</Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-400 border-red-600/50 text-xs">অনুপস্থিত</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {teamMembers.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">কোনো টিম মেম্বার পাওয়া যায়নি</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Monthly/Yearly view: summary per member + detail rows */
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 px-2 text-left">নাম</th>
                      <th className="py-2 px-2 text-center">উপস্থিত দিন</th>
                      <th className="py-2 px-2 text-center">দেরি</th>
                      <th className="py-2 px-2 text-center">আগে বের</th>
                      <th className="py-2 px-2 text-right">মোট কর্তন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member) => {
                      const memberAtt = teamAttendance.filter(a => a.user_id === member.id);
                      const presentDays = memberAtt.filter(a => a.clock_in).length;
                      const lateDays = memberAtt.filter(a => a.is_late).length;
                      const earlyOuts = memberAtt.filter(a => a.is_early_out).length;
                      const totalDeductions = memberAtt.reduce((sum, a) => sum + (a.deduction_amount || 0), 0);
                      return (
                        <tr key={member.id} className="border-b border-border">
                          <td className="py-2 px-2 font-medium">{member.name}</td>
                          <td className="py-2 px-2 text-center">{presentDays}</td>
                          <td className="py-2 px-2 text-center">{lateDays > 0 ? <span className="text-orange-400">{lateDays}</span> : "0"}</td>
                          <td className="py-2 px-2 text-center">{earlyOuts > 0 ? <span className="text-orange-400">{earlyOuts}</span> : "0"}</td>
                          <td className="py-2 px-2 text-right">{totalDeductions > 0 ? <span className="text-destructive">৳{totalDeductions}</span> : <span className="text-green-400">৳০</span>}</td>
                        </tr>
                      );
                    })}
                    {teamMembers.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">কোনো টিম মেম্বার পাওয়া যায়নি</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const DataDistributionContent = () => (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" /> ডাটা হস্তান্তর
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Campaign select */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">ক্যাম্পেইন</Label>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="border-border">
                <SelectValue placeholder="ক্যাম্পেইন নির্বাচন করুন" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCampaign && (
            <>
              <div className="rounded-md bg-secondary p-3">
                <p className="text-sm text-muted-foreground">
                  অ্যাসাইন না হওয়া ডাটা: <span className="font-bold text-foreground">{availableLeads}</span> টি
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Agent select */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">এজেন্ট</Label>
                  <Select value={distAgent} onValueChange={setDistAgent}>
                    <SelectTrigger className="border-border">
                      <SelectValue placeholder="এজেন্ট নির্বাচন" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaignAgents.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Count input */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">সংখ্যা</Label>
                  <Input
                    type="number"
                    min={1}
                    max={availableLeads}
                    value={distCount}
                    onChange={e => setDistCount(e.target.value)}
                    placeholder="কতটি ডাটা?"
                  />
                </div>

                {/* Submit */}
                <div className="flex items-end">
                  <Button
                    onClick={handleDistribute}
                    disabled={!distAgent || !distCount || distributing || availableLeads === 0}
                    className="w-full"
                  >
                    {distributing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    পাঠাও
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" /> উপস্থিতি
        </h1>
        <Badge variant="outline" className="text-xs border-primary/30 text-primary">
          <MapPin className="h-3 w-3 mr-1" />
          অফিসে উপস্থিত — কোনো কর্তন নেই
        </Badge>
      </div>

      {(isTL || isBDO) ? (
        <Tabs defaultValue="my">
          <TabsList>
            <TabsTrigger value="my">আমার উপস্থিতি</TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> টিম উপস্থিতি
            </TabsTrigger>
            <TabsTrigger value="distribute" className="flex items-center gap-1">
              <Send className="h-3.5 w-3.5" /> ডাটা হস্তান্তর
            </TabsTrigger>
          </TabsList>
          <TabsContent value="my"><MyAttendanceContent /></TabsContent>
          <TabsContent value="team"><TeamAttendanceContent /></TabsContent>
          <TabsContent value="distribute"><DataDistributionContent /></TabsContent>
        </Tabs>
      ) : (
        <MyAttendanceContent />
      )}

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
            {gpsError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <MapPin className="inline h-4 w-4 mr-1" />{gpsError}
              </div>
            )}
            {!officeLocation && (
              <div className="rounded-md border border-orange-500/50 bg-orange-500/10 p-3 text-sm text-orange-400">
                ⚠️ আপনার অফিস লোকেশন সেট করা নেই। অ্যাডমিনের সাথে যোগাযোগ করুন।
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleCheckIn} disabled={!checkInMood || gpsChecking || !officeLocation}>
              {gpsChecking ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> লোকেশন যাচাই...</> : "Check In নিশ্চিত করুন"}
            </Button>
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
