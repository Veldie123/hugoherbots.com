import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.25, 0.4, 0.25, 1] as const;

const epicPhases = [
  { num: 1, name: "Openingsfase", done: true },
  { num: 2, name: "Ontdekkingsfase", active: true },
  { num: 3, name: "Aanbevelingsfase" },
  { num: 4, name: "Beslissingsfase" },
];

const messages = [
  {
    sender: "hugo",
    text: "Goedemiddag, ik bel u over uw huidige softwarepakket. Heeft u even tijd?",
  },
  {
    sender: "user",
    text: "Wat maakt jullie anders dan de concurrentie?",
  },
  {
    sender: "hugo",
    text: "Goede vraag! In plaats van dat ik u vertel waarom wij beter zijn, mag ik u eerst vragen wat voor u het belangrijkste is?",
  },
];

export function RollenspelPreview() {
  const prefersReduced = useReducedMotion();
  const [visibleMessages, setVisibleMessages] = useState(prefersReduced ? messages.length : 0);
  const [showTyping, setShowTyping] = useState(false);
  const [showFeedback, setShowFeedback] = useState(!!prefersReduced);
  const [animate, setAnimate] = useState(!!prefersReduced);

  useEffect(() => {
    if (prefersReduced) return;
    const t = setTimeout(() => setAnimate(true), 200);
    return () => clearTimeout(t);
  }, [prefersReduced]);

  useEffect(() => {
    if (prefersReduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setVisibleMessages(1), 400));
    timers.push(setTimeout(() => setVisibleMessages(2), 1300));
    timers.push(setTimeout(() => setShowTyping(true), 2100));
    timers.push(setTimeout(() => { setShowTyping(false); setVisibleMessages(3); }, 2900));
    timers.push(setTimeout(() => setShowFeedback(true), 3500));
    return () => timers.forEach(clearTimeout);
  }, [prefersReduced]);

  return (
    <div className="bg-hh-ink">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-hh-success" />
          <span className="text-[13px] font-semibold text-white">Rollenspel actief</span>
        </div>
        <span className="text-[11px] text-white/40 bg-white/[0.06] px-2.5 py-1 rounded-full">Fase 2 · Ontdekking</span>
      </div>

      {/* Main content: phase tracker + chat */}
      <div className="flex min-h-[240px]">
        {/* Phase tracker sidebar */}
        <div className="w-[150px] border-r border-white/10 bg-white/[0.02] hidden sm:block">
          <div className="px-3 py-3">
            <span className="text-white/35 text-[10px] font-semibold uppercase tracking-wider">E.P.I.C.</span>
          </div>
          <div className="space-y-0.5 px-2">
            {epicPhases.map((phase, i) => (
              <motion.div
                key={phase.num}
                initial={prefersReduced ? { opacity: 1 } : { opacity: 0, x: -8 }}
                animate={animate ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.08, ease }}
                className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${
                  phase.active ? "bg-white/[0.08]" : ""
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                  phase.done
                    ? "bg-hh-success text-white"
                    : phase.active
                    ? "bg-hh-primary text-white"
                    : "bg-white/10 text-white/25"
                }`}>
                  {phase.done ? "✓" : phase.num}
                </div>
                <span className={`text-[11px] leading-[14px] ${
                  phase.active ? "text-white font-medium" : phase.done ? "text-white/50" : "text-white/25"
                }`}>
                  {phase.name}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Score indicator */}
          <motion.div
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
            animate={animate ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.5, ease }}
            className="mx-3 mt-4 px-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/[0.06]"
          >
            <span className="text-[10px] text-white/35 uppercase tracking-wider font-medium">Score</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-[20px] font-bold text-white">7.8</span>
              <span className="text-[11px] text-white/30">/ 10</span>
            </div>
          </motion.div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 px-4 py-4 space-y-3.5">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={i < visibleMessages ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, ease }}
                className={`flex gap-2.5 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}
              >
                <div className={`w-8 h-8 rounded-full flex-shrink-0 overflow-hidden ${
                  msg.sender === "user" ? "bg-hh-primary flex items-center justify-center" : ""
                }`}>
                  {msg.sender === "hugo" ? (
                    <img src="/images/Hugo-Herbots-WEB-0350.JPG" alt="Hugo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[9px] font-bold text-white">JIJ</span>
                  )}
                </div>
                <div className={`max-w-[78%] ${msg.sender === "user" ? "text-right" : ""}`}>
                  <p className={`text-[10px] font-semibold mb-1 ${
                    msg.sender === "hugo" ? "text-white/50" : "text-hh-primary"
                  }`}>
                    {msg.sender === "hugo" ? "Hugo" : "Jij"}
                    {msg.sender === "hugo" && <span className="ml-1 text-[8px] text-white/30">AI</span>}
                  </p>
                  <div className={`inline-block rounded-2xl px-3.5 py-2.5 text-[13px] leading-[20px] ${
                    msg.sender === "user"
                      ? "bg-hh-primary text-white rounded-tr-md"
                      : "bg-white/[0.08] text-white/80 rounded-tl-md"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Typing indicator */}
            {showTyping && !prefersReduced && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                  <img src="/images/Hugo-Herbots-WEB-0350.JPG" alt="Hugo" className="w-full h-full object-cover" />
                </div>
                <div className="bg-white/[0.08] rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Feedback bar */}
      <motion.div
        initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
        animate={showFeedback ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease }}
        className="border-t border-hh-success/20 bg-hh-success/[0.08] px-4 py-3 flex items-center gap-3"
      >
        <div className="w-8 h-8 rounded-full bg-hh-success/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-hh-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-white">Open vragen stellen</p>
          <p className="text-[11px] text-hh-success">Techniek correct toegepast</p>
        </div>
        <span className="text-[16px] font-bold text-hh-success">8/10</span>
      </motion.div>
    </div>
  );
}
