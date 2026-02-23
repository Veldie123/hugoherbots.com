import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

type Page = "preview" | "signup" | "dashboard";

interface StickyBottomCTAProps {
  navigate?: (page: Page) => void;
  heroButtonId?: string; // ID of the hero button to track
}

export function StickyBottomCTA({ navigate, heroButtonId = "hero-cta" }: StickyBottomCTAProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const heroButton = document.getElementById(heroButtonId);
    if (!heroButton) {
      // If no hero button found, always show sticky CTA
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky CTA when hero button is NOT visible
        setIsVisible(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: "0px",
      }
    );

    observer.observe(heroButton);

    return () => {
      observer.disconnect();
    };
  }, [heroButtonId]);

  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const checkMenu = () => {
      const menuOverlay = document.querySelector('[data-mobile-menu]');
      setMenuOpen(!!menuOverlay);
    };
    checkMenu();
    const observer = new MutationObserver(checkMenu);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!isVisible || menuOpen) return null;

  return (
    <div className="md:hidden fixed bottom-4 left-4 right-4 z-50">
      <Button
        size="lg"
        className="w-full gap-2 h-14 text-[16px] font-[600] shadow-lg"
        onClick={() => navigate?.("preview")}
      >
        Train met Hugo <ArrowRight className="w-5 h-5" />
      </Button>
    </div>
  );
}