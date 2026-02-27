import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.25, 0.4, 0.25, 1];

const metrics = [
  { label: "Opening", score: 92, color: "#00C389" },
  { label: "Diagnose", score: 67, color: "#FFB020" },
  { label: "Closing", score: 78, color: "#6B7A92" },
];

export function GespreksanalysePreview() {
  const prefersReduced = useReducedMotion();
  const [scoreValue, setScoreValue] = useState(prefersReduced ? 84 : 0);
  const [showSuggestion, setShowSuggestion] = useState(!!prefersReduced);
  const [animate, setAnimate] = useState(!!prefersReduced);

  useEffect(() => {
    if (prefersReduced) return;
    const t = setTimeout(() => setAnimate(true), 200);
    return () => clearTimeout(t);
  }, [prefersReduced]);

  useEffect(() => {
    if (!animate || prefersReduced) return;
    const target = 84;
    const duration = 1200;
    const start = Date.now();
    const run = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      setScoreValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
    const t = setTimeout(() => setShowSuggestion(true), 1600);
    return () => clearTimeout(t);
  }, [animate, prefersReduced]);

  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (scoreValue / 100) * circumference;

  return (
    <div className="rounded-2xl overflow-hidden border border-[#E4E4E4] shadow-[0_8px_30px_rgba(0,0,0,0.08)] bg-white">
      <div className="px-5 py-5">
        <div className="flex gap-6 items-center mb-5">
          <div className="flex-shrink-0 relative w-[110px] h-[110px]">
            <svg width="110" height="110" viewBox="0 0 110 110" className="absolute inset-0 transform -rotate-90">
              <circle cx="55" cy="55" r="42" fill="none" stroke="#F3F4F6" strokeWidth="7" />
              <motion.circle
                cx="55" cy="55" r="42"
                fill="none"
                stroke={scoreValue >= 80 ? "#00C389" : scoreValue >= 60 ? "#FFB020" : "#EF4444"}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[32px] font-bold text-[#1C2535] leading-none">{scoreValue}</span>
              <span className="text-[12px] text-[#9CA3AF] mt-0.5">/ 100</span>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {metrics.map((metric, i) => (
              <motion.div
                key={i}
                initial={prefersReduced ? { opacity: 1 } : { opacity: 0, x: 12 }}
                animate={animate ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.15, duration: 0.5, ease }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] text-[#2B3748] font-medium">{metric.label}</span>
                  <span className="text-[13px] font-bold" style={{ color: metric.color }}>{metric.score}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: metric.color }}
                    initial={{ width: "0%" }}
                    animate={animate ? { width: `${metric.score}%` } : {}}
                    transition={{ duration: 0.8, delay: 0.5 + i * 0.2, ease }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={animate ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8, duration: 0.5, ease }}
          className="bg-[#F9FAFB] rounded-xl p-4 border border-[#E4E4E4]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#6B7A92]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              <span className="text-[12px] text-[#6B7A92] font-semibold">Transcript fragment</span>
            </div>
            <span className="text-[11px] bg-[#6B7A92]/10 text-[#6B7A92] px-2 py-0.5 rounded-full font-medium">14:32</span>
          </div>
          <div className="space-y-1">
            <p className="text-[13px] text-[#2B3748] leading-[20px]">
              <span className="text-[#9CA3AF]">Klant:</span> "Ik twijfel nog, stuur maar een offerte."
            </p>
            <p className="text-[13px] text-[#2B3748] leading-[20px]">
              <span className="text-[#9CA3AF]">Jij:</span> "Prima, ik stuur het door."
              <span className="ml-2 text-[10px] bg-[#FFB020]/15 text-[#D97706] px-2 py-0.5 rounded-full font-medium">Gemiste kans</span>
            </p>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={showSuggestion ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease }}
        className="border-t border-[#00C389]/20 bg-[#00C389]/5 px-5 py-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-[#00C389]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          <span className="text-[13px] font-semibold text-[#00C389]">Hugo's suggestie</span>
        </div>
        <p className="text-[13px] text-[#EF4444] line-through leading-[20px] mb-1">
          "Prima, ik stuur het door."
        </p>
        <p className="text-[13px] text-[#00C389] font-medium leading-[20px]">
          "Wat als we samen kijken welk pakket het beste bij uw situatie past?"
        </p>
        <p className="text-[11px] text-[#6B7A92] mt-1.5 italic">Techniek: Doorpakken naar afspraak</p>
      </motion.div>
    </div>
  );
}
