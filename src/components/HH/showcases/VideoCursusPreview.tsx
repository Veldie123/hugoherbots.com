import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.25, 0.4, 0.25, 1] as const;

const phases = [
  { num: 1, name: "Opening", active: false, done: true },
  { num: 2, name: "Ontdekking", active: true, done: false },
  { num: 3, name: "Aanbeveling", active: false, done: false },
  { num: 4, name: "Beslissing", active: false, done: false },
];

const videoCards = [
  { title: "Bezwaarherkenning", code: "2.1", duration: "12:34", progress: 100, phase: 2 },
  { title: "Open vragen stellen", code: "2.2", duration: "8:47", progress: 35, phase: 2 },
  { title: "Behoeftenanalyse", code: "2.3", duration: "10:22", progress: 0, phase: 2 },
  { title: "Samenvatten", code: "2.4", duration: "6:15", progress: 0, phase: 2 },
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
    <div className="bg-hh-bg">
      {/* Phase tabs */}
      <div className="px-4 py-3 border-b border-hh-border flex items-center gap-1 overflow-x-auto">
        {phases.map((phase, i) => (
          <motion.button
            key={phase.num}
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: -4 }}
            animate={animate ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.3, delay: i * 0.06, ease }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
              phase.active
                ? "bg-hh-ink text-white"
                : phase.done
                ? "bg-hh-success/10 text-hh-success"
                : "text-hh-muted hover:text-hh-text"
            }`}
          >
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
              phase.done
                ? "bg-hh-success text-white"
                : phase.active
                ? "bg-white/20 text-white"
                : "bg-hh-ui-200 text-hh-muted"
            }`}>
              {phase.done ? "✓" : phase.num}
            </span>
            {phase.name}
          </motion.button>
        ))}
      </div>

      {/* Progress banner */}
      <motion.div
        initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
        animate={animate ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: 0.15, ease }}
        className="px-4 py-3 border-b border-hh-border bg-hh-ui-50"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-hh-text">Verder kijken</span>
            <span className="text-[11px] text-hh-muted">·</span>
            <span className="text-[11px] text-hh-muted">9 van 25 technieken</span>
          </div>
          <span className="text-[11px] font-semibold text-hh-success">36%</span>
        </div>
        <div className="h-1.5 rounded-full bg-hh-ui-200 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-hh-success"
            initial={{ width: "0%" }}
            animate={animate ? { width: "36%" } : {}}
            transition={{ duration: 1, delay: 0.3, ease }}
          />
        </div>
      </motion.div>

      {/* Video card grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {videoCards.map((card, i) => (
          <motion.div
            key={i}
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.97 }}
            animate={animate ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.1, ease }}
            className="rounded-xl overflow-hidden border border-hh-border bg-hh-bg group cursor-pointer"
          >
            {/* Thumbnail */}
            <div className="aspect-[16/10] relative overflow-hidden bg-hh-ink">
              <img
                src="/images/Hugo-Herbots-WEB-0663.JPG"
                alt={card.title}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-90 transition-opacity"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-hh-ink/60 to-transparent" />

              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">
                  <svg className="w-3.5 h-3.5 text-hh-ink ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </div>
              </div>

              {/* Duration */}
              <span className="absolute bottom-1.5 right-1.5 text-[10px] font-mono text-white bg-hh-ink/70 px-2 py-0.5 rounded">
                {card.duration}
              </span>

              {/* Progress bar on thumbnail */}
              {card.progress > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
                  <div className="h-full bg-hh-success" style={{ width: `${card.progress}%` }} />
                </div>
              )}
            </div>

            {/* Card info */}
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-semibold text-hh-muted">{card.code}</span>
                {card.progress === 100 && (
                  <span className="text-[9px] bg-hh-success/10 text-hh-success px-3 py-1 rounded-full font-medium">Voltooid</span>
                )}
                {card.progress > 0 && card.progress < 100 && (
                  <span className="text-[9px] bg-hh-primary/10 text-hh-primary px-3 py-1 rounded-full font-medium">Bezig</span>
                )}
                {card.progress === 0 && (
                  <span className="text-[9px] text-hh-muted">Nieuw</span>
                )}
              </div>
              <p className="text-[13px] font-semibold text-hh-text leading-[18px] line-clamp-1">{card.title}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
