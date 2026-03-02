/**
 * AnalysisPreview — Static marketing component for LandingV2
 * Shows an animated donut score chart + 4 E.P.I.C. phase bars.
 * No props, no real data — purely visual.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { FileText, CheckCircle2 } from "lucide-react";

const PHASES = [
  { label: "Openingsfase",      score: 82, color: "#4F7396" },
  { label: "Ontdekkingsfase",   score: 71, color: "#64748B" },
  { label: "Aanbevelingsfase",  score: 65, color: "#F59E0B" },
  { label: "Beslissingsfase",   score: 90, color: "#10B981" },
];

const OVERALL_SCORE = 78;
const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function DonutScore({ score, animate }: { score: number; animate: boolean }) {
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
  const color = score >= 70 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444";

  return (
    <div className="flex flex-col items-center mb-6">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
          {/* Track */}
          <circle
            cx="64" cy="64" r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="12"
          />
          {/* Progress */}
          <motion.circle
            cx="64" cy="64" r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: animate ? offset : CIRCUMFERENCE }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-3xl font-bold text-white leading-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: animate ? 1 : 0 }}
            transition={{ delay: 0.6 }}
          >
            {score}
          </motion.span>
          <span className="text-xs text-white/50 mt-0.5">/100</span>
        </div>
      </div>
      <p className="text-sm text-white/60 mt-2">Totaalscore</p>
    </div>
  );
}

function PhaseBar({ label, score, color, animate, delay }: {
  label: string; score: number; color: string; animate: boolean; delay: number;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-white/70">{label}</span>
        <span className="text-xs font-semibold text-white">{score}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: animate ? `${score}%` : 0 }}
          transition={{ duration: 0.9, ease: "easeOut", delay }}
        />
      </div>
    </div>
  );
}

export function AnalysisPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24, rotate: 1 }}
      animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 24, rotate: isInView ? 1 : 1 }}
      transition={{ duration: 0.6 }}
      className="relative"
      style={{ rotate: "1deg" }}
    >
      {/* App window chrome */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(15,24,38,0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        {/* Window header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <div className="flex items-center gap-2 ml-2">
            <FileText className="w-3.5 h-3.5 text-white/40" />
            <span className="text-xs text-white/40">Gespreksanalyse</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Status row */}
          <div className="flex items-center gap-2 mb-5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">Analyse gereed</span>
            </div>
            <span className="text-xs text-white/30">•</span>
            <span className="text-xs text-white/40">verkoopgesprek.mp4</span>
          </div>

          {/* Donut */}
          <DonutScore score={OVERALL_SCORE} animate={isInView} />

          {/* Phase bars */}
          <div className="space-y-0">
            {PHASES.map((phase, i) => (
              <PhaseBar
                key={phase.label}
                label={phase.label}
                score={phase.score}
                color={phase.color}
                animate={isInView}
                delay={0.5 + i * 0.12}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Floating accent card */}
      <motion.div
        className="absolute -bottom-4 -right-4 bg-emerald-500 text-white rounded-xl px-3 py-2 text-xs font-semibold shadow-lg"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: isInView ? 1 : 0, scale: isInView ? 1 : 0.8 }}
        transition={{ delay: 1.2, duration: 0.4 }}
      >
        +23% conversie
      </motion.div>
    </motion.div>
  );
}
