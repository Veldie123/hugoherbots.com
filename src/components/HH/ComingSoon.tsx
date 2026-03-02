import { useEffect } from "react";
import { motion } from "framer-motion";
import { Logo } from "./Logo";

interface ComingSoonProps {
  navigate?: (page: string) => void;
}

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap";

export function ComingSoon({ navigate }: ComingSoonProps) {
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_URL;
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div className="relative min-h-screen bg-[#050505] overflow-hidden">
      {/* Vignette — subtle radial darkening at edges */}
      <div
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(5,5,5,0.6) 100%)",
        }}
      />

      {/* Background photo — anchored on Hugo's face */}
      <motion.div
        initial={{ scale: 1.06, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 2.4, ease: [0.25, 0.4, 0.25, 1] }}
        className="absolute inset-0 md:left-[38%]"
      >
        <img
          src="/images/Hugo-Herbots-WEB-0444.JPG"
          alt="Hugo Herbots"
          className="w-full h-full object-cover"
          style={{ objectPosition: "60% 15%" }}
        />
        {/* Left fade — blends photo's black bg into page */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/60 to-transparent md:via-[#050505]/30" />
        {/* Bottom fade — ensures footer readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
        {/* Top fade — subtle */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/40 via-transparent to-transparent" />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.8 }}
          className="p-6 md:p-10 lg:p-12"
        >
          <div
            onClick={() => navigate?.("login")}
            className="cursor-pointer inline-block"
          >
            <Logo variant="horizontal" className="h-7 md:h-8 text-white/80 hover:text-white/95 transition-colors duration-500" />
          </div>
        </motion.header>

        {/* Main content */}
        <div className="flex-1 flex items-end md:items-center pb-28 md:pb-0 px-6 md:px-10 lg:px-16">
          <div className="max-w-lg">
            {/* Tagline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.2 }}
            >
              <span
                className="inline-block text-[10px] md:text-[11px] tracking-[0.4em] uppercase mb-8 md:mb-10 font-light"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  color: "#C9A96E",
                }}
              >
                Sales coaching &middot; Reimagined
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 1.5, ease: [0.25, 0.4, 0.25, 1] }}
              className="text-5xl md:text-6xl lg:text-7xl text-white leading-[1.05] mb-7"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontWeight: 300,
              }}
            >
              Binnenkort
              <br />
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontStyle: "italic",
                  fontWeight: 300,
                  color: "rgba(201, 169, 110, 0.85)",
                }}
              >
                beschikbaar.
              </span>
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.9 }}
              className="text-[15px] md:text-base text-white/40 leading-relaxed mb-10 max-w-sm font-light"
            >
              40 jaar verkoopervaring, gebundeld in een AI-gestuurd
              coaching platform. Hugo Herbots helpt jouw team beter
              verkopen &mdash; digitaal, persoonlijk, en op maat.
            </motion.p>

            {/* Divider line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.6, delay: 2.2, ease: [0.25, 0.4, 0.25, 1] }}
              className="origin-left w-20 h-px mb-10"
              style={{ backgroundColor: "rgba(201, 169, 110, 0.25)" }}
            />

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 2.6 }}
            >
              <a
                href="mailto:info@hugoherbots.com"
                className="group inline-flex items-center gap-3 px-7 py-3.5 border rounded-sm text-[13px] tracking-wider uppercase transition-all duration-700"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontWeight: 400,
                  borderColor: "rgba(201, 169, 110, 0.2)",
                  color: "rgba(255, 255, 255, 0.75)",
                  letterSpacing: "0.15em",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(201, 169, 110, 0.45)";
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.95)";
                  e.currentTarget.style.backgroundColor = "rgba(201, 169, 110, 0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(201, 169, 110, 0.2)";
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.75)";
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span>Neem contact op</span>
                <svg
                  className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-500"
                  style={{ color: "#C9A96E" }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3"
                  />
                </svg>
              </a>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2.8 }}
          className="p-6 md:p-10 lg:p-12 flex items-center justify-between text-[10px] text-white/20 tracking-[0.2em] uppercase"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          <span>&copy; {new Date().getFullYear()} Hugo Herbots</span>
          <span>Belgi&euml;</span>
        </motion.footer>
      </div>
    </div>
  );
}
