/**
 * LANDING PAGE - HugoHerbots.ai
 * Real app screenshots imported from Figma assets
 */

import { ArrowRight, Play, Users, TrendingUp, MessageSquare, Calendar, Target, ChevronDown } from "lucide-react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Logo } from "./Logo";
import { PricingTier } from "./PricingTier";
import { ProductShowcase } from "./ProductShowcase";
import { StickyHeader } from "./StickyHeader";
import { StickyBottomCTA } from "./StickyBottomCTA";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Switch } from "../ui/switch";
import { useState, useRef } from "react";

const dashboardScreenshot = "/images/video-cursus_1767362924021.png";
const roleplayScreenshot = "/images/rollenspellen_1767362924021.png";
const libraryScreenshot = "/images/video-cursus_1767362924021.png";
const teamSessionsScreenshot = "/images/live_coaching_1767362924020.png";

const hugoVideoPlaceholder = "/images/Hugo-Herbots-WEB-0350.JPG";
const hugoWhiteboardPhoto = "/images/Hugo-Herbots-WEB-0663.JPG";
const hugoCloseupPhoto = "/images/Hugo-Herbots-WEB-0566.JPG";
const hugoPortrait = "/images/hugo_over_hugo.png";
const hugoWalking = "/images/hugo_40jaar_lopen.png";
const hugoBlackBg = "/images/Hugo-Herbots-WEB-0461.JPG";
const hugoHeroPortrait = "/images/Hugo-Herbots-WEB-0350.JPG";
const hugoWriting = "/images/hugo_zo_train_ik.png";
const hugoFlipboard = "/images/Hugo-Herbots-WEB-0663.JPG";

function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

type Page = "landing" | "pricing" | "about" | "login" | "signup" | "preview" | "onboarding" | "dashboard" | "roleplay" | "library" | "builder" | "sessions" | "analytics" | "settings" | "admin-dashboard";

interface LandingProps {
  navigate?: (page: Page) => void;
}

