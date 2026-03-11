import { useRef, useState, useEffect } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Radio, Video, MessageSquare, BarChart3, ArrowRight } from "lucide-react";
import { LiveTrainingPreview } from "./showcases/LiveTrainingPreview";
import { VideoCursusPreview } from "./showcases/VideoCursusPreview";
import { RollenspelPreview } from "./showcases/RollenspelPreview";
import { GespreksanalysePreview } from "./showcases/GespreksanalysePreview";

const ease = [0.25, 0.4, 0.25, 1] as const;

interface Module {
  id: string;
  icon: typeof Radio;
  tab: string;
  title: string;
  description: string;
  features: string[];
  dark: boolean;
  preview: () => React.ReactNode;
}

const modules: Module[] = [
  {
    id: "live",
    icon: Radio,
    tab: "Live Training",
    title: "Dagelijkse live training",
    description: "Elke werkdag live met Hugo. 45-60 minuten training + Q&A. Terugkijken kan altijd.",
    features: [
      "Ma-vr om 14:00, live met Hugo",
      "Chapters: spring naar wat jij nodig hebt",
      "Terugkijken binnen 2 uur beschikbaar",
    ],
    dark: true,
    preview: () => <LiveTrainingPreview />,
  },
  {
    id: "video",
    icon: Video,
    tab: "Video Cursus",
    title: "25 technieken in 4 fasen",
    description: "Korte, gefocuste video's met concrete voorbeelden. Van voorbereiding tot afsluiting — stap voor stap.",
    features: [
      "25 technieken verdeeld over 4 fasen",
      "Concrete voorbeelden en oefeningen",
      "Op je eigen tempo, track je voortgang",
    ],
    dark: false,
    preview: () => <VideoCursusPreview />,
  },
  {
    id: "roleplay",
    icon: MessageSquare,
    tab: "Rollenspellen",
    title: "Oefen met Hugo's AI-avatar",
    description: "Train verkopen in jouw eigen context. Chat, bel of video-call. Direct feedback per techniek.",
    features: [
      "Scenario's in jouw eigen context",
      "Chat, bellen of video — kies je format",
      "Persoonlijke scores en verbeterpunten",
    ],
    dark: true,
    preview: () => <RollenspelPreview />,
  },
  {
    id: "analysis",
    icon: BarChart3,
    tab: "Gespreksanalyse",
    title: "Upload calls of live feedback",
    description: "Upload gesprekken voor analyse of laat Hugo live meeluisteren. Feedback op alle 25 technieken.",
    features: [
      "Upload opnames — feedback binnen het uur",
      "Live meeluisteren tijdens je calls",
      "Analyse per techniek met concrete tips",
    ],
    dark: false,
    preview: () => <GespreksanalysePreview />,
  },
];

