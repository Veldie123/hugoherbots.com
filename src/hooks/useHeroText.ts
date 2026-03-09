import { useState, useEffect } from "react";
import { apiFetch } from "@/services/apiFetch";

interface HeroText {
  badge: string;
  title: string;
  subtitle: string;
}

export function useHeroText(
  module: string,
  defaults: HeroText
): { heroText: HeroText; isAiLoaded: boolean } {
  const [heroText, setHeroText] = useState<HeroText>(defaults);
  const [isAiLoaded, setIsAiLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchHeroText() {
      try {
        const res = await apiFetch(`/api/hero-text?modules=${module}`);
        if (!res.ok) return;
        const data = await res.json();
        const result = data[module];
        if (result && result.badge && result.title && result.subtitle && !cancelled) {
          setHeroText({
            badge: result.badge,
            title: result.title,
            subtitle: result.subtitle,
          });
          setIsAiLoaded(true);
        }
      } catch {
        // Silent fail — keep defaults
      }
    }

    fetchHeroText();
    return () => {
      cancelled = true;
    };
  }, [module]);

  return { heroText, isAiLoaded };
}
