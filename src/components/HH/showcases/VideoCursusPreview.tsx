import { useRef, useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.25, 0.4, 0.25, 1];

const phases = [
  { num: 1, name: "Openingsfase", techniques: 6, completed: 6, color: "#00C389" },
  { num: 2, name: "Ontdekkingsfase", techniques: 8, completed: 3, color: "#6B7A92", active: true },
  { num: 3, name: "Aanbevelingsfase", techniques: 6, completed: 0, color: "#FFB020" },
  { num: 4, name: "Beslissingsfase", techniques: 5, completed: 0, color: "#9CA3AF" },
];

const activeTechniques = [
  { id: 7, name: "Open vragen stellen", done: true },
  { id: 8, name: "Actief luisteren", done: true },
  { id: 9, name: "Bezwaarherkenning", done: false, active: true },
  { id: 10, name: "Doorvragen", done: false },
];

export function VideoCursusPreview({ simplified = false }: { simplified?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(t);
  }, []);

  const show = animate || !!prefersReduced;

  const m = (delay: number, props?: object) =>
    prefersReduced
      ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
      : { initial: { opacity: 0, ...props }, animate: show ? { opacity: 1, x: 0, y: 0, scale: 1 } : {}, transition: { duration: 0.5, delay, ease } };

  return (
    <motion.div
      ref={ref}
      initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.7, ease }}
      className="rounded-2xl overflow-hidden border border-[#E4E4E4] shadow-lg bg-white"
    >
      <div className={`flex ${simplified ? "flex-col" : ""}`}>
        {!simplified && (
          <div className="w-[180px] flex-shrink-0 border-r border-[#E4E4E4] bg-[#F9FAFB] py-3 px-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold text-[#6B7A92] uppercase tracking-wider px-1 mb-2">Cursus</p>
            {phases.map((phase, i) => (
              <motion.div key={phase.num} {...m(0.2 + i * 0.12, { x: -12 })}>
                <div className={`rounded-lg px-2 py-1.5 ${phase.active ? "bg-white border border-[#E4E4E4] shadow-sm" : ""}`}>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: phase.color }}
                    >
                      {phase.completed === phase.techniques ? "✓" : phase.num}
                    </div>
                    <span className={`text-[11px] leading-tight ${phase.active ? "font-semibold text-[#1C2535]" : "text-[#6B7A92]"}`}>
                      {phase.name}
                    </span>
                  </div>
                  <div className="ml-5.5 mt-1">
                    <div className="h-1 rounded-full bg-[#E5E7EB] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: phase.color }}
                        initial={{ width: prefersReduced ? `${(phase.completed / phase.techniques) * 100}%` : 0 }}
                        animate={show ? { width: `${(phase.completed / phase.techniques) * 100}%` } : {}}
                        transition={prefersReduced ? { duration: 0 } : { duration: 0.8, delay: 0.4 + i * 0.15, ease }}
                      />
                    </div>
                    <p className="text-[9px] text-[#9CA3AF] mt-0.5">{phase.completed}/{phase.techniques}</p>
                  </div>
                </div>

                {phase.active && (
                  <div className="ml-3 mt-1 space-y-0.5">
                    {activeTechniques.map((tech, ti) => (
                      <motion.div
                        key={tech.id}
                        {...m(0.6 + ti * 0.1, { x: -6 })}
                        className={`flex items-center gap-1.5 py-0.5 px-1.5 rounded text-[10px] ${tech.active ? "bg-[#6B7A92]/10 text-[#6B7A92] font-medium" : tech.done ? "text-[#00C389]" : "text-[#9CA3AF]"}`}
                      >
                        {tech.done ? (
                          <svg className="w-3 h-3 text-[#00C389]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : tech.active ? (
                          <span className="w-3 h-3 rounded-full border-2 border-[#6B7A92] flex-shrink-0 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6B7A92]" />
                          </span>
                        ) : (
                          <span className="w-3 h-3 rounded-full border border-[#D1D5DB] flex-shrink-0" />
                        )}
                        {tech.name}
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        <div className="flex-1 flex flex-col">
          <div className="relative aspect-video bg-[#1C2535]">
            <img
              src="/images/Hugo-Herbots-WEB-0663.JPG"
              alt="Hugo Herbots training"
              className="w-full h-full object-cover opacity-90"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={prefersReduced ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
                animate={show ? { scale: 1, opacity: 1 } : {}}
                transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0.3, ease }}
                className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 transition-transform"
              >
                <svg className="w-6 h-6 text-[#1C2535] ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </motion.div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 px-3 pb-2">
              <motion.div
                className="h-1 rounded-full bg-white/20 overflow-hidden"
                initial={{ opacity: prefersReduced ? 1 : 0 }}
                animate={show ? { opacity: 1 } : {}}
                transition={{ delay: 0.5 }}
              >
                <motion.div
                  className="h-full rounded-full bg-[#6B7A92]"
                  initial={{ width: prefersReduced ? "35%" : "0%" }}
                  animate={show ? { width: "35%" } : {}}
                  transition={prefersReduced ? { duration: 0 } : { duration: 2.5, delay: 0.8, ease: "linear" }}
                />
              </motion.div>
            </div>
          </div>

          <div className="px-3 py-2.5 border-t border-[#E4E4E4] bg-[#F9FAFB] flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-[#1C2535]">Techniek 9: Bezwaarherkenning</p>
              <p className="text-[10px] text-[#9CA3AF]">Fase 2 · Ontdekkingsfase</p>
            </div>
            <span className="text-[11px] text-[#6B7A92] font-mono">4:12 / 12:34</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