function ModuleSection({ module, index, navigate }: { module: Module; index: number; navigate?: (page: string) => void }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const prefersReduced = useReducedMotion();

  const textColor = module.dark ? "text-white" : "text-hh-text";
  const mutedColor = module.dark ? "text-white/60" : "text-hh-muted";
  const checkColor = module.dark ? "text-hh-success" : "text-hh-success";
  const bgClass = module.dark ? "bg-hh-ink" : "bg-white";

  return (
    <div ref={ref} className={`${bgClass} py-20 sm:py-28 lg:py-32`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-16 items-center">
          {/* Text */}
          <motion.div
            className="space-y-6 order-2 lg:order-1"
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : undefined}
            transition={{ duration: 0.6, delay: 0.1, ease }}
          >
            <div className="space-y-4">
              <div className={`inline-flex items-center gap-2 ${mutedColor} text-[13px] font-medium tracking-wide uppercase`}>
                <module.icon className="w-4 h-4" />
                {module.tab}
              </div>
              <h3 className={`${textColor} text-[28px] leading-[36px] sm:text-[34px] sm:leading-[42px] font-medium`}>
                {module.title}
              </h3>
              <p className={`${mutedColor} text-[16px] leading-[26px] sm:text-[17px] sm:leading-[28px]`}>
                {module.description}
              </p>
            </div>

            <ul className="space-y-3 pt-2">
              {module.features.map((feature, idx) => (
                <motion.li
                  key={idx}
                  initial={prefersReduced ? { opacity: 1 } : { opacity: 0, x: -16 }}
                  animate={isInView ? { opacity: 1, x: 0 } : undefined}
                  transition={{ duration: 0.5, delay: 0.25 + idx * 0.1, ease }}
                  className={`flex gap-3 items-start ${textColor}`}
                >
                  <svg className={`w-5 h-5 ${checkColor} flex-shrink-0 mt-0.5`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-[15px] leading-[22px]">{feature}</span>
                </motion.li>
              ))}
            </ul>

            <motion.div
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.5, delay: 0.5, ease }}
              className="pt-4"
            >
              <button
                onClick={() => navigate?.("preview")}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-[15px] font-medium transition-all duration-200 ${
                  module.dark
                    ? "bg-white text-hh-ink hover:bg-white/90"
                    : "bg-hh-ink text-white hover:bg-hh-ink/90"
                }`}
              >
                Platform Tour
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>

          {/* Preview */}
          <motion.div
            className="lg:col-span-2 order-1 lg:order-2"
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.97 }}
            animate={isInView ? { opacity: 1, y: 0, scale: 1 } : undefined}
            transition={{ duration: 0.7, delay: 0.2, ease }}
          >
            <div className={`rounded-2xl overflow-hidden ${
              module.dark
                ? "shadow-[0_20px_60px_rgba(0,0,0,0.4)] ring-1 ring-white/10"
                : "shadow-[0_20px_60px_rgba(0,0,0,0.12)] ring-1 ring-hh-border"
            }`}>
              {module.preview()}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function TabBar({ activeIndex, onTabClick, isSticky }: {
  activeIndex: number;
  onTabClick: (idx: number) => void;
  isSticky: boolean;
}) {
  return (
    <div className={`transition-all duration-300 ${
      isSticky
        ? "bg-white/80 dark:bg-hh-ink/80 backdrop-blur-lg shadow-lg border-b border-hh-border/50"
        : "bg-transparent"
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center py-4">
          <div className="inline-flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
            {modules.map((mod, idx) => {
              const Icon = mod.icon;
              const isActive = idx === activeIndex;
              return (
                <button
                  key={mod.id}
                  onClick={() => onTabClick(idx)}
                  className={`relative flex items-center gap-2 px-4 sm:px-6 py-2.5 text-[13px] sm:text-[14px] rounded-full transition-all duration-300 whitespace-nowrap font-medium ${
                    isActive
                      ? "text-white"
                      : "text-hh-muted hover:text-hh-text"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="showcase-tab"
                      className="absolute inset-0 bg-hh-ink rounded-full"
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                  <Icon className="relative z-10 w-4 h-4" />
                  <span className="relative z-10 hidden sm:inline">{mod.tab}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductShowcase({ navigate }: { navigate?: (page: string) => void } = {}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [isSticky, setIsSticky] = useState(false);

  // Track which section is most visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx >= 0) setActiveTab(idx);
          }
        });
      },
      { threshold: 0.4 }
    );

    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  // Track sticky state
  useEffect(() => {
    const handleScroll = () => {
      if (!tabBarRef.current || !sectionRef.current) return;
      const sectionTop = sectionRef.current.getBoundingClientRect().top;
      const sectionBottom = sectionRef.current.getBoundingClientRect().bottom;
      setIsSticky(sectionTop <= 64 && sectionBottom > 200);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (idx: number) => {
    const el = sectionRefs.current[idx];
    if (el) {
      const offset = 120;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <div ref={sectionRef}>
      {/* Sticky Tab Bar */}
      <div ref={tabBarRef} className="sticky top-16 z-30">
        <TabBar
          activeIndex={activeTab}
          onTabClick={scrollToSection}
          isSticky={isSticky}
        />
      </div>

      {/* Module Sections */}
      {modules.map((mod, idx) => (
        <div
          key={mod.id}
          ref={(el) => { sectionRefs.current[idx] = el; }}
        >
          <ModuleSection module={mod} index={idx} navigate={navigate} />
        </div>
      ))}
    </div>
  );
}
