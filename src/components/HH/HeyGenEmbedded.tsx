import { useEffect, useRef } from "react";

interface HeyGenEmbeddedProps {
  isActive: boolean;
}

export function HeyGenEmbedded({ isActive }: HeyGenEmbeddedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // LiveAvatar embed URL
    const liveAvatarUrl = "https://embed.liveavatar.com/v1/fa6ef0c3-d6a6-11f0-a99e-066a7fa2e369";

    // Set iframe source
    if (iframeRef.current && !iframeRef.current.src) {
      iframeRef.current.src = liveAvatarUrl;
    }
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full">
      {/* LiveAvatar iframe */}
      <iframe
        ref={iframeRef}
        title="LiveAvatar Interactive Hugo"
        allow="microphone"
        className="absolute inset-0 w-full h-full border-0"
        style={{
          aspectRatio: "16/9",
        }}
      />
    </div>
  );
}