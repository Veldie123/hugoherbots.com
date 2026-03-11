import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.25, 0.4, 0.25, 1] as const;

const chapters = [
  { time: "00:00", label: "Welkom & recap", done: true },
  { time: "08:15", label: "Bezwaarherkenning", done: true },
  { time: "22:40", label: "Doorvraag-techniek", active: true },
  { time: "35:10", label: "Oplossing framen" },
  { time: "48:00", label: "Q&A" },
];

const chatMessages = [
  { name: "Sarah v.D.", text: "Hoe reageer je op 'we hebben al een leverancier'?", time: "14:23" },
  { name: "Mark P.", text: "Die doorvraagtechniek werkt echt goed bij IT-deals 👍", time: "14:25" },
  { name: "Hugo", text: "Exact Mark! Laat me een live voorbeeld geven...", time: "14:26", isHost: true },
];

export function LiveTrainingPreview() {
  const prefersReduced = useReducedMotion();
  const [animate, setAnimate] = useState(!!prefersReduced);
  const [visibleMessages, setVisibleMessages] = useState(prefersReduced ? chatMessages.length : 0);

  useEffect(() => {
    if (prefersReduced) return;
    const t = setTimeout(() => setAnimate(true), 200);
    return () => clearTimeout(t);
  }, [prefersReduced]);

  useEffect(() => {
    if (prefersReduced) return;
    const timers = chatMessages.map((_, i) =>
      setTimeout(() => setVisibleMessages(i + 1), 800 + i * 700)
    );
    return () => timers.forEach(clearTimeout);
  }, [prefersReduced]);

  return (
    <div className="bg-hh-ink">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 bg-hh-error text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
            <span className="relative flex h-1.5 w-1.5">
              {!prefersReduced && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />}
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
            </span>
            LIVE
          </span>
          <span className="text-white/40 text-[12px]">·</span>
          <span className="text-white/60 text-[12px]">Fase 2 · Ontdekkingsfase</span>
        </div>
        <div className="flex items-center gap-1.5 text-white/60 text-[12px]">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg>
          127
        </div>
      </div>

      {/* Main content: video + chapters */}
      <div className="flex">
        {/* Video area */}
        <div className="flex-1 relative">
          <div className="aspect-[16/10] relative overflow-hidden">
            <img
              src="/images/hugo_zo_train_ik.png"
              alt="Hugo Herbots live training"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-hh-ink/90 via-hh-ink/20 to-transparent" />

            {/* Video info overlay */}
            <motion.div
              className="absolute bottom-3 left-4 right-4"
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
              animate={animate ? { opacity: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.3, ease }}
            >
              <p className="text-white text-[14px] font-semibold mb-2">Doorvraag-techniek in de praktijk</p>
              <div className="flex items-center gap-3">
                <span className="text-white/50 text-[11px] font-mono">22:40</span>
                <div className="flex-1 h-1 rounded-full bg-white/15 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-hh-error"
                    initial={{ width: "0%" }}
                    animate={animate ? { width: "47%" } : {}}
                    transition={{ duration: 2, delay: 0.5, ease: "linear" }}
                  />
                </div>
                <span className="text-white/50 text-[11px] font-mono">48:00</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Chapter sidebar */}
        <div className="w-[170px] border-l border-white/10 bg-white/[0.03] hidden sm:block">
          <div className="px-3 py-2.5 border-b border-white/[0.06]">
            <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">Chapters</span>
          </div>
          <div className="py-1">
            {chapters.map((ch, i) => (
              <motion.div
                key={i}
                initial={prefersReduced ? { opacity: 1 } : { opacity: 0, x: 8 }}
                animate={animate ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.08, ease }}
                className={`flex items-start gap-2 px-3 py-2 transition-colors ${
                  ch.active ? "bg-white/[0.08]" : ""
                }`}
              >
                <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[8px] font-bold ${
                  ch.done
                    ? "bg-hh-success text-white"
                    : ch.active
                    ? "bg-hh-primary text-white"
                    : "bg-white/10 text-white/30"
                }`}>
                  {ch.done ? "✓" : i + 1}
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] leading-[14px] ${
                    ch.active ? "text-white font-medium" : ch.done ? "text-white/60" : "text-white/30"
                  }`}>
                    {ch.label}
                  </p>
                  <p className="text-[9px] text-white/25 mt-0.5">{ch.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Live chat */}
      <div className="border-t border-white/10">
        <div className="px-4 py-2 border-b border-white/[0.06]">
          <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">Live Chat</span>
        </div>
        <div className="px-4 py-2.5 space-y-2.5">
          {chatMessages.map((msg, i) => (
            <motion.div
              key={i}
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
              animate={i < visibleMessages ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.3, ease }}
              className="flex items-start gap-2.5"
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 overflow-hidden ${
                msg.isHost ? "" : "bg-white/10 text-white/60"
              }`}>
                {msg.isHost ? (
                  <img src="/images/Hugo-Herbots-WEB-0350.JPG" alt="Hugo" className="w-full h-full object-cover" />
                ) : (
                  msg.name.split(" ").map(n => n[0]).join("")
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold ${msg.isHost ? "text-hh-primary" : "text-white/80"}`}>
                    {msg.name}
                  </span>
                  {msg.isHost && (
                    <span className="text-[8px] bg-hh-primary/20 text-hh-primary px-1.5 py-0.5 rounded font-medium">HOST</span>
                  )}
                  <span className="text-[10px] text-white/25 ml-auto">{msg.time}</span>
                </div>
                <p className="text-[12px] text-white/55 leading-[18px] mt-0.5">{msg.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
