import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Logo } from "./Logo";

interface ComingSoonProps {
  navigate?: (page: string) => void;
}

export function ComingSoon({ navigate }: ComingSoonProps) {
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: "var(--hh-ink)", color: "var(--hh-bg)" }}
    >
      {/* Hugo photo — full body, right side */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.8, ease: [0.25, 0.4, 0.25, 1] }}
        className="absolute inset-0"
      >
        <img
          src="/images/Hugo-Herbots-WEB-0444.JPG"
          alt="Hugo Herbots"
          className="absolute right-0 top-0 h-full w-auto object-contain object-right"
          style={{ mixBlendMode: "lighten" }}
        />
      </motion.div>

      {/* Mobile: dark gradient from bottom so text is readable over photo */}
      <div
        className="md:hidden absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, var(--hh-ink) 0%, color-mix(in srgb, var(--hh-ink) 90%, transparent) 30%, color-mix(in srgb, var(--hh-ink) 50%, transparent) 55%, transparent 75%)",
          zIndex: 5,
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
          className="p-6 md:p-10"
        >
          <div
            onClick={() => navigate?.("login")}
            className="cursor-pointer inline-block"
          >
            <Logo
              variant="horizontal"
              className="h-8"
              style={{ color: "color-mix(in srgb, var(--hh-bg) 90%, transparent)" }}
            />
          </div>
        </motion.header>

        {/* Main content — left side */}
        <div className="flex-1 flex items-end md:items-center pb-32 md:pb-0 px-6 md:px-10 lg:px-16">
          <div style={{ maxWidth: "540px" }}>
            {/* Tagline */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.5,
                ease: [0.25, 0.4, 0.25, 1],
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  fontSize: "13px",
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--hh-bg) 45%, transparent)",
                  marginBottom: "24px",
                  fontWeight: 300,
                }}
              >
                Sales coaching &middot; Reimagined
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.7,
                ease: [0.25, 0.4, 0.25, 1],
              }}
              style={{
                fontSize: "clamp(44px, 8vw, 80px)",
                lineHeight: 1.02,
                color: "var(--hh-bg)",
                letterSpacing: "-0.02em",
                fontWeight: 300,
                marginBottom: "24px",
              }}
            >
              Binnenkort
              <br />
              beschikbaar.
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.9,
                ease: [0.25, 0.4, 0.25, 1],
              }}
              style={{
                fontSize: "17px",
                lineHeight: 1.65,
                color: "color-mix(in srgb, var(--hh-bg) 70%, transparent)",
                marginBottom: "40px",
                maxWidth: "420px",
                fontWeight: 300,
              }}
            >
              Meer dan 40 jaar verkooptraining ervaring, gebundeld
              in een door AI ondersteund coaching platform. Hugo Herbots
              helpt jouw team beter verkopen &mdash; digitaal,
              persoonlijk, en op maat.
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 1.1,
                ease: [0.25, 0.4, 0.25, 1],
              }}
            >
              <a
                href="mailto:hugo@hugoherbots.com"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "0 24px",
                  height: "48px",
                  fontSize: "16px",
                  fontWeight: 400,
                  backgroundColor: "var(--hh-bg)",
                  color: "var(--hh-text)",
                  borderRadius: "16px",
                  textDecoration: "none",
                  boxShadow: "0 8px 24px color-mix(in srgb, var(--hh-ink) 30%, transparent)",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.opacity = "0.88")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.opacity = "1")
                }
              >
                Neem contact op <ArrowRight size={20} />
              </a>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 1.4 }}
          className="p-6 md:p-10 flex items-center justify-between"
          style={{
            fontSize: "12px",
            color: "color-mix(in srgb, var(--hh-bg) 30%, transparent)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          <span>&copy; {new Date().getFullYear()} Hugo Herbots</span>
          <span>Belgi&euml;</span>
        </motion.footer>
      </div>
    </div>
  );
}
