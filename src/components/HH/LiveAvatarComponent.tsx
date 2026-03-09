/**
 * LiveAvatar React Component
 *
 * UI wrapper around useLiveAvatar hook for admin view.
 * Shows a Card with video, controls, and transcript.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Video, VideoOff, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { useAvatarProvider, type AvatarPlatform } from "../../hooks/useAvatarProvider";

interface LiveAvatarProps {
  v2SessionId?: string;
  onAvatarSpeech?: (text: string) => void;
  onUserSpeech?: (text: string) => void;
  language?: string;
  platform?: AvatarPlatform;
}

export function LiveAvatarComponent({
  onAvatarSpeech,
  onUserSpeech,
  language = "nl",
  platform = "heygen"
}: LiveAvatarProps) {
  const avatar = useAvatarProvider(platform, { language, onAvatarSpeech, onUserSpeech });

  const getStatusColor = () => {
    switch (avatar.status) {
      case "connected": return "bg-green-500";
      case "connecting": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          LiveAvatar Video
        </CardTitle>
        <Badge className={getStatusColor()}>
          {avatar.status === "connecting" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          {avatar.status}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          {avatar.status === "connected" ? (
            <video
              ref={avatar.videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {avatar.status === "connecting" ? (
                <Loader2 className="h-12 w-12 animate-spin text-white" />
              ) : (
                <VideoOff className="h-12 w-12 text-gray-500" />
              )}
            </div>
          )}

          {avatar.status === "connected" && (
            <div className="absolute bottom-4 left-4 flex gap-2">
              {avatar.isAvatarTalking && (
                <Badge className="bg-blue-500 animate-pulse">
                  Avatar speaking...
                </Badge>
              )}
              {avatar.isUserTalking && (
                <Badge className="bg-green-500 animate-pulse">
                  You're speaking...
                </Badge>
              )}
            </div>
          )}
        </div>

        {avatar.errorMessage && (
          <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {avatar.errorMessage}
          </div>
        )}

        <div className="flex justify-center gap-3">
          {avatar.status === "idle" || avatar.status === "disconnected" || avatar.status === "error" ? (
            <Button
              onClick={avatar.start}
              className="gap-2"
              data-testid="button-start-liveavatar"
            >
              <Phone className="h-4 w-4" />
              Start Video Call
            </Button>
          ) : avatar.status === "connecting" ? (
            <Button disabled className="gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={avatar.toggleMute}
                className="gap-2"
                data-testid="button-toggle-mute"
              >
                {avatar.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {avatar.isMuted ? "Unmute" : "Mute"}
              </Button>

              {avatar.isAvatarTalking && (
                <Button
                  variant="outline"
                  onClick={avatar.interrupt}
                  data-testid="button-interrupt"
                >
                  Interrupt
                </Button>
              )}

              <Button
                variant="destructive"
                onClick={avatar.stop}
                className="gap-2"
                data-testid="button-stop-liveavatar"
              >
                <PhoneOff className="h-4 w-4" />
                End Call
              </Button>
            </>
          )}
        </div>

        {avatar.transcript.length > 0 && (
          <div className="mt-4 max-h-48 overflow-y-auto space-y-2 p-3 bg-muted rounded-lg">
            <h4 className="text-sm font-medium mb-2">Transcript</h4>
            {avatar.transcript.map((entry, i) => (
              <div
                key={i}
                className={`text-sm p-2 rounded ${
                  entry.role === "avatar"
                    ? "bg-blue-100 dark:bg-blue-900/30"
                    : "bg-green-100 dark:bg-green-900/30"
                }`}
              >
                <span className="font-medium">
                  {entry.role === "avatar" ? "Hugo" : "Jij"}:
                </span>{" "}
                {entry.text}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LiveAvatarComponent;
