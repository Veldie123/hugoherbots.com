/**
 * LANDING PAGE - HugoHerbots.ai
 * Real app screenshots imported from Figma assets
 */

import { Button } from "../ui/button";
import { PricingTier } from "./PricingTier";
import { TranscriptLine } from "./TranscriptLine";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Logo } from "./Logo";
import { StickyHeader } from "./StickyHeader";
import { BrowserMockup } from "./BrowserMockup";
import { ProductShowcase } from "./ProductShowcase";
import { useState } from "react";

const dashboardScreenshot = "/images/video-cursus_1767362924021.png";
const roleplayScreenshot = "/images/rollenspellen_1767362924021.png";
const libraryScreenshot = "/images/video-cursus_1767362924021.png";
const teamSessionsScreenshot = "/images/live_coaching_1767362924020.png";

import {
  Play,
  TrendingUp,
  Target,
  MessageSquare,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Users,
  Zap,
  Shield,
  Check,
  Video,
  Bot,
  Radio,
  Menu,
  X,
} from "lucide-react";

const hugoHero = "/images/Hugo-Herbots-WEB-0350.JPG";
const hugoPortrait = "/images/hugo_over_hugo.png";
const hugoWhiteboardPhoto = "/images/Hugo-Herbots-WEB-0663.JPG";
const hugoWalking = "/images/hugo_40jaar_lopen.png";
const hugoWriting = "/images/hugo_zo_train_ik.png";
const hugoCloseupPhoto = "/images/Hugo-Herbots-WEB-0566.JPG";
const hugoBlackBg = "/images/Hugo-Herbots-WEB-0461.JPG";
const hugoPrijsVierkant = "/images/hugo_prijs_vierkant.png";

type Page = "landing" | "pricing" | "about" | "login" | "signup" | "preview" | "onboarding" | "dashboard" | "roleplay" | "library" | "builder" | "sessions" | "analytics" | "settings";

interface LandingProps {
  navigate?: (page: Page) => void;
}

