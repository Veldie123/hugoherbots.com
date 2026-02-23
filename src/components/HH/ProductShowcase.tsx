/**
 * PRODUCT SHOWCASE COMPONENT - Carousel Version
 * Real app screenshots imported from Figma assets
 * Side-by-side layout: Features left, Screenshot right
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { CheckCircle2 } from "lucide-react";

const liveTrainingPhoto = "/images/live_coaching_1767362924020.png";
const videoCursusScreenshot = "/images/video-cursus_1767362924021.png";
const roleplayScreenshot = "/images/video-cursus_1767362924021.png";
const gespreksAnalyseScreenshot = "/images/live_coaching_1767362924020.png";

interface ShowcaseSlide {
  id: string;
  badge: string;
  title: string;
  description: string | React.ReactNode;
  features: string[];
  imageSrc: string;
  mobileImageSrc?: string;
  imageAlt: string;
}

export function ProductShowcase() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: ShowcaseSlide[] = [
    {
      id: "live",
      badge: "Live training",
      title: "Dagelijkse live training",
      description:
        "Elke werkdag live met Hugo (ma-vr) — 45-60 min training + Q&A. Ik zeg je niet alleen wat je moet doen maar ook exact hoe je het moet doen.",
      features: [
        "45-60 min per dag + Q&A met Hugo",
        "Thema's: opening, diagnose, waarde, voorstel, bezwaren, prijs, closing",
        "Opnames met chapters binnen 2 uur — terugkijken wanneer je wil",
      ],
      imageSrc: liveTrainingPhoto,
      imageAlt: "HugoHerbots.ai - Dagelijkse live training met Hugo",
    },
    {
      id: "video",
      badge: "Video-cursus",
      title: "25 technieken in 4 fasen",
      description:
        "Leer alle 25 salestechnieken van Hugo — van voorbereiding tot afsluiting. Korte, gefocuste video's met concrete voorbeelden en oefeningen.",
      features: [
        "25 technieken verdeeld over 4 fasen",
        "Van voorbereiding tot afsluiting — stap voor stap",
        "Concrete voorbeelden en praktische toepassingen",
      ],
      imageSrc: videoCursusScreenshot,
      imageAlt: "HugoHerbots.ai Video Cursus - Leer alle 25 technieken",
    },
    {
      id: "roleplay",
      badge: "Rollenspellen",
      title: "Rollenspellen: oefen met AI",
      description:
        "Train verkopen in jouw eigen context via chat, bellen of video-call met Hugo's AI-avatar. Direct feedback, persoonlijke scores en concrete verbeterpunten.",
      features: [
        "Chat, bellen of video-call — kies hoe je wil oefenen",
        "Scenario's in jouw eigen context en situaties",
        "Direct feedback en persoonlijke scores per techniek",
      ],
      imageSrc: roleplayScreenshot,
      imageAlt: "HugoHerbots.ai Rollenspellen - Oefen met AI-avatar",
    },
    {
      id: "analysis",
      badge: "Gespreksanalyse",
      title: "Gespreksanalyse: upload calls of live feedback",
      description: (
        <>
          Upload je gesprekken en krijg binnen het uur feedback op alle 25 technieken. Of laat Hugo<sup className="text-[10px] text-hh-primary">AI</sup> live meeluisteren en ontvang real-time coaching tijdens je call.
        </>
      ),
      features: [
        "Upload opgenomen gesprekken — feedback binnen het uur",
        "Live meeluisteren — real-time coaching tijdens je call",
        "Gedetailleerde analyse per techniek met concrete verbeterpunten",
      ],
      imageSrc: gespreksAnalyseScreenshot,
      imageAlt: "HugoHerbots.ai Gespreksanalyse - Upload calls of live feedback",
    },
  ];

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const slide = slides[currentSlide];

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Desktop: Tabs Navigation at Top */}
      <div className="hidden lg:block">
        <div className="flex flex-wrap gap-3 justify-center mb-8">
          {slides.map((slideItem, idx) => (
            <Button
              key={idx}
              variant={idx === currentSlide ? "default" : "outline"}
              size="lg"
              onClick={() => goToSlide(idx)}
              className={idx === currentSlide ? "bg-hh-primary text-white" : ""}
            >
              {slideItem.badge}
            </Button>
          ))}
        </div>
      </div>

      {/* Desktop: Two-Column Layout with AnimatePresence */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4 }}
          className="hidden lg:grid lg:grid-cols-2 gap-8 lg:gap-12 items-center"
        >
          {/* Left: Features & Description */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-hh-text">
                {slide.title}
              </h3>
              
              <p className="text-hh-muted">
                {slide.description}
              </p>
            </div>

            {/* Feature List */}
            <ul className="space-y-3">
              {slide.features.map((feature, idx) => (
                <li key={idx} className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-hh-success flex-shrink-0 mt-0.5" />
                  <span className="text-hh-text">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: App Screenshot in Browser Frame */}
          <div>
            <Card className="rounded-2xl shadow-hh-lg border-hh-border overflow-hidden">
              <img
                src={slide.imageSrc}
                alt={slide.imageAlt}
                className="w-full h-auto"
              />
            </Card>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Mobile: Vertical stacked cards */}
      <div className="lg:hidden space-y-4">
        {slides.map((slideItem, idx) => (
          <Card
            key={idx}
            className="p-5 rounded-[16px] shadow-hh-sm border-hh-border"
          >
            <div className="space-y-3">
              <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20">
                {slideItem.badge}
              </Badge>
              
              <h3 className="text-[18px] leading-[24px] font-semibold text-hh-text">
                {slideItem.title}
              </h3>
              
              <p className="text-[14px] leading-[22px] text-hh-muted">
                {slideItem.description}
              </p>

              <ul className="space-y-2">
                {slideItem.features.map((feature, featureIdx) => (
                  <li key={featureIdx} className="flex gap-2 items-start">
                    <CheckCircle2 className="w-4 h-4 text-hh-success flex-shrink-0 mt-0.5" />
                    <span className="text-[14px] leading-[20px] text-hh-text">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="pt-2 rounded-xl overflow-hidden border border-hh-border">
                <img
                  src={slideItem.imageSrc}
                  alt={slideItem.imageAlt}
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}