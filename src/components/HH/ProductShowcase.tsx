import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Badge } from "../ui/badge";
import { LiveTrainingPreview } from "./showcases/LiveTrainingPreview";
import { VideoCursusPreview } from "./showcases/VideoCursusPreview";
import { RollenspelPreview } from "./showcases/RollenspelPreview";
import { GespreksanalysePreview } from "./showcases/GespreksanalysePreview";

const ease = [0.25, 0.4, 0.25, 1];

interface ShowcaseSlide {
  id: string;
  badge: string;
  title: string;
  description: string | React.ReactNode;
  features: { text: string; icon: React.ReactNode }[];
}

const FeatureIcon = ({ type, index }: { type: "live" | "video" | "roleplay" | "analysis"; index: number }) => {
  const iconMap: Record<string, React.ReactNode[]> = {
    live: [
      <svg key="0" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" /></svg>,
      <svg key="1" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      <svg key="2" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    ],
    video: [
      <svg key="0" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
      <svg key="1" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
      <svg key="2" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
    ],
    roleplay: [
      <svg key="0" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
      <svg key="1" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      <svg key="2" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    ],
    analysis: [
      <svg key="0" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
      <svg key="1" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
      <svg key="2" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    ],
  };
  return <>{iconMap[type]?.[index] || null}</>;
};

const previewComponents: Record<string, (simplified: boolean) => React.ReactNode> = {
  live: (s) => <LiveTrainingPreview simplified={s} />,
  video: (s) => <VideoCursusPreview simplified={s} />,
  roleplay: (s) => <RollenspelPreview simplified={s} />,
  analysis: (s) => <GespreksanalysePreview simplified={s} />,
};

