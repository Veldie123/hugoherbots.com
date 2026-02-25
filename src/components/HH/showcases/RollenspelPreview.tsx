import { useRef, useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.25, 0.4, 0.25, 1];

const messages = [
  {
    sender: "hugo",
    name: "Hugo",
    text: "Goedemiddag, ik bel u over uw huidige softwarepakket. Heeft u even tijd?",
  },
  {
    sender: "user",
    name: "Jij",
    text: "Wat maakt jullie anders dan de concurrentie?",
  },
  {
    sender: "hugo",
    name: "Hugo",
    text: "Goede vraag! In plaats van dat ik u vertel waarom wij beter zijn, mag ik u eerst vragen wat voor u het belangrijkste is?",
  },
];

const sidebarPhases = [
  { name: "Opening", progress: 100, color: "#00C389" },
  { name: "Ontdekking", progress: 40, color: "#6B7A92", active: true },
  { name: "Aanbeveling", progress: 0, color: "#E5E7EB" },
];

export function RollenspelPreview({ simplified = false }: { simplified?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const [visibleMessages, setVisibleMessages] = useState(prefersReduced ? messages.length : 0);
  const [showTyping, setShowTyping] = useState(false);
  const [showFeedback, setShowFeedback] = useState(!!prefersReduced);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!animate || prefersReduced) return;
    setVisibleMessages(0);
    setShowTyping(false);
    setShowFeedback(false);

    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => setVisibleMessages(1), 200));
    timers.push(setTimeout(() => setVisibleMessages(2), 1100));
    timers.push(setTimeout(() => setShowTyping(true), 1800));
    timers.push(setTimeout(() => {
      setShowTyping(false);
      setVisibleMessages(3);
    }, 2600));
    timers.push(setTimeout(() => setShowFeedback(true), 3200));

    return () => timers.forEach(clearTimeout);
  }, [animate, prefersReduced]);

  const show = animate || !!prefersReduced;

  return (
    <motion.div
      ref={ref}
      initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.7, ease }}
      className="rounded-2xl overflow-hidden border border-[#E4E4E4] shadow-lg bg-white"
    >
      <div className="flex">
        {!simplified && (
          <div className="w-[52px] flex-shrink-0 border-r border-[#E4E4E4] bg-[#F9FAFB] py-3 px-1.5 space-y-3">
            <p className="text-[7px] font-bold text-[#6B7A92] uppercase tracking-widest text-center">E.P.I.C.</p>
            {sidebarPhases.map((phase, i) => (
              <motion.div
                key={i}
                initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
                animate={show ? { opacity: 1 } : {}}
                transition={prefersReduced ? { duration: 0 } : { delay: 0.2 + i * 0.15, ease }}
                className="text-center space-y-1"
              >
                <div
                  className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center text-[9px] font-bold ${phase.active ? "bg-[#6B7A92] text-white shadow-sm" : phase.progress === 100 ? "bg-[#00C389]/10 text-[#00C389]" : "bg-[#F3F4F6] text-[#9CA3AF]"}`}
                >
                  {phase.progress === 100 ? "✓" : i + 1}
                </div>
                <p className={`text-[7px] leading-tight ${phase.active ? "text-[#1C2535] font-semibold" : "text-[#9CA3AF]"}`}>
                  {phase.name}
                </p>
                <div className="h-0.5 rounded-full bg-[#E5E7EB] mx-1 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: phase.color }}
                    initial={{ width: prefersReduced ? `${phase.progress}%` : 0 }}
                    animate={show ? { width: `${phase.progress}%` } : {}}
                    transition={prefersReduced ? { duration: 0 } : { duration: 0.8, delay: 0.4 + i * 0.2, ease }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-[260px]">
          <div className="flex-1 px-3 py-3 space-y-3 overflow-hidden">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                animate={i < visibleMessages ? { opacity: 1, y: 0 } : prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={prefersReduced ? { duration: 0 } : { duration: 0.4, ease }}
                className={`flex gap-2 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}
              >
                <div className={`w-6 h-6 rounded-full flex-shrink-0 overflow-hidden ${msg.sender === "user" ? "bg-[#6B7A92]" : ""}`}>
                  {msg.sender === "hugo" ? (
                    <img src="/images/Hugo-Herbots-WEB-0350.JPG" alt="Hugo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white">JIJ</div>
                  )}
                </div>
                <div className={`max-w-[75%] ${msg.sender === "user" ? "text-right" : ""}`}>
                  <p className={`text-[9px] font-semibold mb-0.5 ${msg.sender === "hugo" ? "text-[#6B7A92]" : "text-[#2B3748]"}`}>
                    {msg.name}
                    {msg.sender === "hugo" && <span className="ml-1 text-[7px] align-super text-[#6B7A92]/60">AI</span>}
                  </p>
                  <div className={`inline-block rounded-xl px-2.5 py-1.5 text-[11px] leading-[16px] ${msg.sender === "user" ? "bg-[#6B7A92] text-white rounded-tr-sm" : "bg-[#F3F4F6] text-[#1C2535] rounded-tl-sm"}`}>
                    {msg.text}
                  </div>
                </div>
              </motion.div>
            ))}

            {showTyping && !prefersReduced && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-2"
              >
                <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                  <img src="/images/Hugo-Herbots-WEB-0350.JPG" alt="Hugo" className="w-full h-full object-cover" />
                </div>
                <div className="bg-[#F3F4F6] rounded-xl rounded-tl-sm px-3 py-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce [animation-delay:300ms]" />
                </div>
              </motion.div>
            )}
          </div>

          <motion.div
            initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            animate={showFeedback ? { opacity: 1, y: 0 } : {}}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.5, ease }}
            className="border-t border-[#E4E4E4] bg-[#00C389]/5 px-3 py-2 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-[#00C389] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-[#1C2535]">Open vragen stellen</p>
              <p className="text-[9px] text-[#00C389]">Techniek correct toegepast</p>
            </div>
            <span className="text-[13px] font-bold text-[#00C389]">8/10</span>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
