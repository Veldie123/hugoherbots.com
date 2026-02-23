import { useState, useEffect } from "react";
import { Logo } from "./Logo";
import { Menu, X } from "lucide-react";

type Page = "landing" | "pricing" | "about" | "login" | "signup" | "preview" | "onboarding" | "dashboard" | "roleplay" | "library" | "builder" | "sessions" | "analytics" | "settings" | "admin-dashboard";

interface StickyHeaderProps {
  currentPage?: Page;
  navigate: (page: Page) => void;
}

export function StickyHeader({ currentPage = "landing", navigate }: StickyHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { label: "Pricing", page: "pricing" as Page },
  ];

  const mobileNavItems = [
    { label: "Prijzen", page: "pricing" as Page },
    { label: "Probeer de app", page: "preview" as Page },
  ];

  const handleLandingNavigation = (sectionId: string) => {
    setMobileMenuOpen(false);
    
    if (currentPage === "landing") {
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start'
          });
          setTimeout(() => {
            window.scrollBy({ top: -100, behavior: 'smooth' });
          }, 100);
        }
      }, 100);
    } else {
      navigate("landing");
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start'
          });
          setTimeout(() => {
            window.scrollBy({ top: -100, behavior: 'smooth' });
          }, 100);
        }
      }, 500);
    }
  };

  const landingAnchors = [
    { label: "Zo werkt het", id: "zo-werkt-het" },
    { label: "E.P.I.C. Methode", id: "epic-methode" },
    { label: "Over Hugo", id: "over-hugo" },
    { label: "Testimonials", id: "testimonials" },
    { label: "FAQ", id: "faq" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-shadow duration-300 bg-white border-b border-hh-border ${
        scrolled
          ? "shadow-hh-md"
          : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 sm:h-24">
          {/* Logo */}
          <button
            onClick={() => navigate("landing")}
            className="flex-shrink-0 hover:opacity-80 transition-opacity"
            aria-label="Terug naar home"
          >
            <Logo variant="horizontal" className="text-[16px] sm:text-[18px]" />
          </button>

          {/* Right Side - CTA's + Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {/* Desktop Navigation Links */}
            <nav className="flex items-center gap-6">
              {navItems.map((item) => (
                <button
                  key={item.page}
                  onClick={() => navigate(item.page)}
                  className={`text-[16px] leading-[24px] font-[400] transition-colors ${
                    currentPage === item.page
                      ? "text-hh-ink underline decoration-2 underline-offset-4"
                      : "text-hh-text hover:text-hh-ink"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("login")}
                className="px-6 h-[48px] text-[16px] leading-[24px] font-[400] text-hh-ink border-2 border-hh-border rounded-2xl hover:bg-hh-ui-50 transition-colors"
              >
                Inloggen
              </button>
              <button
                onClick={() => navigate("preview")}
                className="px-6 h-[48px] text-[16px] leading-[24px] font-[400] bg-hh-ink text-hh-bg rounded-2xl hover:bg-hh-ui-700 transition-colors shadow-hh-md"
              >
                Train met Hugo
              </button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-hh-ink hover:text-hh-primary transition-colors"
            aria-label={mobileMenuOpen ? "Sluit menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu - Full width */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-20 sm:top-24 bg-white z-50 overflow-auto" data-mobile-menu>
            <div className="flex flex-col h-full">
              {/* Navigation Items */}
              <nav className="flex flex-col p-6 space-y-1">
                {/* Page Navigation Items */}
                {mobileNavItems.map((item) => (
                  <button
                    key={item.page}
                    onClick={() => {
                      navigate(item.page);
                      setMobileMenuOpen(false);
                    }}
                    className={`px-4 py-4 text-left text-[18px] leading-[26px] font-[500] rounded-lg transition-colors ${
                      currentPage === item.page
                        ? "text-hh-primary bg-hh-primary/5"
                        : "text-hh-ink hover:text-hh-primary hover:bg-hh-ui-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                
              </nav>

              {/* Bottom Section - Login + CTA */}
              <div className="mt-auto p-6 border-t border-hh-border space-y-3">
                {/* Login Button (conditional) */}
                {currentPage !== "login" && (
                  <button
                    onClick={() => {
                      navigate("login");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full px-6 py-3 text-[16px] leading-[24px] font-[400] text-hh-ink border-2 border-hh-border rounded-2xl hover:bg-hh-ui-50 transition-colors"
                  >
                    Inloggen
                  </button>
                )}
                
                {/* CTA Button */}
                <button
                  onClick={() => {
                    navigate("preview");
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-6 py-4 bg-hh-ink text-white rounded-2xl hover:bg-hh-ink/90 transition-all shadow-hh-md text-[16px] leading-[24px] font-[600]"
                >
                  Train met Hugo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
