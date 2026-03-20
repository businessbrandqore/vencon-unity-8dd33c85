import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, PhoneCall, Mic, MicOff } from "lucide-react";

type CallStatus = "idle" | "calling" | "incoming" | "connected";

interface CallInfo {
  callId: string;
  conversationId: string;
  callerId: string;
  callerName: string;
}

interface ChatCallOverlayProps {
  currentUserId: string;
  onCallStateChange?: (active: boolean) => void;
  outgoingCall?: { conversationId: string; callerName: string } | null;
  onOutgoingCallHandled?: () => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const createRingtone = () => {
  let intervalId: number | null = null;
  let audioCtx: AudioContext | null = null;

  const play = () => {
    try {
      audioCtx = new AudioContext();
      const playTone = () => {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const playNote = (freq: number, start: number, dur: number) => {
          const osc = audioCtx!.createOscillator();
          const gain = audioCtx!.createGain();
          osc.frequency.value = freq;
          osc.type = "sine";
          gain.gain.value = 0.15;
          osc.connect(gain);
          gain.connect(audioCtx!.destination);
          gain.gain.setValueAtTime(0.15, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
          osc.start(start);
          osc.stop(start + dur);
        };
        playNote(880, now, 0.15);
        playNote(1100, now + 0.18, 0.15);
        playNote(880, now + 0.36, 0.15);
        playNote(1100, now + 0.54, 0.15);
      };
      playTone();
      intervalId = window.setInterval(playTone, 2000);
    } catch {}
  };

  const stop = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    audioCtx?.close();
    audioCtx = null;
  };

  return { play, stop };
};

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const ChatCallOverlay = ({ currentUserId, onCallStateChange, outgoingCall, onOutgoingCallHandled }: ChatCallOverlayProps) => {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const ringtoneRef = useRef(createRingtone());
  const timerRef = useRef<number | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const signalingChannelRef = useRef<any>(null);

  // Use refs for realtime handler to avoid stale closures
  const callInfoRef = useRef<CallInfo | null>(null);
  const statusRef = useRef<CallStatus>("idle");
  callInfoRef.current = callInfo;
  statusRef.current = status;

  const endCallCleanup = useCallback(() => {
    ringtoneRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    
    // Close peer connection
    peerRef.current?.close();
    peerRef.current = null;
    
    // Stop local audio
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    
    // Clean up signaling channel
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
      signalingChannelRef.current = null;
    }
    
    setStatus("idle");
    setCallInfo(null);
    setDuration(0);
    setIsMuted(false);
    onCallStateChange?.(false);
  }, [onCallStateChange]);

  const endCallCleanupRef = useRef(endCallCleanup);
  endCallCleanupRef.current = endCallCleanup;

