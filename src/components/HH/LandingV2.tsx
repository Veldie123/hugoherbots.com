/**
 * LANDING V2 — HugoHerbots.ai
 * Product-led approach: show the actual app UI as marketing visuals.
 * Built alongside Landing.tsx. Replaces it once approved.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, Play, BarChart2, MessageSquare, Video, Users } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Switch } from "../ui/switch";
import { StickyHeader } from "./StickyHeader";
import { StickyBottomCTA } from "./StickyBottomCTA";
import { PricingTier } from "./PricingTier";
import { AnalysisPreview } from "./landing/AnalysisPreview";
import { DashboardPreview } from "./landing/DashboardPreview";
import { RoleplayPreview } from "./landing/RoleplayPreview";
import { LiveBadge } from "./landing/LiveBadge";

type Page = "landing" | "pricing" | "about" | "login" | "signup" | "preview" | "onboarding" | "dashboard" | "roleplay" | "library" | "builder" | "sessions" | "analytics" | "settings" | "admin-dashboard";

interface LandingV2Props {
  navigate?: (page: Page) => void;
}

// Shared animation wrapper — triggers once when section enters viewport
function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0 }}
      transition={{ duration: 0.65, delay, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ─── Section label chip ───────────────────────────────────────────────────────
function SectionLabel({ icon: Icon, label, dark = false }: { icon: React.ElementType; label: string; dark?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border mb-5 ${
      dark
        ? "bg-white/5 border-white/10 text-white/70"
        : "bg-hh-primary/8 border-hh-primary/15 text-hh-primary"
    }`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
  );
}

// ─── SECTION 1: HERO ─────────────────────────────────────────────────────────
function HeroSection({ navigate }: { navigate: (page: Page) => void }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "#0B1220", minHeight: "100vh" }}
    >
      {/* Subtle radial glow behind product preview */}
      <div
        className="absolute right-0 top-0 w-[60%] h-full pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 80% 40%, color-mix(in srgb, var(--hh-primary) 12%, transparent) 0%, transparent 60%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left — Copy */}
          <div>
            <FadeIn delay={0}>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border mb-7 bg-hh-primary/12 border-hh-primary/25"
                style={{ color: "var(--hh-primary-light)" }}>
                20.000+ verkopers getraind · 40 jaar ervaring
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <h1
                className="font-light tracking-tight text-white mb-6"
                style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", lineHeight: 1.05 }}
              >
                40 jaar sales trainer,<br />
                <span className="font-semibold">nu jouw persoonlijke coach</span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.2}>
              <p className="text-lg text-white/50 font-light mb-8 max-w-md leading-relaxed italic">
                "Want de laatste geboren verkoper is gisteren gestorven..."
              </p>
            </FadeIn>

            <FadeIn delay={0.3}>
              <div className="flex flex-wrap gap-3">
                <button
                  id="hero-cta"
                  onClick={() => navigate("preview")}
                  className="inline-flex items-center gap-2.5 px-6 h-12 rounded-2xl text-base font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.02] bg-hh-primary"
                  style={{
                    boxShadow: "0 8px 24px rgba(var(--hh-primary-rgb),0.35)",
                  }}
                >
                  Train met Hugo
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    document.getElementById("zo-werkt-het")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-2 px-6 h-12 rounded-2xl text-base font-medium text-white/60 border border-white/10 transition-all hover:border-white/20 hover:text-white/80"
                >
                  Bekijk hoe het werkt
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </FadeIn>
          </div>

          {/* Right — Product preview */}
          <FadeIn delay={0.35} className="hidden lg:block">
            <DashboardPreview />
          </FadeIn>

        </div>
      </div>
    </section>
  );
}