export function Landing({ navigate }: LandingProps) {
  const [isYearly, setIsYearly] = useState(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const handleNavigate = (page: Page) => {
    window.scrollTo(0, 0);
    if (navigate) navigate(page);
  };

  return (
    <div className="bg-hh-bg light" data-theme="light" style={{ colorScheme: 'light' }}>
      {/* Hero Section - Light Gray Background */}
      <div className="bg-hh-ui-50">
        {/* Sticky Header */}
        <StickyHeader currentPage="landing" navigate={handleNavigate} />

        {/* Hero - Large Background Photo with Text Overlay */}
        <section className="relative overflow-hidden" style={{ minHeight: 'calc(100vh - 80px)' }}>
          {/* Background Video - Hugo Writing */}
          <div className="absolute inset-0">
            <video
              autoPlay
              muted
              loop
              playsInline
              poster={hugoWriting}
              className="w-full h-full object-cover object-center"
            >
              <source src="/videos/hero-hugo-schrijft.mp4" type="video/mp4" />
            </video>
            {/* Desktop: dark gradient from left for text contrast */}
            <div className="hidden md:block absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(13,27,42,0.75) 0%, rgba(13,27,42,0.45) 35%, rgba(13,27,42,0.1) 55%, transparent 70%)' }}></div>
            {/* Mobile: dark gradient from bottom for dramatic effect */}
            <div className="md:hidden absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(13,27,42,0.85) 0%, rgba(13,27,42,0.6) 40%, rgba(13,27,42,0.15) 65%, transparent 80%)' }}></div>
          </div>

          {/* Content */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end" style={{ minHeight: 'calc(100vh - 80px)', paddingTop: '15vh' }}>
            <div className="w-full pb-8 sm:pb-16 lg:pb-20">
              <div className="space-y-5 sm:space-y-6 max-w-[580px]">
                {/* Headline - dominant element */}
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0, ease: [0.25, 0.4, 0.25, 1] }}
                  className="text-[44px] leading-[1.02] sm:text-[62px] lg:text-[96px] text-white tracking-tight font-light"
                  style={{ textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}
                >
                  40 jaar sales trainer,<br/>nu jouw persoonlijke coach
                </motion.h1>

                {/* CTA - dominant, dark, with shadow */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
                  className="pt-6"
                >
                  <button
                    id="hero-cta"
                    onClick={() => handleNavigate("preview")}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 h-[48px] text-[16px] leading-[24px] font-[400] bg-hh-ink text-white rounded-2xl transition-all duration-200 hover:opacity-90"
                    style={{ 
                      boxShadow: '0 8px 24px rgba(27,42,74,0.45)',
                    }}
                  >
                    Train met Hugo <ArrowRight className="w-6 h-6" />
                  </button>
                </motion.div>

                {/* Quote - below CTA, subtle, desktop only */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
                  className="hidden md:block text-[18px] leading-[1.5] text-white/60 max-w-md font-light italic"
                >
                  "Want de laatste geboren verkoper is gisteren gestorven..."
                </motion.p>
              </div>

            </div>
          </div>
        </section>
      </div>

      {/* Over Hugo - Sectie 1: "Laatste hoofdstuk" + 1-op-10 eerlijkheid */}
      <section className="bg-white py-20 sm:py-32" id="over-hugo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-12 sm:mb-16">
            <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 mb-6 text-[14px] sm:text-[16px] px-4 py-1.5">
              Wie ben ik?
            </Badge>
            <h2 className="text-[32px] leading-[40px] sm:text-[36px] sm:leading-[44px] lg:text-[40px] lg:leading-[48px] text-hh-text mb-6">
              Ik ben Hugo Herbots.<br/>En dit is mijn laatste hoofdstuk.
            </h2>
          </AnimatedSection>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-end">
            {/* Left Column - Story */}
            <AnimatedSection className="space-y-6" delay={0}>
              <div className="space-y-4">
                <p className="text-[16px] leading-[26px] sm:text-[18px] sm:leading-[28px] text-hh-text">
                  40 jaar training, 20.000 verkopers getraind in meer dan 500 bedrijven. Maar in alle eerlijkheid? <span className="font-[700]">Slechts 1 op de 10 werd een echte topverkoper.</span>
                </p>
                <p className="text-[16px] leading-[26px] sm:text-[18px] sm:leading-[28px] text-hh-text">
                  Waarom? Omdat je niet leert golfen door ernaar te kijken — je moet het doen.
                </p>
                <p className="text-[16px] leading-[26px] sm:text-[18px] sm:leading-[28px] text-hh-text">
                  Economisch was een-op-een training onverantwoord — welk bedrijf betaalt 
                  €1.500 per halve dag voor individuele coaching?
                </p>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4 pt-4">
                <AnimatedSection delay={0.1}>
                  <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border text-center">
                    <div className="text-[28px] leading-[36px] sm:text-[32px] sm:leading-[40px] font-[700] text-hh-text mb-1">
                      40+
                    </div>
                    <div className="text-[12px] leading-[16px] sm:text-[14px] sm:leading-[20px] text-hh-muted">
                      Jaar training
                    </div>
                  </Card>
                </AnimatedSection>
                <AnimatedSection delay={0.2}>
                  <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border text-center">
                    <div className="text-[28px] leading-[36px] sm:text-[32px] sm:leading-[40px] font-[700] text-hh-text mb-1">
                      20K+
                    </div>
                    <div className="text-[12px] leading-[16px] sm:text-[14px] sm:leading-[20px] text-hh-muted">
                      Mensen getraind
                    </div>
                  </Card>
                </AnimatedSection>
                <AnimatedSection delay={0.3}>
                  <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border text-center">
                    <div className="text-[28px] leading-[36px] sm:text-[32px] sm:leading-[40px] font-[700] text-hh-text mb-1">
                      500+
                    </div>
                    <div className="text-[12px] leading-[16px] sm:text-[14px] sm:leading-[20px] text-hh-muted">
                      Bedrijven
                    </div>
                  </Card>
                </AnimatedSection>
              </div>

              {/* Photo Grid - Hugo Walking + Pricing Card */}
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="relative rounded-[16px] overflow-hidden shadow-hh-md">
                  <img 
                    src={hugoWalking} 
                    alt="Hugo Herbots walking"
                    className="w-full h-full object-cover"
                    style={{ aspectRatio: '4/5' }}
                  />
                </div>
                <Card className="p-4 sm:p-6 rounded-[16px] shadow-hh-md border-0 bg-hh-ink text-white flex flex-col justify-center" style={{ aspectRatio: '4/5' }}>
                  <div className="flex flex-col h-full justify-center items-center">
                    <div className="text-[11px] leading-[16px] sm:text-[14px] sm:leading-[20px] text-hh-ui-300 mb-1 sm:mb-2">
                      Vroeger live
                    </div>
                    <div className="text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] font-[700] mb-1 sm:mb-2">
                      €1.5K
                    </div>
                    <div className="text-[10px] leading-[14px] sm:text-[12px] sm:leading-[16px] text-hh-ui-300 mb-4 sm:mb-6">
                      per halve dag
                    </div>
                    <div className="w-full border-t border-hh-ui-600 pt-4 sm:pt-6 text-center">
                      <div className="text-[11px] leading-[16px] sm:text-[14px] sm:leading-[20px] text-hh-ui-300 mb-1 sm:mb-2">
                        Nu met AI
                      </div>
                      <div className="text-[28px] leading-[36px] sm:text-[32px] sm:leading-[40px] font-[700] mb-1">
                        €499
                      </div>
                      <div className="text-[10px] leading-[14px] sm:text-[12px] sm:leading-[16px] text-hh-ui-300">
                        per maand 24/7
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </AnimatedSection>

            {/* Right Column - Large Hugo Portrait */}
            <AnimatedSection className="relative" delay={0.2}>
              <div className="relative rounded-[24px] overflow-hidden shadow-hh-lg">
                <img 
                  src={hugoPortrait} 
                  alt="Hugo Herbots - Sales trainer en coach"
                  className="w-full h-full object-cover"
                  style={{ aspectRatio: '3/4' }}
                />
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Over Hugo - Sectie 2: "Waarom AI?" */}
      <section className="bg-hh-ui-50 py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left Column - Large Hugo Flipboard Photo */}
            <AnimatedSection className="relative order-2 lg:order-1" delay={0}>
              <div className="relative rounded-[24px] overflow-hidden shadow-hh-lg">
                <img 
                  src={hugoFlipboard} 
                  alt="Hugo Herbots teaching with flipboard"
                  className="w-full h-full object-cover"
                  style={{ aspectRatio: '3/4' }}
                />
              </div>
            </AnimatedSection>

            {/* Right Column - AI Story */}
            <AnimatedSection className="space-y-6 order-1 lg:order-2" delay={0.2}>
              <div className="space-y-4">
                <h3 className="text-[24px] leading-[32px] sm:text-[28px] sm:leading-[36px] lg:text-[32px] lg:leading-[40px] text-hh-text font-[700]">
                  Waarom nu? Waarom AI?
                </h3>
                <p className="text-[16px] leading-[26px] sm:text-[18px] sm:leading-[28px] text-hh-text">
                  Dankzij AI train je met mij — niet een keer per week in een groep, maar <span className="font-[700]">elke dag, prive, van thuis.</span> Met directe feedback zoals ik die live zou geven. Vanaf €29 per maand, 24/7 beschikbaar
                </p>
                <p className="text-[16px] leading-[26px] sm:text-[18px] sm:leading-[28px] text-hh-text">
                  Ik ben in het laatste hoofdstuk van mijn leven. 40 jaar verfijnde scripts, 54 technieken, 20.000+ sessies — het zou jammer zijn, moest deze kennis verdwijnen.
                </p>
              </div>

              <div className="pt-4">
                <Button 
                  size="lg" 
                  variant="ink" 
                  className="text-[16px] h-12 px-6"
                  onClick={() => handleNavigate("preview")}
                >
                  Train met Hugo
                </Button>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* App Showcase Section - Zo werkt het - WHITE BACKGROUND */}
      <section className="bg-white max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32" id="zo-werkt-het">
        <AnimatedSection className="text-center mb-16 sm:mb-20">
          <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 mb-6 text-[14px] sm:text-[16px] px-4 py-1.5">
            Zo werkt het
          </Badge>
          <h2 className="text-[32px] leading-[40px] sm:text-[36px] sm:leading-[44px] lg:text-[40px] lg:leading-[48px] text-hh-text mb-6 px-4">
            4 modules. 4 manieren om te trainen. 4x100% Hugo Herbots.
          </h2>
          <p className="text-[16px] leading-[24px] sm:text-[16px] sm:leading-[26px] lg:text-[18px] lg:leading-[28px] text-hh-muted max-w-3xl mx-auto px-4">
            AI role-plays, live coaching, video cursus, gespreksanalyse — gebaseerd op 40 jaar praktijk.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <ProductShowcase />
        </AnimatedSection>
      </section>

      {/* De Methode - 4 Fasen Section - LIGHT GRAY BACKGROUND */}
      <section className="bg-hh-ui-50 py-20 sm:py-32" id="epic-methode">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-12 sm:mb-16">
            <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 mb-6 text-[14px] sm:text-[16px] px-4 py-1.5">
              E.P.I.C. TECHNIQUE
            </Badge>
            <h2 className="text-[32px] leading-[40px] sm:text-[36px] sm:leading-[44px] lg:text-[40px] lg:leading-[48px] text-hh-text mb-6">
              Mijn methode: 4 fasen, 54 technieken
            </h2>
            <p className="text-[16px] leading-[24px] sm:text-[16px] sm:leading-[26px] text-hh-muted max-w-2xl mx-auto">
              De laatste geboren verkoper is gisteren gestorven.
            </p>
          </AnimatedSection>

          {/* Fase Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {[
              {
                phase: "Fase 1",
                title: "Openingsfase",
                desc: "Creeer het juiste koopklimaat. Start met een gentleman's agreement en een sterke firmavoorstelling. Stel de perfecte instapvraag.",
                techniques: ["Koopklimaat creeren", "Gentleman's agreement", "Firmavoorstelling", "Instapvraag"],
                badgeClass: "bg-hh-primary/10 text-hh-primary border-hh-primary/20",
              },
              {
                phase: "Fase 2",
                title: "Ontdekkingsfase",
                desc: "Stel feitgerichte en meningsgerichte vragen. Luister actief en empathisch. Gebruik pingpong en LEAD questioning om dieper te graven.",
                techniques: ["Feitgerichte vragen", "Open vragen", "Actief luisteren", "Pingpong techniek", "LEAD questioning"],
                badgeClass: "bg-slate-500/10 text-slate-600 border-slate-500/20",
              },
              {
                phase: "Fase 3",
                title: "Aanbevelingsfase",
                desc: "Toon empathie, presenteer oplossing, voordeel en baat. Vraag mening onder alternatieve vorm.",
                techniques: ["Empathie tonen", "Oplossing", "Voordeel", "Baat", "Mening vragen"],
                badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
              },
              {
                phase: "Fase 4",
                title: "Beslissingsfase",
                desc: "Proefafsluiting, handle vragen/bezwaren/twijfels met rust en vertrouwen. Omarm angst en bezorgdheden.",
                techniques: ["Proefafsluiting", "Klant stelt vragen", "Bezwaren", "Twijfels", "Angst/Bezorgdheden"],
                badgeClass: "bg-green-500/10 text-green-600 border-green-500/20",
              },
            ].map((item, idx) => (
              <AnimatedSection key={idx} delay={idx * 0.1}>
                <Card
                  className="p-6 rounded-[16px] shadow-hh-md border-hh-border hover:shadow-hh-lg transition-shadow bg-white"
                >
                  <Badge className={`${item.badgeClass} mb-3`}>
                    {item.phase}
                  </Badge>
                  <h3 className="text-[18px] leading-[26px] sm:text-[22px] sm:leading-[30px] text-hh-text mb-2">
                    {item.title}
                  </h3>
                  <p className="text-[14px] leading-[20px] sm:text-[16px] sm:leading-[24px] text-hh-muted mb-4">
                    {item.desc}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.techniques.map((tech, techIdx) => (
                      <Badge key={techIdx} variant="outline" className="text-[11px] sm:text-[12px]">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials - Social Proof */}
      <section className="bg-white py-20 sm:py-32" id="testimonials">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-12 sm:mb-16">
            <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 mb-6 text-[14px] sm:text-[16px]">
              Mijn klanten
            </Badge>
            <h2 className="text-[32px] leading-[40px] sm:text-[36px] sm:leading-[44px] text-hh-text mb-4">
              Reacties van teams die ik gecoacht heb
            </h2>
            <p className="text-[16px] leading-[24px] sm:text-[16px] sm:leading-[26px] text-hh-muted max-w-2xl mx-auto">
              Van SDR's tot VP's Sales — Hugo's methode werkt in elk stadium van je carriere
            </p>
          </AnimatedSection>

          {/* Testimonials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                quote: "Wie schrijft die blijft, zegt Hugo — en het klopt. Ik haatte sales. 6% conversie, elke maand stress. 9 maanden met Hugo → 12% conversie. Dubbel zoveel commissie.",
                name: "Sarah van Dijk",
                role: "SDR",
                company: "SaaS",
                metric: "+100%",
                metricLabel: "Conversie stijging",
              },
              {
                quote: "Eindelijk een training die echt werkt. Geen theorie, maar praktijk. Mijn team gebruikt de technieken dagelijks.",
                name: "Mark de Jong",
                role: "VP Sales",
                company: "Enterprise Software",
                stat: "€450K",
                statLabel: "Extra ARR in Q1",
              },
              {
                quote: "De live sessies met Hugo zijn het verschil. Real-time vragen stellen en direct antwoorden — precies wat ik nodig had.",
                name: "Lisa Vermeer",
                role: "Account Executive",
                company: "B2B Tech",
                stat: "92%",
                statLabel: "Closing rate",
              },
            ].map((testimonial, idx) => (
              <AnimatedSection key={idx} delay={idx * 0.1}>
                <Card className="p-6 rounded-[16px] shadow-hh-md border-hh-border bg-white hover:shadow-hh-lg transition-shadow">
                  <div className="flex flex-col h-full">
                    <div className="mb-4">
                      <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20">
                        {testimonial.stat ? `${testimonial.stat} ${testimonial.statLabel}` : `${testimonial.metric} ${testimonial.metricLabel}`}
                      </Badge>
                    </div>
                    <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[26px] text-hh-text italic mb-6 flex-grow">
                      "{testimonial.quote}"
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-hh-primary/10 flex items-center justify-center text-hh-primary text-[14px] sm:text-[18px] font-semibold">
                        {testimonial.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-[14px] leading-[20px] sm:text-[16px] text-hh-text font-medium">
                          {testimonial.name}
                        </p>
                        <p className="text-[12px] leading-[16px] sm:text-[14px] sm:leading-[18px] text-hh-muted">
                          {testimonial.role} • {testimonial.company}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="bg-hh-ui-50 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32" id="prijzen">
        <AnimatedSection className="text-center mb-12 sm:mb-16">
          <Badge className="bg-hh-warn/10 text-hh-warn border-hh-warn/20 mb-6 text-[14px] sm:text-[16px] px-4 py-1.5">
            Kies je plan
          </Badge>
          <h2 className="text-[32px] leading-[40px] sm:text-[36px] sm:leading-[44px] lg:text-[40px] lg:leading-[48px] text-hh-text mb-6">
            Vroeger: €1.500 per halve dag. Nu: vanaf €29/maand.
          </h2>
          <p className="text-[16px] leading-[24px] sm:text-[16px] sm:leading-[26px] lg:text-[18px] lg:leading-[28px] text-hh-muted max-w-3xl mx-auto mb-8">
            Live met Hugo kost €1.500 per halve dag. Met de AI-salescoach oefen je elke dag — wanneer het jou past.
          </p>
          
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className={`text-[16px] leading-[24px] ${!isYearly ? 'text-hh-text font-medium' : 'text-hh-muted'}`}>
              Maandelijks
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-hh-primary"
            />
            <span className={`text-[16px] leading-[24px] ${isYearly ? 'text-hh-text font-medium' : 'text-hh-muted'}`}>
              Jaarlijks
            </span>
            {isYearly && (
              <Badge className="bg-hh-warn/10 text-hh-warn border-hh-warn/20 ml-2">
                Bespaar tot 40%
              </Badge>
            )}
          </div>
        </AnimatedSection>
        
        {/* Desktop: Grid */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-6 sm:gap-8">
          <AnimatedSection delay={0}>
            <PricingTier
              name="Pro"
              price={isYearly ? "€29" : "€49"}
              period="/maand"
              priceNote={isYearly ? "Gefactureerd jaarlijks" : undefined}
              features={[
                "AI-avatar simulaties (onbeperkt)",
                "Persoonlijk dashboard & feedback",
                "Email support",
                "Exports & rapportages",
              ]}
              cta="Train met Hugo"
              onCtaClick={() => handleNavigate("preview")}
            />
          </AnimatedSection>
          <AnimatedSection delay={0.1}>
            <PricingTier
              name="Founder"
              price={isYearly ? "€249,50" : "€499"}
              period="/maand"
              priceNote={isYearly ? "Gefactureerd jaarlijks" : undefined}
              subtitleNote="Beperkt tot 100 leden"
              features={[
                "Alles van Pro",
                "Video series",
                "Dagelijkse live sessies (ma-vr) + Q&A",
                "Onmiddellijk herbekijken",
                "Priority support",
                "Founder community toegang",
              ]}
              cta="Train met Hugo"
              highlighted
              badge="Populair"
              onCtaClick={() => handleNavigate("preview")}
            />
          </AnimatedSection>
          <AnimatedSection delay={0.2}>
            <PricingTier
              name="Inner Circle"
              price={isYearly ? "€1.249" : "€1.499"}
              period="/maand"
              priceNote={isYearly ? "Gefactureerd jaarlijks" : undefined}
              subtitleNote="Exclusief — max 20 leden"
              features={[
                "Alles van Founder",
                "1-op-1 coaching calls met Hugo",
                "Directe lijn met Hugo",
                "Custom scenario's op maat",
                "Dedicated onboarding",
              ]}
              cta="Neem contact op"
              premium
              badge="Exclusief"
              onCtaClick={() => handleNavigate("preview")}
            />
          </AnimatedSection>
        </div>

        {/* Mobile: Stacked pricing cards */}
        <div className="lg:hidden space-y-4">
          <PricingTier
            name="Pro"
            price={isYearly ? "€29" : "€49"}
            period="/maand"
            priceNote={isYearly ? "Gefactureerd jaarlijks" : undefined}
            features={[
              "AI-avatar simulaties (onbeperkt)",
              "Persoonlijk dashboard & feedback",
              "Email support",
              "Exports & rapportages",
            ]}
            cta="Train met Hugo"
            onCtaClick={() => handleNavigate("preview")}
          />
          <PricingTier
            name="Founder"
            price={isYearly ? "€249,50" : "€499"}
            period="/maand"
            priceNote={isYearly ? "Gefactureerd jaarlijks" : undefined}
            subtitleNote="Beperkt tot 100 leden"
            features={[
              "Alles van Pro",
              "Video series",
              "Dagelijkse live sessies (ma-vr) + Q&A",
              "Onmiddellijk herbekijken",
              "Priority support",
              "Founder community toegang",
            ]}
            cta="Train met Hugo"
            highlighted
            badge="Populair"
            onCtaClick={() => handleNavigate("preview")}
          />
          <PricingTier
            name="Inner Circle"
            price={isYearly ? "€1.249" : "€1.499"}
            period="/maand"
            priceNote={isYearly ? "Gefactureerd jaarlijks" : undefined}
            subtitleNote="Exclusief — max 20 leden"
            features={[
              "Alles van Founder",
              "1-op-1 coaching calls met Hugo",
              "Directe lijn met Hugo",
              "Custom scenario's op maat",
              "Dedicated onboarding",
            ]}
            cta="Neem contact op"
            premium
            badge="Exclusief"
            onCtaClick={() => handleNavigate("preview")}
          />
        </div>
        <AnimatedSection className="text-center mt-12" delay={0.3}>
          <Button 
            size="lg" 
            variant="outline" 
            onClick={() => handleNavigate("pricing")}
          >
            Bekijk volledige prijzen →
          </Button>
        </AnimatedSection>
      </section>

      {/* FAQ */}
      <section className="bg-white py-20 sm:py-32" id="faq">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-12 sm:mb-16">
            <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 mb-6 text-[14px] sm:text-[16px] px-4 py-1.5">
              FAQ
            </Badge>
            <h2 className="text-[32px] leading-[40px] sm:text-[36px] sm:leading-[44px] lg:text-[40px] lg:leading-[48px] text-hh-text mb-12 sm:mb-16">
              Veelgestelde vragen
            </h2>
          </AnimatedSection>
          <div className="space-y-4">
            {[
              {
                q: "Hoe werkt Hugo's AI-salescoach?",
                a: "Je oefent gesprekken met mijn avatar. Na elke sessie krijg je directe feedback op 54 technieken — precies zoals ik live coach.",
              },
              {
                q: "Kan ik eigen scenario's toevoegen?",
                a: "Ja, vanaf Pro. Upload je cases, bezwaren en context  ik pas de training daarop aan.",
              },
              {
                q: "Is er een gratis trial?",
                a: "Ja. 14 dagen volledig proberen, zonder creditcard.",
              },
              {
                q: "Kan ik opzeggen wanneer ik wil?",
                a: "Ja, altijd. Geen verplichte looptijd. Zeg op via je account en je toegang stopt aan het einde van je betaalperiode.",
              },
              {
                q: "Wat als ik geen tijd heb voor dagelijkse live sessies?",
                a: "Geen probleem. Alle live sessies worden binnen 2 uur herbekeken beschikbaar gesteld met chapters. Je kunt ze terugkijken wanneer het jou uitkomt.",
              },
              {
                q: "Is dit geschikt voor mijn sector?",
                a: "Ja. De technieken zijn universeel toepasbaar — B2B, B2C, SaaS, enterprise, fintech. Psychologie verandert niet per sector.",
              },
              {
                q: "Wat gebeurt er na de 14 dagen trial?",
                a: "Als je niet annuleert, begint je betaalde abonnement automatisch. Je krijgt 48 uur voor afloop een herinnering.",
              },
              {
                q: "Kan ik Hugo een vraag stellen?",
                a: "Ja, tijdens de dagelijkse live Q&A sessies (ma–vr). Of stel je vraag via de community en ik beantwoord binnen 24 uur.",
              },
            ].map((item, idx) => (
              <AnimatedSection key={idx} delay={idx * 0.05}>
                <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
                  <h3 className="text-[18px] leading-[26px] font-semibold text-hh-text mb-2">
                    {item.q}
                  </h3>
                  <p className="text-[16px] leading-[24px] text-hh-muted">
                    {item.a}
                  </p>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-hh-ink py-20 sm:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection>
            <h2 className="text-[36px] leading-[44px] sm:text-[44px] sm:leading-[52px] lg:text-[56px] lg:leading-[64px] text-white mb-6">
              54 technieken. 4 fasen. Vanaf €29/maand.
            </h2>
            <p className="text-[16px] leading-[26px] sm:text-[18px] sm:leading-[28px] text-hh-ui-300 mb-10 max-w-2xl mx-auto">
              Sales is mensenwerk. 'People buy people' — en de psychologie leer je hier.
            </p>
            <Button 
              size="lg" 
              variant="ink" 
              className="text-[18px] h-14 px-8"
              onClick={() => handleNavigate("preview")}
            >
              Train met Hugo <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-hh-border py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
            <div>
              <Logo variant="horizontal" className="text-hh-ink mb-4 text-[18px]" />
              <p className="text-[14px] leading-[20px] text-hh-muted">
                AI-salescoach door Hugo Herbots
              </p>
            </div>
            <div>
              <h4 className="text-[16px] leading-[24px] font-medium text-hh-text mb-3">
                Product
              </h4>
              <ul className="space-y-2 text-[14px] leading-[20px] text-hh-muted">
                <li>
                  <button 
                    onClick={() => handleNavigate("pricing")} 
                    className="hover:text-hh-primary transition-colors"
                  >
                    Prijzen
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNavigate("landing")} 
                    className="hover:text-hh-primary transition-colors"
                  >
                    Features
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNavigate("preview")} 
                    className="hover:text-hh-primary transition-colors"
                  >
                    Bekijk demo met Hugo
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-[16px] leading-[24px] font-medium text-hh-text mb-3">
                Bedrijf
              </h4>
              <ul className="space-y-2 text-[14px] leading-[20px] text-hh-muted">
                <li>
                  <button 
                    onClick={() => handleNavigate("about")} 
                    className="hover:text-hh-primary transition-colors"
                  >
                    Over Hugo
                  </button>
                </li>
                <li>
                  <a href="#" className="hover:text-hh-primary transition-colors">Contact</a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-[16px] leading-[24px] font-medium text-hh-text mb-3">
                Legal
              </h4>
              <ul className="space-y-2 text-[14px] leading-[20px] text-hh-muted">
                <li><a href="#" className="hover:text-hh-primary transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-hh-primary transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-hh-border text-center text-[14px] leading-[20px] text-hh-muted">
            © 2025 HugoHerbots.ai. Alle rechten voorbehouden.
          </div>
        </div>
      </footer>

      {/* Sticky Bottom CTA - Mobile only */}
      <StickyBottomCTA navigate={handleNavigate} />
    </div>
  );
}