export function ProductShowcase({ initialTab = 0 }: { initialTab?: number } = {}) {
  const [currentSlide, setCurrentSlide] = useState(initialTab);
  const prefersReduced = useReducedMotion();
  const slides: ShowcaseSlide[] = [
    {
      id: "live",
      badge: "Live training",
      title: "Dagelijkse live training",
      description:
        "Elke werkdag live met Hugo (ma-vr) — 45-60 min training + Q&A. Ik zeg je niet alleen wat je moet doen maar ook exact hoe je het moet doen.",
      features: [
        { text: "45-60 min per dag + Q&A met Hugo", icon: <FeatureIcon type="live" index={0} /> },
        { text: "Thema's: opening, diagnose, waarde, voorstel, bezwaren, prijs, closing", icon: <FeatureIcon type="live" index={1} /> },
        { text: "Opnames met chapters binnen 2 uur — terugkijken wanneer je wil", icon: <FeatureIcon type="live" index={2} /> },
      ],
    },
    {
      id: "video",
      badge: "Video-cursus",
      title: "25 technieken in 4 fasen",
      description:
        "Leer alle 25 salestechnieken van Hugo — van voorbereiding tot afsluiting. Korte, gefocuste video's met concrete voorbeelden en oefeningen.",
      features: [
        { text: "25 technieken verdeeld over 4 fasen", icon: <FeatureIcon type="video" index={0} /> },
        { text: "Van voorbereiding tot afsluiting — stap voor stap", icon: <FeatureIcon type="video" index={1} /> },
        { text: "Concrete voorbeelden en praktische toepassingen", icon: <FeatureIcon type="video" index={2} /> },
      ],
    },
    {
      id: "roleplay",
      badge: "Rollenspellen",
      title: "Rollenspellen: oefen met AI",
      description:
        "Train verkopen in jouw eigen context via chat, bellen of video-call met Hugo's AI-avatar. Direct feedback, persoonlijke scores en concrete verbeterpunten.",
      features: [
        { text: "Chat, bellen of video-call — kies hoe je wil oefenen", icon: <FeatureIcon type="roleplay" index={0} /> },
        { text: "Scenario's in jouw eigen context en situaties", icon: <FeatureIcon type="roleplay" index={1} /> },
        { text: "Direct feedback en persoonlijke scores per techniek", icon: <FeatureIcon type="roleplay" index={2} /> },
      ],
    },
    {
      id: "analysis",
      badge: "Gespreksanalyse",
      title: "Gespreksanalyse: upload calls of live feedback",
      description: (
        <>
          Upload je gesprekken en krijg binnen het uur feedback op alle 25 technieken. Of laat Hugo<sup className="text-[10px] text-[#6B7A92]">AI</sup> live meeluisteren en ontvang real-time coaching tijdens je call.
        </>
      ),
      features: [
        { text: "Upload opgenomen gesprekken — feedback binnen het uur", icon: <FeatureIcon type="analysis" index={0} /> },
        { text: "Live meeluisteren — real-time coaching tijdens je call", icon: <FeatureIcon type="analysis" index={1} /> },
        { text: "Gedetailleerde analyse per techniek met concrete verbeterpunten", icon: <FeatureIcon type="analysis" index={2} /> },
      ],
    },
  ];

  const slide = slides[currentSlide];

  return (
    <div className="space-y-8 sm:space-y-12">
      <div className="hidden lg:block">
        <div className="relative flex gap-1 justify-center mb-10">
          {slides.map((slideItem, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`relative px-5 py-2.5 text-[15px] rounded-full transition-colors duration-300 ${
                idx === currentSlide
                  ? "text-white font-medium"
                  : "text-[#6B7A92] hover:text-[#1C2535] hover:bg-[#F3F4F6]"
              }`}
            >
              {idx === currentSlide && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-[#2B3748] rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative z-10">{slideItem.badge}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
          transition={prefersReduced ? { duration: 0.15 } : { duration: 0.45, ease }}
          className="hidden lg:grid lg:grid-cols-2 gap-8 lg:gap-12 items-center"
        >
          <div className="space-y-6">
            <div className="space-y-4">
              <motion.h3
                initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0.1, ease }}
                className="text-[#1C2535] text-[24px] leading-[32px] font-semibold"
              >
                {slide.title}
              </motion.h3>
              <motion.p
                initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0.2, ease }}
                className="text-[#B1B2B5] text-[16px] leading-[26px]"
              >
                {slide.description}
              </motion.p>
            </div>

            <ul className="space-y-3">
              {slide.features.map((feature, idx) => (
                <motion.li
                  key={`${currentSlide}-${idx}`}
                  initial={prefersReduced ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0.3 + idx * 0.12, ease }}
                  className="flex gap-3 items-start group"
                >
                  <motion.div
                    initial={prefersReduced ? { scale: 1 } : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={prefersReduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 25, delay: 0.35 + idx * 0.12 }}
                    className="w-8 h-8 rounded-lg bg-[#6B7A92]/10 flex items-center justify-center flex-shrink-0 text-[#6B7A92] group-hover:bg-[#6B7A92]/20 transition-colors"
                  >
                    {feature.icon}
                  </motion.div>
                  <span className="text-[#2B3748] text-[15px] leading-[22px] pt-1">
                    {feature.text}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>

          <div>
            {previewComponents[slide.id]?.(false)}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="lg:hidden space-y-5">
        {slides.map((slideItem, idx) => (
          <motion.div
            key={idx}
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.6, delay: idx * 0.1, ease }}
            className="rounded-[16px] shadow-sm border border-[#E4E4E4] overflow-hidden bg-white"
          >
            <div className="p-4 space-y-3">
              <Badge className="bg-[#6B7A92]/10 text-[#6B7A92] border-[#6B7A92]/20 text-[13px]">
                {slideItem.badge}
              </Badge>
              <h3 className="text-[18px] leading-[24px] font-semibold text-[#1C2535]">
                {slideItem.title}
              </h3>
              <p className="text-[14px] leading-[22px] text-[#B1B2B5]">
                {slideItem.description}
              </p>
              <ul className="space-y-2">
                {slideItem.features.map((feature, featureIdx) => (
                  <li key={featureIdx} className="flex gap-2.5 items-start">
                    <div className="w-6 h-6 rounded-md bg-[#6B7A92]/10 flex items-center justify-center flex-shrink-0 text-[#6B7A92] mt-0.5">
                      {feature.icon}
                    </div>
                    <span className="text-[14px] leading-[20px] text-[#2B3748]">
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-4 pb-4">
              {previewComponents[slideItem.id]?.(true)}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
