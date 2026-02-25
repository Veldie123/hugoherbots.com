import { useRef, useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.25, 0.4, 0.25, 1];

const chatMessages = [
  { name: "Hugo Herbots", role: "host", text: "Vandaag gaan we het hebben over bezwaarbehandeling in fase 4.", time: "14:02" },
  { name: "Sarah van Dijk", role: "viewer", text: "Heeft u tips voor prijsbezwaren bij enterprise deals?", time: "14:08" },
  { name: "Mark Peters", role: "viewer", text: "Hoe ga je om met 'we hebben al een leverancier'?", time: "14:12" },
];

export function LiveTrainingPreview({ simplified = false }: { simplified?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const [visibleMessages, setVisibleMessages] = useState(prefersReduced ? chatMessages.length : 0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!animate || prefersReduced) return;
    setVisibleMessages(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    chatMessages.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleMessages(i + 1), 500 + i * 900));
    });
    return () => timers.forEach(clearTimeout);
  }, [animate, prefersReduced]);

  const motionProps = prefersReduced
    ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 } }
    : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, ease } };

  return (
    <motion.div ref={ref} {...motionProps} className="rounded-2xl overflow-hidden border border-[#E4E4E4] shadow-lg bg-white">
      <div className="relative">
        <video
          src="/videos/hero-hugo-schrijft.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/images/hugo_zo_train_ik.png"
          className="w-full aspect-video object-cover"
        />

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-md">
            <span className="relative flex h-2 w-2">
              {!prefersReduced && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />}
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            LIVE
          </span>
        </div>

        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-[11px] px-2.5 py-1 rounded-full">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg>
          127 kijkers
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10 pb-3 px-4">
          <p className="text-white text-[14px] font-semibold">Live Coaching: Bezwaarbehandeling</p>
          <p className="text-white/60 text-[11px]">Fase 4 · Beslissingsfase · 14:00 – 15:00</p>
        </div>
      </div>

      {!simplified && (
        <div className="border-t border-[#E4E4E4] bg-[#FAFAFA]">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#F3F4F6]">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#6B7A92]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              <span className="text-[11px] font-medium text-[#6B7A92]">Chat</span>
            </div>
            <span className="text-[10px] text-[#9CA3AF] bg-[#F3F4F6] px-1.5 py-0.5 rounded">Q&A</span>
          </div>
          <div className="px-3 py-2 space-y-2">
            {chatMessages.map((msg, i) => (
              <motion.div
                key={i}
                initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                animate={i < visibleMessages ? { opacity: 1, y: 0 } : prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                transition={prefersReduced ? { duration: 0 } : { duration: 0.35, ease }}
                className="flex gap-2 items-start"
              >
                <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[7px] font-bold text-white ${msg.role === "host" ? "bg-[#6B7A92]" : "bg-[#B1B2B5]"}`}>
                  {msg.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold ${msg.role === "host" ? "text-[#6B7A92]" : "text-[#2B3748]"}`}>
                      {msg.name}
                    </span>
                    {msg.role === "host" && <span className="text-[7px] bg-[#6B7A92]/10 text-[#6B7A92] px-1 rounded font-medium">HOST</span>}
                    <span className="text-[9px] text-[#9CA3AF] ml-auto">{msg.time}</span>
                  </div>
                  <p className="text-[11px] text-[#2B3748] leading-[15px]">{msg.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
