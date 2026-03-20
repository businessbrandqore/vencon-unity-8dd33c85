import { useState, useEffect, useCallback } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const MediaPermissionButtons = () => {
  const [micAllowed, setMicAllowed] = useState<boolean | null>(null);
  const [speakerTested, setSpeakerTested] = useState(false);

  // Check current mic permission on mount
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: "microphone" as PermissionName }).then((status) => {
        setMicAllowed(status.state === "granted");
        status.onchange = () => setMicAllowed(status.state === "granted");
      }).catch(() => {});
    }
  }, []);

  const requestMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicAllowed(true);
      toast.success("মাইক্রোফোন অনুমতি দেওয়া হয়েছে ✓");
    } catch {
      setMicAllowed(false);
      toast.error("মাইক্রোফোন অনুমতি দিতে ব্রাউজার সেটিংস চেক করুন");
    }
  }, []);

  const testSpeaker = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 440;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      osc.onended = () => ctx.close();
      setSpeakerTested(true);
      toast.success("স্পিকার কাজ করছে ✓");
    } catch {
      toast.error("স্পিকার টেস্ট ব্যর্থ হয়েছে");
    }
  }, []);

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant="ghost"
        className={`h-8 w-8 ${micAllowed === true ? "text-green-500" : micAllowed === false ? "text-destructive" : ""}`}
        onClick={requestMic}
        title="মাইক্রোফোন অনুমতি দিন"
      >
        {micAllowed === false ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className={`h-8 w-8 ${speakerTested ? "text-green-500" : ""}`}
        onClick={testSpeaker}
        title="স্পিকার টেস্ট করুন"
      >
        {speakerTested ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </Button>
    </div>
  );
};

export default MediaPermissionButtons;
