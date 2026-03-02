/**
 * RoleplayPreview — Static marketing component for LandingV2
 * Shows a simulated Hugo AI chat window + E.P.I.C. phase tracker sidebar.
 * No props, no real data — purely visual.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { MessageSquare } from "lucide-react";

const MESSAGES = [
  {
    from: "hugo",
    text: "Goedemiddag. Vertel me — hoe begin jij een verkoopgesprek normaal gesproken?",
    delay: 0.3,
  },
  {
    from: "user",
    text: "Ik start altijd met een korte pitch van ons product en de voordelen.",
    delay: 0.7,
  },
  {
    from: "hugo",
    text: "Interessant. Maar stel jezelf eens de vraag: wie staat er centraal in die opening — jij of de klant?",
    delay: 1.1,
  },
];

const PHASES = [
  { num: 1, label: "Openingsfase", active: true },
  { num: 2, label: "Ontdekkingsfase", active: false },
  { num: 3, label: "Aanbevelingsfase", active: false },
  { num: 4, label: "Beslissingsfase", active: false },
];

export function RoleplayPreview() {
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
        className="rounded-2xl overflow-hidden flex"
        style={{
          background: "rgba(248,250,252,0.98)",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
          minHeight: "320px",
        }}
      >
        {/* Sidebar — E.P.I.C. phase tracker */}
        <div
          className="w-40 flex-shrink-0 p-4 border-r"
          style={{ borderColor: "rgba(0,0,0,0.06)", background: "rgba(248,250,252,1)" }}
        >
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
            E.P.I.C.
          </p>
          <div className="space-y-2">
            {PHASES.map((phase) => (
              <div
                key={phase.num}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                  phase.active ? "bg-hh-primary/10" : ""
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                    phase.active
                      ? "bg-hh-primary text-white"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {phase.num}
                </div>
                <span
                  className={`text-[11px] leading-tight ${
                    phase.active ? "text-hh-primary font-semibold" : "text-slate-400"
                  }`}
                >
                  {phase.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div
            className="flex items-center gap-2 px-4 py-3 border-b"
            style={{ borderColor: "rgba(0,0,0,0.06)" }}
          >
            <div className="w-7 h-7 rounded-full bg-hh-primary flex items-center justify-center text-white text-[10px] font-bold">
              HH
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">Hugo Herbots</p>
              <p className="text-[10px] text-emerald-500 font-medium">● Online</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 space-y-3 overflow-hidden">
            {MESSAGES.map((msg, i) => (
              <motion.div
                key={i}
                className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 8 }}
                transition={{ delay: msg.delay, duration: 0.4 }}
              >
                {msg.from === "hugo" && (
                  <div className="w-6 h-6 rounded-full bg-hh-primary flex items-center justify-center text-white text-[9px] font-bold mr-2 flex-shrink-0 mt-0.5">
                    HH
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-[11px] leading-[1.5] ${
                    msg.from === "user"
                      ? "bg-hh-primary text-white rounded-br-sm"
                      : "bg-white text-slate-700 rounded-bl-sm shadow-sm border border-slate-100"
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}

            {/* Typing indicator */}
            <motion.div
              className="flex justify-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: isInView ? 1 : 0 }}
              transition={{ delay: 1.6, duration: 0.4 }}
            >
              <div className="w-6 h-6 rounded-full bg-hh-primary flex items-center justify-center text-white text-[9px] font-bold mr-2 flex-shrink-0">
                HH
              </div>
              <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-sm border border-slate-100 flex gap-1 items-center">
                {[0, 0.15, 0.3].map((d) => (
                  <motion.div
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-slate-400"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: d }}
                  />
                ))}
              </div>
            </motion.div>
          </div>

          {/* Input bar */}
          <div
            className="px-4 py-3 border-t"
            style={{ borderColor: "rgba(0,0,0,0.06)" }}
          >
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2 border text-xs text-slate-400"
              style={{ borderColor: "rgba(0,0,0,0.1)", background: "rgba(248,250,252,0.8)" }}
            >
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Typ je antwoord...</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
