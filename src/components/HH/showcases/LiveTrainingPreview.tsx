import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.25, 0.4, 0.25, 1];

const chatMessages = [
  { name: "Hugo Herbots", role: "host", text: "Vandaag gaan we het hebben over bezwaarbehandeling in fase 4.", time: "14:02" },
  { name: "Sarah van Dijk", role: "viewer", text: "Heeft u tips voor prijsbezwaren bij enterprise deals?", time: "14:08" },
  { name: "Mark Peters", role: "viewer", text: "Hoe ga je om met 'we hebben al een leverancier'?", time: "14:12" },
];

export function LiveTrainingPreview() {
  const prefersReduced = useReducedMotion();
  const [visibleMessages, setVisibleMessages] = useState(prefersReduced ? chatMessages.length : 0);

  useEffect(() => {
    if (prefersReduced) return;
    const timers = chatMessages.map((_, i) =>
      setTimeout(() => setVisibleMessages(i + 1), 600 + i * 900)
    );
    return () => timers.forEach(clearTimeout);
  }, [prefersReduced]);

  return (
    <div className="rounded-2xl overflow-hidden border border-[#E4E4E4] shadow-[0_8px_30px_rgba(0,0,0,0.08)] bg-white">
      <div className="relative">
        <video
          src="/videos/hero-hugo-schrijft.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/images/hugo_zo_train_ik.png"
          className="w-full aspect-[16/9] object-cover"
        />

        <div className="absolute top-4 left-4 flex items-center gap-2">
          <span className="flex items-center gap-1.5 bg-red-600 text-white text-[12px] font-semibold px-3 py-1.5 rounded-full shadow-lg">
            <span className="relative flex h-2 w-2">
              {!prefersReduced && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />}
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            LIVE
          </span>
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-[12px] px-3 py-1.5 rounded-full">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg>
          127 kijkers
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pt-16 pb-4 px-5">
          <p className="text-white text-[16px] font-semibold leading-tight">Live Coaching: Bezwaarbehandeling</p>
          <p className="text-white/60 text-[13px] mt-1">Fase 4 · Beslissingsfase · 14:00 – 15:00</p>
        </div>
      </div>

      <div className="border-t border-[#E4E4E4]">
        <div className="px-5 py-3 space-y-3">
          {chatMessages.map((msg, i) => (
            <motion.div
              key={i}
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={i < visibleMessages ? { opacity: 1, y: 0 } : {}}
              transition={prefersReduced ? { duration: 0 } : { duration: 0.35, ease }}
              className="flex items-start gap-3"
            >
              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white ${msg.role === "host" ? "bg-[#2B3748]" : "bg-[#9CA3AF]"}`}>
                {msg.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[#1C2535]">{msg.name}</span>
                  {msg.role === "host" && <span className="text-[10px] bg-[#2B3748] text-white px-1.5 py-0.5 rounded font-medium">HOST</span>}
                  <span className="text-[11px] text-[#9CA3AF] ml-auto flex-shrink-0">{msg.time}</span>
                </div>
                <p className="text-[13px] text-[#6B7A92] leading-[20px] mt-0.5">{msg.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
