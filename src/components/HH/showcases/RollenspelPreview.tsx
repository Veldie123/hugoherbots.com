import { useState, useEffect } from "react";
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

export function RollenspelPreview() {
  const prefersReduced = useReducedMotion();
  const [visibleMessages, setVisibleMessages] = useState(prefersReduced ? messages.length : 0);
  const [showTyping, setShowTyping] = useState(false);
  const [showFeedback, setShowFeedback] = useState(!!prefersReduced);

  useEffect(() => {
    if (prefersReduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setVisibleMessages(1), 300));
    timers.push(setTimeout(() => setVisibleMessages(2), 1200));
    timers.push(setTimeout(() => setShowTyping(true), 2000));
    timers.push(setTimeout(() => { setShowTyping(false); setVisibleMessages(3); }, 2800));
    timers.push(setTimeout(() => setShowFeedback(true), 3400));
    return () => timers.forEach(clearTimeout);
  }, [prefersReduced]);

  return (
    <div className="rounded-2xl overflow-hidden border border-[#E4E4E4] shadow-[0_8px_30px_rgba(0,0,0,0.08)] bg-white">
      <div className="px-5 py-3 border-b border-[#F3F4F6] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00C389]" />
          <span className="text-[13px] font-semibold text-[#1C2535]">Rollenspel actief</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[#6B7A92] bg-[#F3F4F6] px-2.5 py-1 rounded-full">Fase 2 · Ontdekking</span>
        </div>
      </div>

      <div className="px-5 py-5 space-y-4 min-h-[220px]">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={i < visibleMessages ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, ease }}
            className={`flex gap-3 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}
          >
            <div className={`w-8 h-8 rounded-full flex-shrink-0 overflow-hidden ${msg.sender === "user" ? "bg-[#2B3748]" : ""}`}>
              {msg.sender === "hugo" ? (
                <img src="/images/Hugo-Herbots-WEB-0350.JPG" alt="Hugo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white">JIJ</div>
              )}
            </div>
            <div className={`max-w-[78%] ${msg.sender === "user" ? "text-right" : ""}`}>
              <p className={`text-[11px] font-semibold mb-1 ${msg.sender === "hugo" ? "text-[#6B7A92]" : "text-[#2B3748]"}`}>
                {msg.name}
                {msg.sender === "hugo" && <span className="ml-1 text-[9px] align-super text-[#6B7A92]/60">AI</span>}
              </p>
              <div className={`inline-block rounded-2xl px-4 py-2.5 text-[13px] leading-[20px] ${
                msg.sender === "user"
                  ? "bg-[#2B3748] text-white rounded-tr-md"
                  : "bg-[#F3F4F6] text-[#1C2535] rounded-tl-md"
              }`}>
                {msg.text}
              </div>
            </div>
          </motion.div>
        ))}

        {showTyping && !prefersReduced && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
              <img src="/images/Hugo-Herbots-WEB-0350.JPG" alt="Hugo" className="w-full h-full object-cover" />
            </div>
            <div className="bg-[#F3F4F6] rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#9CA3AF] animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-[#9CA3AF] animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-[#9CA3AF] animate-bounce [animation-delay:300ms]" />
            </div>
          </motion.div>
        )}
      </div>

      <motion.div
        initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={showFeedback ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease }}
        className="border-t border-[#E4E4E4] bg-[#00C389]/5 px-5 py-3.5 flex items-center gap-3"
      >
        <div className="w-8 h-8 rounded-full bg-[#00C389]/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#00C389]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1C2535]">Open vragen stellen</p>
          <p className="text-[12px] text-[#00C389]">Techniek correct toegepast</p>
        </div>
        <span className="text-[18px] font-bold text-[#00C389]">8/10</span>
      </motion.div>
    </div>
  );
}
