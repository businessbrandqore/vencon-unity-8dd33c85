import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { User, Volume2, Globe, Camera, Loader2 } from "lucide-react";
import MonthlyOffsSection from "@/components/profile/MonthlyOffsSection";
import ComplaintSection from "@/components/profile/ComplaintSection";

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
  avatar_url: string | null;
}

export default function ProfileSettings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState("bn");
  const [volume, setVolume] = useState(70);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setNewPassword(""); setConfirmPassword("");
      await supabase.from("users").update({ must_change_password: false }).eq("id", user!.id);
    }
    setChangingPassword(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) { toast.error("ফাইল ২MB এর বেশি হতে পারবে না"); return; }
    if (!file.type.startsWith("image/")) { toast.error("শুধু ছবি আপলোড করুন"); return; }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `avatars/${user.id}.${ext}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("app-assets")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("ছবি আপলোড করতে সমস্যা হয়েছে");
      setUploading(false);
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("app-assets").getPublicUrl(filePath);
    const avatarUrl = urlData.publicUrl + `?t=${Date.now()}`;

    // Update user record
    await supabase.from("users").update({ avatar_url: avatarUrl } as any).eq("id", user.id);
    setProfile((p) => p ? { ...p, avatar_url: avatarUrl } : p);
    setUploading(false);
    toast.success("প্রোফাইল ছবি আপডেট হয়েছে ✓");
  };

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;
  if (!profile) return null;

  const initials = profile.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl flex items-center gap-2">
        <User className="h-5 w-5 text-primary" /> প্রোফাইল ও সেটিংস
      </h1>

      {/* Avatar & Profile Info */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading">প্রোফাইল তথ্য</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-2 border-border">
                  {profile.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile.name} />
                  ) : null}
                  <AvatarFallback className="text-2xl font-heading bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {uploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-muted-foreground">ছবি পরিবর্তন করতে ক্লিক করুন</p>
            </div>

            {/* Info Grid */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  {profile.shift_start && profile.shift_end ? `${profile.shift_start} — ${profile.shift_end}` : "নির্ধারিত নয়"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Offs */}
      <MonthlyOffsSection userId={profile.id} />

      {/* Complaints */}
      <ComplaintSection userId={profile.id} />

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
          <Button onClick={savePreferences} className="bg-primary hover:bg-primary/80 text-primary-foreground">সংরক্ষণ করুন</Button>
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
