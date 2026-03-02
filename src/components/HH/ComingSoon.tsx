import { motion } from "framer-motion";
import { Logo } from "./Logo";

interface ComingSoonProps {
  navigate?: (page: string) => void;
}

export function ComingSoon({ navigate }: ComingSoonProps) {
  return (
    <div className="relative min-h-screen bg-[#0a0a0a] overflow-hidden">
      {/* Subtle grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Background photo — right side on desktop, full on mobile */}
      <div className="absolute inset-0 md:left-[45%]">
        <img
          src="/images/Hugo-Herbots-WEB-0461.JPG"
          alt="Hugo Herbots"
          className="w-full h-full object-cover object-top"
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent md:via-[#0a0a0a]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-[#0a0a0a]/30" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="p-6 md:p-10"
        >
          <Logo variant="horizontal" className="h-8 text-white/90" />
        </motion.header>

        {/* Main content */}
        <div className="flex-1 flex items-center px-6 md:px-10 lg:px-16">
          <div className="max-w-xl">
            {/* Tagline */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <span
                className="inline-block text-[11px] md:text-xs tracking-[0.35em] uppercase text-amber-200/70 mb-8 font-light"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Sales coaching &middot; Reimagined
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.7 }}
              className="text-4xl md:text-5xl lg:text-6xl font-light text-white leading-[1.1] mb-6"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Binnenkort
              <br />
              <span className="italic text-amber-100/90">beschikbaar.</span>
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="text-base md:text-lg text-white/50 leading-relaxed mb-10 max-w-md font-light"
            >
              40 jaar verkoopervaring, gebundeld in een AI-gestuurd
              coaching platform. Hugo Herbots helpt jouw team beter
              verkopen &mdash; digitaal, persoonlijk, en op maat.
            </motion.p>

            {/* Divider line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.2, delay: 1.1, ease: [0.25, 0.4, 0.25, 1] }}
              className="origin-left w-16 h-px bg-amber-200/30 mb-10"
            />

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <a
                href="mailto:info@hugoherbots.com"
                className="group inline-flex items-center gap-3 px-6 py-3.5 bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] hover:border-white/[0.25] rounded text-sm text-white/90 tracking-wide transition-all duration-500"
              >
                <span className="font-light">Neem contact op</span>
                <svg
                  className="w-4 h-4 text-amber-200/70 group-hover:translate-x-1 transition-transform duration-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                </svg>
              </a>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.6 }}
          className="p-6 md:p-10 flex items-center justify-between text-[11px] text-white/25 tracking-wider uppercase"
        >
          <span>&copy; {new Date().getFullYear()} Hugo Herbots</span>
          <span>Antwerpen, Belgi&euml;</span>
        </motion.footer>
      </div>
    </div>
  );
}
