import { useRef, useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.25, 0.4, 0.25, 1];

const metrics = [
  { label: "Opening", score: 92, color: "#00C389" },
  { label: "Diagnose", score: 67, color: "#FFB020" },
  { label: "Closing", score: 78, color: "#6B7A92" },
];

export function GespreksanalysePreview({ simplified = false }: { simplified?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const [scoreValue, setScoreValue] = useState(prefersReduced ? 84 : 0);
  const [showSuggestion, setShowSuggestion] = useState(!!prefersReduced);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!animate || prefersReduced) return;

    const targetScore = 84;
    const duration = 1200;
    const startTime = Date.now();

    const run = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setScoreValue(Math.round(eased * targetScore));
      if (progress < 1) requestAnimationFrame(run);
    };

    requestAnimationFrame(run);
    const sugTimer = setTimeout(() => setShowSuggestion(true), 1600);
    return () => clearTimeout(sugTimer);
  }, [animate, prefersReduced]);

  const show = animate || !!prefersReduced;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (scoreValue / 100) * circumference;

  return (
    <motion.div
      ref={ref}
      initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.7, ease }}
      className="rounded-2xl overflow-hidden border border-[#E4E4E4] shadow-lg bg-white"
    >
      <div className="p-4 space-y-3">
        <div className={`flex ${simplified ? "flex-col items-center gap-3" : "gap-5 items-start"}`}>
          <div className="flex-shrink-0 relative flex items-center justify-center w-[100px] h-[100px]">
            <svg width="100" height="100" viewBox="0 0 100 100" className="absolute inset-0 transform -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#E5E7EB" strokeWidth="6" />
              <motion.circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={scoreValue >= 80 ? "#00C389" : scoreValue >= 60 ? "#FFB020" : "#EF4444"}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className="flex flex-col items-center z-10">
              <span className="text-[28px] font-bold text-[#1C2535] leading-none">{scoreValue}</span>
              <span className="text-[11px] text-[#9CA3AF]">/ 100</span>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 pt-1">
            {metrics.map((metric, i) => (
              <motion.div
                key={i}
                initial={prefersReduced ? { opacity: 1, x: 0 } : { opacity: 0, x: 12 }}
                animate={show ? { opacity: 1, x: 0 } : {}}
                transition={prefersReduced ? { duration: 0 } : { delay: 0.3 + i * 0.15, duration: 0.5, ease }}
                className="space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#2B3748] font-medium">{metric.label}</span>
                  <span className="text-[12px] font-bold" style={{ color: metric.color }}>{metric.score}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: metric.color }}
                    initial={{ width: prefersReduced ? `${metric.score}%` : 0 }}
                    animate={show ? { width: `${metric.score}%` } : {}}
                    transition={prefersReduced ? { duration: 0 } : { duration: 0.8, delay: 0.5 + i * 0.2, ease }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          animate={show ? { opacity: 1, y: 0 } : {}}
          transition={prefersReduced ? { duration: 0 } : { delay: 0.8, duration: 0.5, ease }}
          className="bg-[#F9FAFB] rounded-lg p-2.5 border border-[#E4E4E4]"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-full bg-[#6B7A92] flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <span className="text-[10px] text-[#6B7A92] font-medium">Transcript fragment</span>
            <span className="text-[8px] bg-[#6B7A92]/10 text-[#6B7A92] px-1.5 py-0.5 rounded-full ml-auto">14:32</span>
          </div>
          <p className="text-[11px] text-[#2B3748] leading-[16px]">
            <span className="text-[#9CA3AF]">Klant:</span> "Ik twijfel nog, stuur maar een offerte."
          </p>
          <p className="text-[11px] text-[#2B3748] leading-[16px]">
            <span className="text-[#9CA3AF]">Jij:</span> "Prima, ik stuur het door."
            <span className="ml-1 text-[8px] bg-[#FFB020]/15 text-[#FFB020] px-1.5 py-0.5 rounded-full font-medium">Gemiste kans</span>
          </p>
        </motion.div>

        <motion.div
          initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          animate={showSuggestion ? { opacity: 1, y: 0 } : {}}
          transition={prefersReduced ? { duration: 0 } : { duration: 0.6, ease }}
          className="rounded-lg overflow-hidden border border-[#00C389]/20"
        >
          <div className="bg-[#00C389]/5 px-3 py-1.5 border-b border-[#00C389]/10 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-[#00C389]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            <span className="text-[10px] font-semibold text-[#00C389]">Hugo's suggestie</span>
          </div>
          <div className="px-3 py-2 bg-white space-y-1.5">
            <p className="text-[11px] text-[#EF4444] line-through leading-[16px]">
              "Prima, ik stuur het door."
            </p>
            <p className="text-[11px] text-[#00C389] font-medium leading-[16px]">
              "Wat als we samen kijken welk pakket het beste bij uw situatie past?"
            </p>
            <p className="text-[9px] text-[#9CA3AF] italic">Techniek: Doorpakken naar afspraak</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
