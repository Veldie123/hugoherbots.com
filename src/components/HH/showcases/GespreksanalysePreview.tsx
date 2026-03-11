import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.25, 0.4, 0.25, 1] as const;

const phaseScores = [
  { name: "Openingsfase", score: 92, textClass: "text-hh-success", barClass: "bg-hh-success" },
  { name: "Ontdekkingsfase", score: 67, textClass: "text-hh-warning", barClass: "bg-hh-warning" },
  { name: "Aanbevelingsfase", score: 78, textClass: "text-hh-primary", barClass: "bg-hh-primary" },
  { name: "Beslissingsfase", score: 71, textClass: "text-hh-primary", barClass: "bg-hh-primary" },
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
    <div className="bg-hh-bg">
      {/* Header */}
      <div className="px-5 py-3 border-b border-hh-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-hh-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-[13px] font-semibold text-hh-text">Gespreksanalyse</span>
        </div>
        <span className="text-[11px] text-hh-muted">14 maart · 14:32</span>
      </div>

      {/* Score + phase bars */}
      <div className="px-5 py-5">
        <div className="flex gap-6 items-center">
          {/* Donut chart */}
          <div className="flex-shrink-0 relative w-[100px] h-[100px]">
            <svg width="100" height="100" viewBox="0 0 110 110" className="absolute inset-0 transform -rotate-90">
              <circle cx="55" cy="55" r="42" fill="none" className="stroke-hh-ui-200" strokeWidth="7" />
              <motion.circle
                cx="55" cy="55" r="42"
                fill="none"
                className={scoreValue >= 80 ? "stroke-hh-success" : scoreValue >= 60 ? "stroke-hh-warning" : "stroke-hh-error"}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[28px] font-bold text-hh-text leading-none">{scoreValue}</span>
              <span className="text-[11px] text-hh-muted mt-0.5">/ 100</span>
            </div>
          </div>

          {/* Phase progress bars */}
          <div className="flex-1 space-y-2.5">
            {phaseScores.map((phase, i) => (
              <motion.div
                key={i}
                initial={prefersReduced ? { opacity: 1 } : { opacity: 0, x: 12 }}
                animate={animate ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.12, duration: 0.5, ease }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-hh-text font-medium">{phase.name}</span>
                  <span className={`text-[12px] font-bold ${phase.textClass}`}>{phase.score}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-hh-ui-200 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${phase.barClass}`}
                    initial={{ width: "0%" }}
                    animate={animate ? { width: `${phase.score}%` } : {}}
                    transition={{ duration: 0.8, delay: 0.5 + i * 0.15, ease }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Transcript snippet */}
      <motion.div
        initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
        animate={animate ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.8, duration: 0.5, ease }}
        className="mx-5 mb-4 rounded-xl p-4 bg-hh-ui-50 border border-hh-border"
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-hh-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-[11px] text-hh-muted font-semibold">Transcript</span>
          </div>
          <span className="text-[10px] bg-hh-ui-200 text-hh-muted px-2 py-0.5 rounded-full font-medium">14:32</span>
        </div>
        <div className="space-y-1.5">
          <p className="text-[13px] text-hh-text leading-[20px]">
            <span className="text-hh-muted font-medium">Klant:</span> "Ik twijfel nog, stuur maar een offerte."
          </p>
          <p className="text-[13px] text-hh-text leading-[20px]">
            <span className="text-hh-muted font-medium">Jij:</span> "Prima, ik stuur het door."
            <span className="ml-2 text-[10px] bg-hh-warning/15 text-hh-warning px-3 py-1 rounded-full font-medium">Gemiste kans</span>
          </p>
        </div>
      </motion.div>

      {/* Hugo's suggestion */}
      <motion.div
        initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 10 }}
        animate={showSuggestion ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease }}
        className="border-t border-hh-success/20 bg-hh-success/[0.05] px-5 py-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-hh-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-[13px] font-semibold text-hh-success">Hugo's suggestie</span>
        </div>
        <p className="text-[13px] text-hh-error line-through leading-[20px] mb-1">
          "Prima, ik stuur het door."
        </p>
        <p className="text-[13px] text-hh-success font-medium leading-[20px]">
          "Wat als we samen kijken welk pakket het beste bij uw situatie past?"
        </p>
        <p className="text-[11px] text-hh-muted mt-2 italic">Techniek: Doorpakken naar afspraak</p>
      </motion.div>
    </div>
  );
}
