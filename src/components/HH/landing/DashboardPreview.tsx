/**
 * DashboardPreview — Static marketing component for LandingV2
 * Mimics the Netflix-style dashboard hero card + KPI strip.
 * No props, no real data — purely visual.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Play, Flame, BookOpen, TrendingUp } from "lucide-react";

const hugoPhoto = "/images/Hugo-Herbots-WEB-0350.JPG";

export function DashboardPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 24 }}
      transition={{ duration: 0.6 }}
      className="space-y-3"
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
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <span className="text-xs text-white/40 ml-2">HugoHerbots.ai</span>
        </div>

        {/* Hero video card */}
        <div className="relative h-44 overflow-hidden">
          <img
            src={hugoPhoto}
            alt="Hugo Herbots"
            className="w-full h-full object-cover object-top"
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to right, rgba(10,18,30,0.85) 0%, rgba(10,18,30,0.4) 50%, transparent 70%)" }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(10,18,30,0.6) 0%, transparent 50%)" }}
          />

          {/* Badge + title */}
          <div className="absolute top-3 left-4">
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-hh-primary/90 text-white">
              Aanbevolen voor jou
            </span>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-white font-semibold text-sm leading-tight mb-2">
              Openingsfase — De perfecte instapvraag
            </p>
            <div className="flex gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ background: "#3d9a6e" }}>
                <Play className="w-3 h-3 fill-white" />
                Afspelen
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 border border-white/20">
                Talk to Hugo
              </button>
            </div>
          </div>
        </div>

        {/* Section row: Continue watching */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white/80">Verder kijken</span>
            <span className="text-xs text-white/30">Alles bekijken →</span>
          </div>
          <div className="flex gap-2 overflow-hidden">
            {[
              { title: "Ontdekkingsfase", progress: 60, color: "#4F7396" },
              { title: "LEAD Questioning", progress: 30, color: "#64748B" },
              { title: "Bezwaren", progress: 0, color: "#F59E0B" },
            ].map((item) => (
              <div
                key={item.title}
                className="flex-shrink-0 w-24 rounded-lg overflow-hidden"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <div
                  className="h-14 flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${item.color}40, rgba(15,24,38,0.8))` }}
                >
                  <Play className="w-4 h-4 text-white/70" />
                </div>
                <div className="px-1.5 py-1">
                  <p className="text-[10px] text-white/70 truncate">{item.title}</p>
                  {item.progress > 0 && (
                    <div className="mt-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <motion.div
        className="grid grid-cols-3 gap-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 8 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        {[
          { icon: Flame, label: "Login streak", value: "12 dagen", color: "#F59E0B" },
          { icon: BookOpen, label: "Videos", value: "34 bekeken", color: "#4F7396" },
          { icon: TrendingUp, label: "Score", value: "+18%", color: "#10B981" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className="rounded-xl p-2.5 flex flex-col gap-1"
            style={{
              background: "rgba(15,24,38,0.95)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color }} />
            <p className="text-[10px] text-white/40 leading-none">{label}</p>
            <p className="text-xs font-semibold text-white">{value}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
