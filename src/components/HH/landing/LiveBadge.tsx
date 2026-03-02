/**
 * LiveBadge — Static marketing component for LandingV2
 * Shows a simulated live coaching session header bar + video placeholder.
 * No props, no real data — purely visual.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Users, PhoneOff, Maximize2 } from "lucide-react";

const hugoBlackBg = "/images/Hugo-Herbots-WEB-0461.JPG";

export function LiveBadge() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 24 }}
      transition={{ duration: 0.6 }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#0a0e18",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Session header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-3">
            {/* Pulsing LIVE badge */}
            <div className="flex items-center gap-1.5">
              <motion.div
                className="w-2 h-2 rounded-full bg-red-500"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
              <span className="text-xs font-bold text-red-400 tracking-wider">LIVE</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div>
              <p className="text-xs font-semibold text-white">Hugo Herbots</p>
              <p className="text-[10px] text-white/40">Live Coaching • Openingsfase</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-white/40">
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs">47</span>
            </div>
            {/* Session timer */}
            <span className="text-xs font-mono text-white/40">23:14</span>
          </div>
        </div>

        {/* Video area */}
        <div className="relative" style={{ aspectRatio: "16/9" }}>
          <img
            src={hugoBlackBg}
            alt="Hugo Herbots live coaching"
            className="w-full h-full object-cover object-top"
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(10,14,24,0.5) 100%)" }}
          />

          {/* Participant count pill */}
          <div className="absolute top-3 right-3">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-white/80"
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
            >
              <Users className="w-3 h-3" />
              <span>47 deelnemers</span>
            </div>
          </div>

          {/* Fullscreen icon */}
          <div className="absolute bottom-3 right-3 opacity-40">
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Controls bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 text-xs text-white/50 cursor-pointer hover:bg-white/10 transition-colors">
              Stel een vraag
            </div>
          </div>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/90 text-white text-xs font-medium"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            Verlaten
          </button>
        </div>
      </div>
    </motion.div>
  );
}
