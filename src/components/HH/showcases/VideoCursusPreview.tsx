import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.25, 0.4, 0.25, 1];

const phases = [
  { num: 1, name: "Openingsfase", total: 6, done: 6, color: "#00C389", complete: true },
  { num: 2, name: "Ontdekkingsfase", total: 8, done: 3, color: "#6B7A92", active: true },
  { num: 3, name: "Aanbevelingsfase", total: 6, done: 0, color: "#D1D5DB" },
  { num: 4, name: "Beslissingsfase", total: 5, done: 0, color: "#D1D5DB" },
];

export function VideoCursusPreview() {
  const prefersReduced = useReducedMotion();
  const [animate, setAnimate] = useState(!!prefersReduced);

  useEffect(() => {
    if (prefersReduced) return;
    const t = setTimeout(() => setAnimate(true), 200);
    return () => clearTimeout(t);
  }, [prefersReduced]);

  return (
    <div className="rounded-2xl overflow-hidden border border-[#E4E4E4] shadow-[0_8px_30px_rgba(0,0,0,0.08)] bg-white">
      <div className="relative aspect-[16/9] bg-[#1C2535] overflow-hidden">
        <img
          src="/images/Hugo-Herbots-WEB-0663.JPG"
          alt="Hugo Herbots training"
          className="w-full h-full object-cover opacity-90"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={prefersReduced ? { scale: 1 } : { scale: 0.8, opacity: 0 }}
            animate={animate ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.3, ease }}
            className="w-16 h-16 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-xl cursor-pointer hover:scale-105 transition-transform"
          >
            <svg className="w-7 h-7 text-[#1C2535] ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </motion.div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-3">
          <div className="h-1 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-white/80"
              initial={{ width: "0%" }}
              animate={animate ? { width: "35%" } : {}}
              transition={{ duration: 2, delay: 0.6, ease: "linear" }}
            />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent pt-12 pb-8 px-5" />
        <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between">
          <div>
            <p className="text-white text-[15px] font-semibold">Techniek 9: Bezwaarherkenning</p>
            <p className="text-white/60 text-[12px] mt-0.5">Fase 2 · Ontdekkingsfase</p>
          </div>
          <span className="text-white/70 text-[13px] font-mono">4:12 / 12:34</span>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] font-semibold text-[#6B7A92] uppercase tracking-wider">Voortgang</p>
          <p className="text-[13px] text-[#6B7A92]">9 van 25 technieken</p>
        </div>
        <div className="space-y-2.5">
          {phases.map((phase, i) => (
            <motion.div
              key={phase.num}
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0, x: -12 }}
              animate={animate ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.1, ease }}
              className="flex items-center gap-3"
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  phase.complete
                    ? "bg-[#00C389] text-white"
                    : phase.active
                    ? "bg-[#2B3748] text-white"
                    : "bg-[#F3F4F6] text-[#9CA3AF]"
                }`}
              >
                {phase.complete ? "✓" : phase.num}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[13px] ${phase.active ? "font-semibold text-[#1C2535]" : phase.complete ? "text-[#00C389] font-medium" : "text-[#9CA3AF]"}`}>
                    {phase.name}
                  </span>
                  <span className="text-[11px] text-[#9CA3AF]">{phase.done}/{phase.total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: phase.complete ? "#00C389" : phase.active ? "#2B3748" : "#E5E7EB" }}
                    initial={{ width: "0%" }}
                    animate={animate ? { width: `${(phase.done / phase.total) * 100}%` } : {}}
                    transition={{ duration: 0.8, delay: 0.4 + i * 0.15, ease }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
