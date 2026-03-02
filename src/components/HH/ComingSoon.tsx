import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Logo } from "./Logo";

interface ComingSoonProps {
  navigate?: (page: string) => void;
}

export function ComingSoon({ navigate }: ComingSoonProps) {
  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Hugo photo — full body, right side, black bg blends with page */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.8, ease: [0.25, 0.4, 0.25, 1] }}
        className="absolute inset-0"
      >
        <img
          src="/images/Hugo-Herbots-WEB-0444.JPG"
          alt="Hugo Herbots"
          className="absolute right-0 top-0 h-full object-contain object-right"
        />
      </motion.div>

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
            <Logo variant="horizontal" className="h-8 text-white/90" />
          </div>
        </motion.header>

        {/* Main content — left side */}
        <div className="flex-1 flex items-end md:items-center pb-32 md:pb-0 px-6 md:px-10 lg:px-16">
          <div className="max-w-xl">
            {/* Tagline */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <span className="inline-block text-[11px] md:text-[13px] tracking-[0.3em] uppercase text-white/40 mb-6 font-light">
                Sales coaching &middot; Reimagined
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
              className="text-[44px] leading-[1.02] sm:text-[62px] lg:text-[80px] text-white tracking-tight font-light mb-6"
            >
              Binnenkort
              <br />
              beschikbaar.
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
              className="text-[16px] md:text-[18px] leading-[1.6] text-white/70 mb-10 max-w-md font-light"
            >
              40 jaar verkoopervaring, gebundeld in een AI-gestuurd
              coaching platform. Hugo Herbots helpt jouw team beter
              verkopen &mdash; digitaal, persoonlijk, en op maat.
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 1.1, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <a
                href="mailto:info@hugoherbots.com"
                className="inline-flex items-center justify-center gap-2 px-6 h-[48px] text-[16px] font-normal bg-white text-[#0a0a0a] rounded-2xl transition-all duration-200 hover:bg-white/90"
                style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}
              >
                Neem contact op <ArrowRight className="w-5 h-5" />
              </a>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 1.4 }}
          className="p-6 md:p-10 flex items-center justify-between text-[12px] text-white/25 tracking-wider uppercase"
        >
          <span>&copy; {new Date().getFullYear()} Hugo Herbots</span>
          <span>Belgi&euml;</span>
        </motion.footer>
      </div>
    </div>
  );
}