  // Setup WebRTC signaling channel for a call
  const setupSignaling = useCallback((callId: string, isCaller: boolean) => {
    const channelName = `webrtc-${callId}`;
    
    // Remove existing channel if any
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
    }

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "webrtc-signal" }, async (payload: any) => {
        const { type, data, from } = payload.payload;
        if (from === currentUserId) return;

        const pc = peerRef.current;
        if (!pc) return;

        try {
          if (type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: "broadcast",
              event: "webrtc-signal",
              payload: { type: "answer", data: answer, from: currentUserId },
            });
          } else if (type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
          } else if (type === "ice-candidate") {
            await pc.addIceCandidate(new RTCIceCandidate(data));
          }
        } catch (err) {
          console.error("WebRTC signaling error:", err);
        }
      })
      .subscribe();

    signalingChannelRef.current = channel;
    return channel;
  }, [currentUserId]);

  // Create peer connection and start audio
  const setupPeerConnection = useCallback(async (callId: string, isCaller: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        } as MediaTrackConstraints,
      });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerRef.current = pc;

      // Add local audio tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Handle remote audio
      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      };

      // Send ICE candidates via broadcast
      pc.onicecandidate = (event) => {
        if (event.candidate && signalingChannelRef.current) {
          signalingChannelRef.current.send({
            type: "broadcast",
            event: "webrtc-signal",
            payload: {
              type: "ice-candidate",
              data: event.candidate.toJSON(),
              from: currentUserId,
            },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          endCallCleanupRef.current();
        }
      };

      // If caller, create and send offer
      if (isCaller) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signalingChannelRef.current?.send({
          type: "broadcast",
          event: "webrtc-signal",
          payload: { type: "offer", data: offer, from: currentUserId },
        });
      }

      return pc;
    } catch (err) {
      console.error("Failed to setup WebRTC:", err);
      return null;
    }
  }, [currentUserId]);

  // Handle outgoing call trigger from parent
  useEffect(() => {
    if (!outgoingCall || status !== "idle") return;
    (async () => {
      const { data: call, error } = await supabase
        .from("chat_calls")
        .insert({
          conversation_id: outgoingCall.conversationId,
          caller_id: currentUserId,
          status: "ringing",
        })
        .select()
        .single();

      if (error || !call) {
        onOutgoingCallHandled?.();
        return;
      }

      const newCallInfo: CallInfo = {
        callId: call.id,
        conversationId: outgoingCall.conversationId,
        callerId: currentUserId,
        callerName: outgoingCall.callerName,
      };
      setCallInfo(newCallInfo);
      setStatus("calling");
      ringtoneRef.current.play();
      onOutgoingCallHandled?.();

      // Setup signaling channel while ringing
      setupSignaling(call.id, true);

      // Auto-timeout after 30s
      const callId = call.id;
      setTimeout(async () => {
        if (statusRef.current === "calling" && callInfoRef.current?.callId === callId) {
          await supabase
            .from("chat_calls")
            .update({ status: "missed", ended_at: new Date().toISOString() })
            .eq("id", callId);
          endCallCleanupRef.current();
        }
      }, 30000);
    })();
  }, [outgoingCall]);

  // Listen for incoming calls & call status updates
  useEffect(() => {
    const channel = supabase
      .channel(`call-signals-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_calls" },
        async (payload: any) => {
          const call = payload.new;
          if (call.caller_id === currentUserId || call.status !== "ringing") return;
          if (statusRef.current !== "idle") return;

          const { data: part } = await supabase
            .from("chat_participants")
            .select("user_id")
            .eq("conversation_id", call.conversation_id)
            .eq("user_id", currentUserId)
            .maybeSingle();

          if (!part) return;

          const { data: caller } = await supabase
            .from("users")
            .select("name")
            .eq("id", call.caller_id)
            .single();

          setCallInfo({
            callId: call.id,
            conversationId: call.conversation_id,
            callerId: call.caller_id,
            callerName: caller?.name || "Unknown",
          });
          setStatus("incoming");
          ringtoneRef.current.play();

          // Setup signaling channel for receiving
          setupSignaling(call.id, false);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_calls" },
        async (payload: any) => {
          const call = payload.new;
          const ci = callInfoRef.current;
          const st = statusRef.current;
          if (!ci || call.id !== ci.callId) return;

          if (call.status === "active" && st === "calling") {
            // Other side accepted - start WebRTC as caller
            ringtoneRef.current.stop();
            setStatus("connected");
            setDuration(0);
            timerRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000);
            onCallStateChange?.(true);
            
            // Setup peer connection as caller
            await setupPeerConnection(ci.callId, true);
          }

          if (call.status === "ended" || call.status === "rejected" || call.status === "missed") {
            endCallCleanupRef.current();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, setupSignaling, setupPeerConnection]);

  const acceptCall = async () => {
    if (!callInfo) return;
    ringtoneRef.current.stop();

    await supabase
      .from("chat_calls")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", callInfo.callId);

    setStatus("connected");
    setDuration(0);
    timerRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000);
    onCallStateChange?.(true);

    // Setup peer connection as receiver (will wait for offer via signaling)
    await setupPeerConnection(callInfo.callId, false);
  };

  const rejectCall = async () => {
    if (!callInfo) return;
    await supabase
      .from("chat_calls")
      .update({ status: "rejected", ended_at: new Date().toISOString() })
      .eq("id", callInfo.callId);
    endCallCleanup();
  };

  const endCall = async () => {
    if (!callInfo) return;
    await supabase
      .from("chat_calls")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", callInfo.callId);
    endCallCleanup();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  if (status === "idle") return null;

  return (
    <div className="fixed inset-0 bg-background/90 z-[100] flex items-center justify-center">
      {/* Hidden audio element for remote audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      
      <div className="bg-card border border-border rounded-2xl p-8 w-80 text-center shadow-2xl">
        <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
          status === "connected" ? "bg-emerald-500/20" : "bg-primary/20 animate-pulse"
        }`}>
          <PhoneCall className={`h-8 w-8 ${status === "connected" ? "text-emerald-500" : "text-primary"}`} />
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-1">
          {status === "calling" && "Calling..."}
          {status === "incoming" && callInfo?.callerName}
          {status === "connected" && (callInfo?.callerId === currentUserId ? "Connected" : callInfo?.callerName)}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {status === "calling" && "Ringing..."}
          {status === "incoming" && "Incoming call"}
          {status === "connected" && formatDuration(duration)}
        </p>

        <div className="flex items-center justify-center gap-4">
          {status === "incoming" && (
            <>
              <Button
                size="lg"
                variant="destructive"
                className="rounded-full w-14 h-14"
                onClick={rejectCall}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              <Button
                size="lg"
                className="rounded-full w-14 h-14 bg-emerald-500 hover:bg-emerald-600"
                onClick={acceptCall}
              >
                <Phone className="h-6 w-6" />
              </Button>
            </>
          )}

          {(status === "calling" || status === "connected") && (
            <div className="flex items-center gap-3">
              {status === "connected" && (
                <Button
                  size="lg"
                  variant={isMuted ? "secondary" : "outline"}
                  className="rounded-full w-14 h-14"
                  onClick={toggleMute}
                >
                  {isMuted ? <MicOff className="h-6 w-6 text-destructive" /> : <Mic className="h-6 w-6" />}
                </Button>
              )}
              <Button
                size="lg"
                variant="destructive"
                className="rounded-full w-14 h-14"
                onClick={endCall}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { ChatCallOverlay, type ChatCallOverlayProps };
export default ChatCallOverlay;