// ─── SECTION 2: SOCIAL PROOF BAR ─────────────────────────────────────────────
function SocialProofBar() {
  const stats = [
    { value: "20.000+", label: "verkopers getraind" },
    { value: "500+", label: "bedrijven" },
    { value: "40 jaar", label: "ervaring" },
    { value: "54", label: "technieken" },
    { value: "4", label: "E.P.I.C. fasen" },
  ];

  return (
    <section className="bg-hh-bg border-y border-hh-border py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center gap-8 lg:gap-0 lg:grid lg:grid-cols-5">
          {stats.map((stat, i) => (
            <FadeIn key={stat.value} delay={i * 0.06}>
              <div className="text-center lg:border-r lg:last:border-r-0 border-hh-border lg:px-8">
                <p className="text-2xl font-bold text-hh-text">{stat.value}</p>
                <p className="text-sm text-hh-muted mt-0.5">{stat.label}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION 3: GESPREKSANALYSE ──────────────────────────────────────────────
function AnalyseSection({ navigate }: { navigate: (page: Page) => void }) {
  return (
    <section
      className="py-20 sm:py-32"
      style={{ background: "#0B1220" }}
      id="gespreksanalyse"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left — Copy */}
          <div>
            <FadeIn>
              <SectionLabel icon={BarChart2} label="Gespreksanalyse" dark />
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2
                className="text-white font-light tracking-tight mb-6"
                style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", lineHeight: 1.1 }}
              >
                Weet exact wat je goed doet.<br />
                <span className="font-semibold">En wat niet.</span>
              </h2>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="text-white/50 text-lg leading-relaxed mb-8">
                Laad een verkoopgesprek op. Binnen minuten weet je welke E.P.I.C. fase je mist, welke technieken je al beheerst en waar je punten verliest.
              </p>
            </FadeIn>
            <FadeIn delay={0.25}>
              <ul className="space-y-3 mb-8">
                {[
                  "Score per E.P.I.C. fase (0–100)",
                  "Techniek-herkenning uit 54 mogelijkheden",
                  "Verbeterpunten met concrete tips",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/60">
                    <div className="w-1.5 h-1.5 rounded-full bg-hh-primary flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </FadeIn>
            <FadeIn delay={0.3}>
              <button
                onClick={() => navigate("preview")}
                className="inline-flex items-center gap-2 px-5 h-11 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 bg-hh-primary"
              >
                Probeer gratis
                <ArrowRight className="w-4 h-4" />
              </button>
            </FadeIn>
          </div>

          {/* Right — AnalysisPreview */}
          <FadeIn delay={0.15}>
            <AnalysisPreview />
          </FadeIn>

        </div>
      </div>
    </section>
  );
}

// ─── SECTION 4: AI ROLEPLAY ──────────────────────────────────────────────────
function RoleplaySection({ navigate }: { navigate: (page: Page) => void }) {
  return (
    <section className="bg-hh-bg py-20 sm:py-32" id="ai-roleplay">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left — RoleplayPreview */}
          <FadeIn delay={0.1} className="order-2 lg:order-1">
            <RoleplayPreview />
          </FadeIn>

          {/* Right — Copy */}
          <div className="order-1 lg:order-2">
            <FadeIn>
              <SectionLabel icon={MessageSquare} label="AI Roleplay" />
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2
                className="text-hh-text font-light tracking-tight mb-6"
                style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", lineHeight: 1.1 }}
              >
                Oefen elk gesprek.<br />
                <span className="font-semibold">Zo vaak je wil.</span>
              </h2>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="text-hh-muted text-lg leading-relaxed mb-8">
                Hugo stelt vragen zoals hij dat live zou doen. Je krijgt directe feedback per techniek. Geen groep, geen oordeel — alleen jij en Hugo.
              </p>
            </FadeIn>
            <FadeIn delay={0.25}>
              <ul className="space-y-3 mb-8">
                {[
                  "Onbeperkte simulaties, 24/7",
                  "Directe feedback op elke techniek",
                  "Chat, bellen of video-call",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-hh-muted">
                    <div className="w-1.5 h-1.5 rounded-full bg-hh-primary flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </FadeIn>
            <FadeIn delay={0.3}>
              <button
                onClick={() => navigate("preview")}
                className="inline-flex items-center gap-2 px-5 h-11 rounded-xl text-sm font-semibold text-white bg-hh-primary transition-all hover:opacity-90"
              >
                Start een gesprek
                <ArrowRight className="w-4 h-4" />
              </button>
            </FadeIn>
          </div>

        </div>
      </div>
    </section>
  );
}

// ─── SECTION 5: LIVE COACHING ────────────────────────────────────────────────
function LiveSection({ navigate }: { navigate: (page: Page) => void }) {
  return (
    <section
      className="py-20 sm:py-32"
      style={{ background: "#0B1220" }}
      id="live-coaching"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left — Copy */}
          <div>
            <FadeIn>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border mb-5 bg-hh-error/10 border-hh-error/25 text-hh-error">
                <motion.div
                  className="w-2 h-2 rounded-full bg-hh-error"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
                Live Coaching
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2
                className="text-white font-light tracking-tight mb-6"
                style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", lineHeight: 1.1 }}
              >
                Elke ochtend. Live.<br />
                <span className="font-semibold">Direct vragen stellen.</span>
              </h2>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="text-white/50 text-lg leading-relaxed mb-8">
                Hugo geeft elke werkdag een live sessie van 60 minuten. Stel vragen, werk aan een echte casus, of kijk later terug op je eigen tempo.
              </p>
            </FadeIn>
            <FadeIn delay={0.25}>
              <ul className="space-y-3 mb-8">
                {[
                  "Elke werkdag, 60 min — maandag t/m vrijdag",
                  "Live Q&A en casusbesprekingen",
                  "Onmiddellijk herbekijken na de sessie",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/60">
                    <div className="w-1.5 h-1.5 rounded-full bg-hh-error/70 flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </FadeIn>
            <FadeIn delay={0.3}>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate("preview")}
                  className="inline-flex items-center gap-2 px-5 h-11 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 bg-hh-primary"
                >
                  Bekijk Live
                  <ArrowRight className="w-4 h-4" />
                </button>
                <span className="text-xs text-white/30 italic">Max 100 Founder leden</span>
              </div>
            </FadeIn>
          </div>

          {/* Right — LiveBadge */}
          <FadeIn delay={0.2}>
            <LiveBadge />
          </FadeIn>

        </div>
      </div>
    </section>
  );
}

// ─── SECTION 6: VIDEO CURSUS ─────────────────────────────────────────────────
function VideoCursusSection({ navigate }: { navigate: (page: Page) => void }) {
  return (
    <section className="bg-hh-ui-50 py-20 sm:py-32" id="video-cursus">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left — Copy */}
          <div>
            <FadeIn>
              <SectionLabel icon={Video} label="Video Cursus" />
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2
                className="text-hh-text font-light tracking-tight mb-6"
                style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", lineHeight: 1.1 }}
              >
                40 jaar kennis.<br />
                <span className="font-semibold">Op jouw tempo.</span>
              </h2>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="text-hh-muted text-lg leading-relaxed mb-8">
                54 technieken verdeeld over 4 E.P.I.C. fasen. Elk uitgelegd door Hugo — met concrete voorbeelden uit 40 jaar praktijk.
              </p>
            </FadeIn>
            <FadeIn delay={0.25}>
              <ul className="space-y-3 mb-8">
                {[
                  "Gestructureerd per fase en techniek",
                  "Voortgang bijhouden per video",
                  "Beschikbaar op elk apparaat",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-hh-muted">
                    <div className="w-1.5 h-1.5 rounded-full bg-hh-primary flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </FadeIn>
            <FadeIn delay={0.3}>
              <button
                onClick={() => navigate("preview")}
                className="inline-flex items-center gap-2 px-5 h-11 rounded-xl text-sm font-semibold text-white bg-hh-primary transition-all hover:opacity-90"
              >
                Bekijk cursus
                <ArrowRight className="w-4 h-4" />
              </button>
            </FadeIn>
          </div>

          {/* Right — Video library mockup */}
          <FadeIn delay={0.2}>
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(15,24,38,0.95)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
              }}
            >
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-hh-error/70" />
                  <div className="w-3 h-3 rounded-full bg-hh-warning/70" />
                  <div className="w-3 h-3 rounded-full bg-hh-success/70" />
                </div>
                <span className="text-xs text-white/40 ml-2">Video Cursus</span>
              </div>
              <div className="p-4">
                {/* Phase tabs */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                  {["E", "P", "I", "C"].map((letter, i) => (
                    <div
                      key={letter}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        i === 0
                          ? "bg-hh-primary text-white"
                          : "text-white/40 hover:text-white/60"
                      }`}
                      style={{ background: i === 0 ? "var(--hh-primary)" : "rgba(255,255,255,0.05)" }}
                    >
                      Fase {i + 1} — {["Openingsfase", "Ontdekkingsfase", "Aanbevelingsfase", "Beslissingsfase"][i]}
                    </div>
                  ))}
                </div>
                {/* Video cards */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { title: "Koopklimaat", duration: "8:32", progress: 100 },
                    { title: "Gentleman's agreement", duration: "6:45", progress: 75 },
                    { title: "Firmavoorstelling", duration: "12:10", progress: 30 },
                    { title: "Instapvraag", duration: "9:20", progress: 0 },
                  ].map((video, i) => (
                    <motion.div
                      key={video.title}
                      className="rounded-xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0 }}
                      transition={{ delay: i * 0.07, duration: 0.4 }}
                    >
                      <div
                        className="h-20 flex items-center justify-center relative"
                        style={{ background: `linear-gradient(135deg, color-mix(in srgb, var(--hh-primary) 25%, transparent), #0b121080)` }}
                      >
                        <Play className="w-6 h-6 text-white/70" />
                        {video.progress === 100 && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-hh-success flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="px-2 py-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <p className="text-[11px] text-white/80 font-medium truncate">{video.title}</p>
                        <p className="text-[10px] text-white/30">{video.duration}</p>
                        {video.progress > 0 && video.progress < 100 && (
                          <div className="mt-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-hh-success" style={{ width: `${video.progress}%` }} />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>

        </div>
      </div>
    </section>
  );
}

// ─── SECTION 7: E.P.I.C. METHODE ────────────────────────────────────────────
function EpicSection() {
  const phases = [
    {
      num: 1,
      letter: "E",
      title: "Openingsfase",
      desc: "Creëer het juiste koopklimaat. Stel de perfecte instapvraag.",
      techniques: ["Koopklimaat", "Gentleman's agreement", "Instapvraag"],
      color: "var(--hh-primary)",
    },
    {
      num: 2,
      letter: "P",
      title: "Ontdekkingsfase",
      desc: "Stel de juiste vragen. Luister actief. Graaf dieper met LEAD.",
      techniques: ["Open vragen", "Actief luisteren", "LEAD questioning"],
      color: "var(--hh-secondary)",
    },
    {
      num: 3,
      letter: "I",
      title: "Aanbevelingsfase",
      desc: "Toon empathie. Presenteer oplossing, voordeel en baat.",
      techniques: ["Empathie", "Oplossing → voordeel → baat", "Mening vragen"],
      color: "var(--hh-warning)",
    },
    {
      num: 4,
      letter: "C",
      title: "Beslissingsfase",
      desc: "Sluit af met vertrouwen. Omarm bezwaren en twijfels.",
      techniques: ["Proefafsluiting", "Bezwaren behandelen", "Twijfels omarmen"],
      color: "var(--hh-success)",
    },
  ];

  return (
    <section className="bg-hh-bg py-20 sm:py-32" id="epic-methode">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-12 sm:mb-16 max-w-2xl mx-auto">
          <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 mb-5 text-sm px-4 py-1">
            E.P.I.C. Methode
          </Badge>
          <h2
            className="text-hh-text font-light tracking-tight mb-4"
            style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", lineHeight: 1.15 }}
          >
            Mijn methode: <span className="font-semibold">4 fasen, 54 technieken</span>
          </h2>
          <p className="text-hh-muted text-lg">
            Elk verkoopgesprek volgt dezelfde structuur. Elk gesprek is een kans om beter te worden.
          </p>
        </FadeIn>

        {/* Stepper */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
          {phases.map((phase, i) => (
            <FadeIn key={phase.num} delay={i * 0.1}>
              <div className="relative p-6 lg:p-8 border-r-0 md:odd:border-r md:even:border-r-0 lg:border-r lg:last:border-r-0 border-b lg:border-b-0 border-hh-border">
                {/* Large decorative number */}
                <div
                  className="absolute right-4 top-4 text-8xl font-black leading-none select-none pointer-events-none"
                  style={{ color: phase.color, opacity: 0.06 }}
                >
                  {phase.num}
                </div>

                {/* Phase letter badge */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg mb-4"
                  style={{ background: phase.color }}
                >
                  {phase.letter}
                </div>

                <h3 className="text-base font-semibold text-hh-text mb-2">{phase.title}</h3>
                <p className="text-sm text-hh-muted leading-relaxed mb-4">{phase.desc}</p>

                <div className="flex flex-wrap gap-1.5">
                  {phase.techniques.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded-full border"
                      style={{
                        color: phase.color,
                        borderColor: `${phase.color}30`,
                        background: `${phase.color}08`,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>

                {/* Connector arrow (desktop only) */}
                {i < 3 && (
                  <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-hh-bg border border-hh-border items-center justify-center">
                    <ArrowRight className="w-3 h-3 text-hh-muted" />
                  </div>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION 8: TESTIMONIALS / SOCIAL PROOF ──────────────────────────────────
// Placeholder until real testimonials are available from Hugo.
// Replace the `testimonials` array when real content is provided.
const testimonials: Array<{
  quote: string;
  name: string;
  role: string;
  company: string;
  avatarUrl?: string;
  metric: string;
  metricLabel: string;
}> = [
  // TODO: Hugo to provide real testimonials with: quote, name, role, company, photo URL, metric
];

function TestimonialsSection() {
  if (testimonials.length === 0) {
    // Fallback: large stats display
    return (
      <section className="bg-hh-ui-50 py-20 sm:py-28" id="testimonials">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <p className="text-xs font-semibold uppercase tracking-widest text-hh-muted mb-10">
              Bewezen resultaten
            </p>
          </FadeIn>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {[
              { value: "20.000+", label: "verkopers persoonlijk getraind" },
              { value: "500+", label: "bedrijven in 40 jaar" },
              { value: "54", label: "bewezen verkooptechnieken" },
              { value: "40 jaar", label: "actieve ervaring in het veld" },
            ].map((stat, i) => (
              <FadeIn key={stat.value} delay={i * 0.08}>
                <div className="text-center">
                  <p
                    className="font-bold text-hh-text mb-1"
                    style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)" }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-sm text-hh-muted leading-snug">{stat.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-hh-ui-50 py-20 sm:py-32" id="testimonials">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-12">
          <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 mb-4">
            Klanten aan het woord
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-light text-hh-text">
            Resultaten van teams die ik gecoacht heb
          </h2>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <Card className="p-6 rounded-2xl border-hh-border shadow-hh-md hover:shadow-hh-lg transition-shadow">
                <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 mb-4 text-xs">
                  {t.metric} {t.metricLabel}
                </Badge>
                <p className="text-hh-text italic text-sm leading-relaxed mb-5">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  {t.avatarUrl ? (
                    <img
                      src={t.avatarUrl}
                      alt={t.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center text-hh-primary text-sm font-semibold flex-shrink-0">
                      {t.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-hh-text">{t.name}</p>
                    <p className="text-xs text-hh-muted">{t.role} · {t.company}</p>
                  </div>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION 9: PRICING ──────────────────────────────────────────────────────
function PricingSection({ navigate }: { navigate: (page: Page) => void }) {
  const [isYearly, setIsYearly] = useState(true);

  return (
    <section className="bg-hh-bg py-20 sm:py-32" id="prijzen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-10 max-w-2xl mx-auto">
          <Badge className="bg-hh-warn/10 text-hh-warn border-hh-warn/20 mb-5 text-sm px-4 py-1">
            Kies je plan
          </Badge>
          <h2
            className="text-hh-text font-light tracking-tight mb-4"
            style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", lineHeight: 1.15 }}
          >
            1-op-1 coaching met Hugo —{" "}
            <span className="font-semibold">vroeger €1.500/halve dag</span>
          </h2>
          <p className="text-hh-muted text-lg">
            Nu elke dag, op jouw tempo, met live begeleiding. Vanaf €{isYearly ? "29" : "49"}/maand.
          </p>
        </FadeIn>

        {/* Toggle */}
        <FadeIn delay={0.1}>
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className={`text-sm ${!isYearly ? "text-hh-text font-medium" : "text-hh-muted"}`}>Maandelijks</span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-hh-primary"
            />
            <span className={`text-sm ${isYearly ? "text-hh-text font-medium" : "text-hh-muted"}`}>Jaarlijks</span>
            {isYearly && (
              <Badge className="bg-hh-warn/10 text-hh-warn border-hh-warn/20 text-xs ml-1">Bespaar 40%</Badge>
            )}
          </div>
        </FadeIn>

        {/* Pricing grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <FadeIn delay={0}>
            <PricingTier
              name="Pro"
              price={isYearly ? "€49" : "€98"}
              period="/maand"
              priceNote={isYearly ? "Gefactureerd jaarlijks" : undefined}
              features={[
                "AI-avatar simulaties (onbeperkt)",
                "Persoonlijk dashboard & feedback",
                "Gespreksanalyse (5/maand)",
                "Email support",
              ]}
              cta="Train met Hugo"
              onCtaClick={() => navigate("preview")}
            />
          </FadeIn>
          <FadeIn delay={0.1}>
            <PricingTier
              name="Founder"
              price={isYearly ? "€249" : "€498"}
              period="/maand"
              priceNote={isYearly ? "Gefactureerd jaarlijks" : undefined}
              subtitleNote="Beperkt tot 100 leden"
              features={[
                "Alles van Pro",
                "Dagelijkse live sessies (ma-vr)",
                "Video series (54 technieken)",
                "Onbeperkte gespreksanalyse",
                "Priority support",
                "Founder community",
              ]}
              cta="Word Founder"
              highlighted
              badge="Meest gekozen"
              onCtaClick={() => navigate("preview")}
            />
          </FadeIn>
          <FadeIn delay={0.2}>
            <PricingTier
              name="Inner Circle"
              price={isYearly ? "€1.249" : "€2.498"}
              period="/maand"
              priceNote={isYearly ? "Gefactureerd jaarlijks" : undefined}
              subtitleNote="Exclusief — max 20 leden"
              features={[
                "Alles van Founder",
                "1-op-1 sessies met Hugo",
                "Maandelijkse review gesprekken",
                "Persoonlijk actieplan",
                "WhatsApp toegang Hugo",
                "Vroeger €1.500/halve dag",
              ]}
              cta="Join Inner Circle"
              premium
              badge="Exclusief"
              onCtaClick={() => navigate("preview")}
            />
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

// ─── SECTION 10: FOOTER CTA ───────────────────────────────────────────────────
function FooterCTASection({ navigate }: { navigate: (page: Page) => void }) {
  return (
    <section className="py-24 sm:py-32" style={{ background: "#0B1220" }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <FadeIn>
          <p className="text-white/40 text-sm uppercase tracking-widest font-medium mb-6">
            Klaar om te starten?
          </p>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2
            className="text-white font-light tracking-tight mb-8"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 1.1 }}
          >
            Train elke dag met Hugo.<br />
            <span className="font-semibold">Vanaf €49/maand.</span>
          </h2>
        </FadeIn>
        <FadeIn delay={0.2}>
          <button
            onClick={() => navigate("preview")}
            className="inline-flex items-center gap-2.5 px-8 h-14 rounded-2xl text-lg font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.02] bg-hh-primary"
            style={{
              boxShadow: "0 12px 32px rgba(var(--hh-primary-rgb),0.4)",
            }}
          >
            Train met Hugo
            <ArrowRight className="w-5 h-5" />
          </button>
        </FadeIn>
        <FadeIn delay={0.3}>
          <p className="text-white/25 text-sm mt-5">
            Geen creditcard vereist · Gratis proberen
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export function LandingV2({ navigate }: LandingV2Props) {
  const handleNavigate = (page: Page) => {
    window.scrollTo(0, 0);
    if (navigate) navigate(page);
  };

  return (
    <div
      className="light"
      data-theme="light"
      style={{ colorScheme: "light" }}
    >
      <StickyHeader currentPage="landing" navigate={handleNavigate} />

      <HeroSection navigate={handleNavigate} />
      <SocialProofBar />
      <AnalyseSection navigate={handleNavigate} />
      <RoleplaySection navigate={handleNavigate} />
      <LiveSection navigate={handleNavigate} />
      <VideoCursusSection navigate={handleNavigate} />
      <EpicSection />
      <TestimonialsSection />
      <PricingSection navigate={handleNavigate} />
      <FooterCTASection navigate={handleNavigate} />

      <StickyBottomCTA navigate={handleNavigate} heroButtonId="hero-cta" />
    </div>
  );
}