export function Landing({ navigate }: LandingProps) {
  const [isYearly, setIsYearly] = useState(true); // Default to yearly
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigate = (page: Page) => {
    window.scrollTo(0, 0); // Scroll to top on navigation
    setMobileMenuOpen(false); // Close mobile menu on navigate
    if (navigate) navigate(page);
  };

  return (
    <div className="bg-hh-bg">
      {/* Hero Section - Light Gray Background */}
      <div className="bg-hh-ui-50">
        {/* Sticky Header */}
        <div className="sticky top-0 z-50 bg-hh-ui-50/95 backdrop-blur-sm border-b border-hh-border/50">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              {/* Logo */}
              <Logo variant="horizontal" className="text-hh-ink text-[20px]" />
              
              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-8">
                <a 
                  href="#" 
                  className="text-[15px] text-hh-muted hover:text-hh-text transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate("preview");
                  }}
                >
                  Probeer de app
                </a>
                <a 
                  href="#" 
                  className="text-[15px] text-hh-muted hover:text-hh-text transition-colors" 
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate("about");
                  }}
                >
                  Over Hugo
                </a>
                <a 
                  href="#" 
                  className="text-[15px] text-hh-muted hover:text-hh-text transition-colors" 
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigate("pricing");
                  }}
                >
                  Pricing
                </a>
              </nav>
              
              {/* Desktop CTAs */}
              <div className="hidden lg:flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  className="text-hh-text hover:bg-white/50"
                  onClick={() => handleNavigate("login")}
                >
                  Login
                </Button>
                <Button 
                  size="lg"
                  variant="default" 
                  className="bg-hh-ink text-white hover:bg-hh-ink/90"
                  onClick={() => handleNavigate("preview")}
                >
                  Start gratis
                </Button>
              </div>

              {/* Mobile: CTA + Menu */}
              <div className="flex lg:hidden items-center gap-2">
                <Button 
                  variant="default" 
                  className="bg-hh-ink text-white hover:bg-hh-ink/90"
                  onClick={() => handleNavigate("preview")}
                >
                  Start gratis
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-hh-text hover:bg-white/50"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && (
              <div className="lg:hidden border-t border-hh-border/50 py-4">
                <nav className="flex flex-col space-y-3">
                  <a 
                    href="#" 
                    className="text-[16px] text-hh-text hover:text-hh-primary transition-colors py-2"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigate("preview");
                    }}
                  >
                    Probeer de app
                  </a>
                  <a 
                    href="#" 
                    className="text-[16px] text-hh-text hover:text-hh-primary transition-colors py-2" 
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigate("about");
                    }}
                  >
                    Over Hugo
                  </a>
                  <a 
                    href="#" 
                    className="text-[16px] text-hh-text hover:text-hh-primary transition-colors py-2" 
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigate("pricing");
                    }}
                  >
                    Pricing
                  </a>
                  <div className="pt-3 border-t border-hh-border/50">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-hh-text hover:bg-white/50"
                      onClick={() => handleNavigate("login")}
                    >
                      Login
                    </Button>
                  </div>
                </nav>
              </div>
            )}
          </div>
        </div>

        {/* Hero - Large Background Photo with Text Overlay */}
        <section className="relative overflow-hidden" style={{ minHeight: 'calc(100vh - 80px)' }}>
          {/* Background Image - Hugo Hero */}
          <div className="absolute inset-0">
            <img 
              src={hugoHero} 
              alt="Hugo Herbots"
              className="w-full h-full object-cover object-center"
            />
            {/* Subtle gradient overlay for text readability on left side */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/40 to-transparent"></div>
          </div>

          {/* Content */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
            <div className="w-full flex items-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
              {/* Left - Text Content */}
              <div className="space-y-10 max-w-2xl pt-20 pb-32">
                {/* Opening - Personal Introduction */}
                <div className="space-y-6">
                  <h1 className="text-[56px] leading-[1.05] sm:text-[68px] lg:text-[88px] text-hh-text tracking-tight font-light">
                    Wie schrijft,<br/>die blijft
                  </h1>
                  <p className="text-[20px] leading-[1.5] sm:text-[24px] lg:text-[28px] text-hh-muted max-w-lg font-light">
                    40 jaar sales trainer,<br/>nu jouw persoonlijke coach
                  </p>
                </div>

                {/* CTAs - HH Brand Style */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    size="lg"
                    variant="ink"
                    className="bg-hh-ink text-white hover:bg-hh-ink/90"
                    onClick={() => handleNavigate("signup")}
                  >
                    Start gratis met Hugo
                  </Button>
                  <Button 
                    size="lg"
                    variant="outline"
                    className="border-hh-border text-hh-text hover:bg-white/50 bg-white/80 backdrop-blur-sm"
                  >
                    Bekijk demo met Hugo
                  </Button>
                </div>

                {/* Features - With Icons */}
                <div className="space-y-3 pt-8">
                  <div className="flex items-start gap-3">
                    <Radio className="w-5 h-5 text-hh-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[16px] leading-[1.4] text-hh-text font-medium">Live coaching sessies</div>
                      <div className="text-[14px] text-hh-muted mt-1">Dagelijks ma–vr met Q&A</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Bot className="w-5 h-5 text-hh-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[16px] leading-[1.4] text-hh-text font-medium">AI-gebaseerde training</div>
                      <div className="text-[14px] text-hh-muted mt-1">Oefen 24/7 met directe feedback</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Video className="w-5 h-5 text-hh-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[16px] leading-[1.4] text-hh-text font-medium">Video cursus</div>
                      <div className="text-[14px] text-hh-muted mt-1">25 technieken in 5 fasen</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Rest of the page - Light background */}
      {/* App Showcase Section - Zo werkt het - WHITE BACKGROUND */}
      <section className="bg-white max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32" id="zo-werkt-het">
        <div className="text-center mb-16 sm:mb-20">
          <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 mb-6 text-[14px] sm:text-[16px] px-4 py-1.5">
            Zo werkt het
          </Badge>
          <h2 className="text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px] text-hh-text mb-6 px-4">
            Train met Hugo's AI avatar en zie direct je groei
          </h2>
          <p className="text-[16px] leading-[24px] sm:text-[18px] sm:leading-[28px] lg:text-[20px] lg:leading-[32px] text-hh-muted max-w-3xl mx-auto px-4">
            Real-time feedback, persoonlijke dashboards en concrete verbeterpunten — zoals een live sessie met Hugo.
          </p>
        </div>

        <ProductShowcase />
      </section>

      {/* Who is Hugo - New Section - LIGHT GRAY BACKGROUND */}
      <section className="bg-hh-ui-50 py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 mb-6 text-[14px] sm:text-[16px] px-4 py-1.5">
                Over Hugo Herbots
              </Badge>
              <h2 className="text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px] text-hh-text mb-6">
                40 jaar salesgeheimen. Nu jouw personal sales coach.
              </h2>
              <p className="text-[16px] leading-[24px] sm:text-[18px] sm:leading-[28px] text-hh-muted mb-6">
                Ik heb <strong className="text-hh-text">20.000+ professionals</strong> getraind in de kunst van verkopen. 
                Geen trucjes of slimme praatjes. Alleen bewezen psychologie en menselijke verbinding.
              </p>
              <p className="text-[16px] leading-[24px] sm:text-[18px] sm:leading-[28px] text-hh-muted mb-8">
                Mijn live training kostte <strong className="text-hh-text">€2.000 per halve dag</strong> en was alleen beschikbaar 
                voor een select groepje bedrijven. Nu deel ik alles wat ik weet via mijn AI-avatar — 24/7 beschikbaar, 
                voor iedereen die beter wil worden.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Button size="lg" variant="ink" className="gap-2" onClick={() => handleNavigate("about")}>
                  Lees Hugo's verhaal <ArrowRight className="w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline" className="gap-2">
                  <Play className="w-4 h-4" /> Bekijk demo
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-hh-border">
                <div>
                  <p className="text-[24px] leading-[32px] sm:text-[32px] sm:leading-[40px] text-hh-text">40+</p>
                  <p className="text-[12px] leading-[18px] sm:text-[14px] sm:leading-[20px] text-hh-muted">Jaar ervaring</p>
                </div>
                <div>
                  <p className="text-[24px] leading-[32px] sm:text-[32px] sm:leading-[40px] text-hh-text">20K+</p>
                  <p className="text-[12px] leading-[18px] sm:text-[14px] sm:leading-[20px] text-hh-muted">Getrainde mensen</p>
                </div>
                <div>
                  <p className="text-[24px] leading-[32px] sm:text-[32px] sm:leading-[40px] text-hh-text">500+</p>
                  <p className="text-[12px] leading-[18px] sm:text-[14px] sm:leading-[20px] text-hh-muted">Bedrijven</p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="grid grid-cols-2 gap-4">
                <Card className="rounded-[20px] shadow-hh-lg border-hh-border overflow-hidden aspect-[3/4] col-span-2">
                  <img 
                    src={hugoPortrait} 
                    alt="Hugo Herbots - AI Salescoach"
                    className="w-full h-full object-cover"
                  />
                </Card>
                <Card className="rounded-[20px] shadow-hh-md border-hh-border overflow-hidden aspect-square">
                  <img 
                    src={hugoWalking} 
                    alt="Hugo Herbots - 40 jaar training ervaring"
                    className="w-full h-full object-cover"
                  />
                </Card>
                <Card className="rounded-[20px] shadow-hh-md border-hh-border overflow-hidden aspect-square p-6 bg-hh-ink flex items-center justify-center">
                  <div className="text-center text-white">
                    <p className="text-[40px] leading-[48px] mb-2">€2K</p>
                    <p className="text-[12px] leading-[18px] text-hh-ui-300">Live halve dag</p>
                    <p className="text-[14px] leading-[20px] my-3">→</p>
                    <p className="text-[32px] leading-[40px] mb-2 text-hh-primary">€499</p>
                    <p className="text-[12px] leading-[18px] text-hh-ui-300">Per maand 24/7</p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="text-center mb-12 sm:mb-16">
          <Badge className="bg-hh-warn/10 text-hh-warn border-hh-warn/20 mb-6 text-[14px] sm:text-[16px] px-4 py-1.5">
            Founder Annual –50% (beperkt)
          </Badge>
          <h2 className="text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px] text-hh-text mb-6">
            De waarde van 40 jaar training, voor een fractie van live
          </h2>
          <p className="text-[16px] leading-[24px] sm:text-[18px] sm:leading-[28px] lg:text-[20px] lg:leading-[32px] text-hh-muted max-w-3xl mx-auto mb-8">
            Live met Hugo kost €2.000 per halve dag voor een kleine groep. Met de AI-salescoach en dagelijkse live sessies oefen je elke dag — wanneer het jou past.
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
                Bespaar 50%
              </Badge>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <PricingTier
            name="Pro"
            price={isYearly ? "€119" : "€149"}
            period="/maand"
            priceNote={isYearly ? "Gefactureerd jaarlijks" : undefined}
            features={[
              "AI-avatar simulaties (onbeperkt)",
              "Persoonlijk dashboard & feedback",
              "Custom scenarios",
              "Community & challenges",
              "Email support",
              "Exports & rapportages",
            ]}
            cta="Start gratis"
            onCtaClick={() => handleNavigate("preview")}
          />
          <PricingTier
            name="Founder (Early Bird)"
            price={isYearly ? "€249,50" : "€499"}
            period="/maand"
            priceNote={isYearly ? "Gefactureerd jaarlijks" : undefined}
            features={[
              "Alles van Pro",
              "Dagelijkse live sessies (ma–vr) + Q&A",
              "Onmiddellijk herbekijken met chapters",
              "Founder Annual –50% (beperkte plaatsen)",
              "Prioriteit op nieuwe scenario's",
              "Priority support",
            ]}
            cta="Start gratis"
            highlighted
            badge={isYearly ? "–50% Early Bird" : "Meest gekozen"}
            onCtaClick={() => handleNavigate("preview")}
          />
          <PricingTier
            name="Company (10+ seats)"
            price="Op aanvraag"
            features={[
              "Alles van Founder",
              "Teamdashboard & reporting",
              "Custom scenario's & integraties (SSO/LMS/CRM)",
              "Dedicated success manager",
              "Interne Q&A-momenten voor je team",
            ]}
            cta="Plan een gesprek"
          />
        </div>
        <div className="text-center mt-12">
          <Button 
            size="lg" 
            variant="outline" 
            onClick={() => handleNavigate("pricing")}
          >
            Bekijk volledige prijzen →
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-hh-ui-50 py-20 sm:py-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px] text-hh-text mb-12 sm:mb-16 text-center">
            Veelgestelde vragen
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "Hoe werkt Hugo's AI-salescoach?",
                a: "Je oefent gesprekken met mijn avatar. Na elke sessie krijg je directe feedback op 25 technieken — precies zoals ik live coach.",
              },
              {
                q: "Kan ik eigen scenario's toevoegen?",
                a: "Ja, vanaf Pro. Upload je cases, bezwaren en context — ik pas de training daarop aan.",
              },
              {
                q: "Is er een gratis trial?",
                a: "Ja. 14 dagen volledig proberen, zonder creditcard.",
              },
            ].map((item, idx) => (
              <Card key={idx} className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
                <h3 className="text-[18px] leading-[26px] font-semibold text-hh-text mb-2">
                  {item.q}
                </h3>
                <p className="text-[16px] leading-[24px] text-hh-muted">
                  {item.a}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-hh-ink py-20 sm:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-[36px] leading-[44px] sm:text-[44px] sm:leading-[52px] lg:text-[56px] lg:leading-[64px] text-white mb-6">
            Train elke dag. Win elke week. Met Hugo.
          </h2>
          <p className="text-[18px] leading-[28px] sm:text-[20px] sm:leading-[32px] text-hh-ui-300 mb-10 max-w-2xl mx-auto">
            Sales is mensenwerk. 'People buy people' — en de psychologie leer je hier.
          </p>
          <Button 
            size="lg" 
            variant="ink" 
            className="text-[18px] h-14 px-8"
            onClick={() => handleNavigate("signup")}
          >
            Start gratis met Hugo <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
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
                <li><a href="#">Prijzen</a></li>
                <li><a href="#">Features</a></li>
                <li><a href="#">Bekijk demo met Hugo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[16px] leading-[24px] font-medium text-hh-text mb-3">
                Bedrijf
              </h4>
              <ul className="space-y-2 text-[14px] leading-[20px] text-hh-muted">
                <li><a href="#">Over Hugo</a></li>
                <li><a href="#">Careers</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[16px] leading-[24px] font-medium text-hh-text mb-3">
                Legal
              </h4>
              <ul className="space-y-2 text-[14px] leading-[20px] text-hh-muted">
                <li><a href="#">Privacy</a></li>
                <li><a href="#">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-hh-border text-center text-[14px] leading-[20px] text-hh-muted">
            © 2025 HugoHerbots.ai. Alle rechten voorbehouden.
          </div>
        </div>
      </footer>
    </div>
  );
}