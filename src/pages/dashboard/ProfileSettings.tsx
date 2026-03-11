import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { User, Volume2, Globe } from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  panel: string;
  preferred_language: string | null;
  notification_volume: number | null;
  shift_start: string | null;
  shift_end: string | null;
  department: string | null;
  designation: string | null;
}

export default function ProfileSettings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState("bn");
  const [volume, setVolume] = useState(70);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("users").select("*").eq("id", user.id).single();
      if (data) {
        const p = data as unknown as UserProfile;
        setProfile(p);
        setLanguage(p.preferred_language || "bn");
        setVolume(p.notification_volume ?? 70);
      }
      setLoading(false);
    })();
  }, [user]);

  const savePreferences = async () => {
    if (!user) return;
    await supabase.from("users").update({
      preferred_language: language,
      notification_volume: volume,
    }).eq("id", user.id);
    toast.success("সেটিংস সংরক্ষণ হয়েছে ✓");
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে"); return; }
    if (newPassword !== confirmPassword) { toast.error("পাসওয়ার্ড মিলছে না"); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error("পাসওয়ার্ড পরিবর্তন করতে সমস্যা হয়েছে");
    } else {
      toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে ✓");
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
      // Clear must_change_password flag
      await supabase.from("users").update({ must_change_password: false }).eq("id", user!.id);
    }
    setChangingPassword(false);
  };

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl flex items-center gap-2">
        <User className="h-5 w-5 text-primary" /> প্রোফাইল ও সেটিংস
      </h1>

      {/* Profile Info */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading">প্রোফাইল তথ্য</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">নাম</Label>
              <p className="font-medium mt-1">{profile.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">ইমেইল</Label>
              <p className="font-medium mt-1">{profile.email}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">ফোন</Label>
              <p className="font-medium mt-1">{profile.phone || "—"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">পদবি</Label>
              <p className="font-medium mt-1">{profile.designation || profile.role}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">বিভাগ</Label>
              <p className="font-medium mt-1">{profile.department || "—"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">শিফট</Label>
              <p className="font-medium mt-1">
                {profile.shift_start && profile.shift_end
                  ? `${profile.shift_start} — ${profile.shift_end}`
                  : "নির্ধারিত নয়"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading">পছন্দসমূহ</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <Label>ভাষা</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="mt-1 w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bn">বাংলা</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Volume2 className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <Label>নোটিফিকেশন ভলিউম: {volume}%</Label>
              <Slider value={[volume]} onValueChange={(v) => setVolume(v[0])} max={100} step={10} className="mt-2 w-[300px]" />
            </div>
          </div>

          <Button onClick={savePreferences} className="bg-primary hover:bg-primary/80 text-primary-foreground">
            সংরক্ষণ করুন
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading">পাসওয়ার্ড পরিবর্তন</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md">
            <div>
              <Label>নতুন পাসওয়ার্ড</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1" />
            </div>
            <div className="mt-3">
              <Label>পাসওয়ার্ড নিশ্চিত করুন</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1" />
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword} variant="outline" className="mt-4">
              {changingPassword ? "পরিবর্তন হচ্ছে..." : "পাসওয়ার্ড পরিবর্তন করুন"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
