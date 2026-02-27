import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { PricingTier } from "./PricingTier";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Switch } from "../ui/switch";
import { Logo } from "./Logo";
import { StickyHeader } from "./StickyHeader";
import { BrowserMockup } from "./BrowserMockup";
import { getDailyQuote } from "../../data/hugoQuotes";
import { Check, X, Shield, Lock, Zap, ArrowRight, Loader2 } from "lucide-react";

const roleplayScreenshot = "/images/5e0311347e22c63626fd6f5cd1e39d5971c229ea.png";
const analyticsScreenshot = "/images/7a290f0c53177769ed05ab1ba994d8689b9b2339.png";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

type Page = "landing" | "pricing" | "about" | "login" | "signup" | "preview" | "onboarding" | "dashboard" | "roleplay" | "library" | "builder" | "sessions" | "analytics" | "settings";

interface PricingProps {
  navigate?: (page: Page) => void;
}

interface StripePrice {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
  active: boolean;
  metadata: Record<string, string> | null;
}

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  active: boolean;
  metadata: Record<string, string> | null;
  prices: StripePrice[];
}

type TierKey = "pro" | "founder" | "inner_circle";

function getTierFromProduct(product: StripeProduct): TierKey | null {
  const tier = product.metadata?.tier;
  if (tier === "pro" || tier === "founder" || tier === "inner_circle") return tier;
  const nameLower = product.name.toLowerCase();
  if (nameLower.includes("inner circle")) return "inner_circle";
  if (nameLower.includes("founder")) return "founder";
  if (nameLower.includes("pro")) return "pro";
  return null;
}

function getPriceId(
  priceMap: Record<string, Record<string, string>>,
  tier: TierKey,
  interval: "month" | "year"
): string | null {
  return priceMap[tier]?.[interval] || null;
}

export function Pricing({ navigate }: PricingProps) {
  const [isYearly, setIsYearly] = useState(true);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [priceMap, setPriceMap] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    fetch("/api/stripe/products")
      .then((r) => r.json())
      .then((data) => {
        const products: StripeProduct[] = data.data || [];
        const map: Record<string, Record<string, string>> = {};
        for (const product of products) {
          const tier = getTierFromProduct(product);
          if (!tier) continue;
          map[tier] = {};
          for (const price of product.prices) {
            const interval = price.recurring?.interval;
            if (interval && price.id) {
              map[tier][interval] = price.id;
            }
          }
        }
        setPriceMap(map);
      })
      .catch(() => {});
  }, []);

  const handleCheckout = useCallback(async (tier: TierKey) => {
    const interval = isYearly ? "year" : "month";
    const priceId = getPriceId(priceMap, tier, interval);
    if (!priceId) {
      if (navigate) navigate("signup");
      return;
    }

    setLoadingTier(tier);
    try {
      const resp = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await resp.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      if (navigate) navigate("signup");
    } finally {
      setLoadingTier(null);
    }
  }, [isYearly, priceMap, navigate]);

  const handleNavigate = (page: Page) => {
    if (navigate) navigate(page);
  };

  const plans: Array<{
    name: string;
    tier: TierKey;
    monthlyPrice: string;
    yearlyPrice: string;
    yearlyNote: string;
    subtitleNote?: string;
    features: string[];
    highlighted?: boolean;
    premium?: boolean;
    badge?: string;
    cta: string;
  }> = [
    {
      name: "Pro",
      tier: "pro",
      monthlyPrice: "€98",
      yearlyPrice: "€49",
      yearlyNote: "Gefactureerd jaarlijks",
      features: [
        "AI coaching (onbeperkt)",
        "Video platform (4 fasen, 54 technieken)",
        "Transcript analyse",
        "Persoonlijk dashboard & feedback",
        "Exports & rapportages",
        "Email support",
      ],
      cta: "Start gratis proefperiode",
    },
    {
      name: "Founder",
      tier: "founder",
      monthlyPrice: "€498",
      yearlyPrice: "€249",
      yearlyNote: "Gefactureerd jaarlijks",
      subtitleNote: "Beperkt tot 100 leden",
      features: [
        "Alles van Pro",
        "Live sessies met Hugo",
        "Founder community toegang",
        "Priority support",
      ],
      highlighted: true,
      badge: "Populair",
      cta: "Word Founder",
    },
    {
      name: "Inner Circle",
      tier: "inner_circle",
      monthlyPrice: "€2.498",
      yearlyPrice: "€1.249",
      yearlyNote: "Gefactureerd jaarlijks",
      subtitleNote: "Exclusief — max 20 leden",
      features: [
        "Alles van Founder",
        "1-op-1 coaching met Hugo",
        "Directe lijn met Hugo",
        "Custom scenario's op maat",
      ],
      premium: true,
      badge: "Exclusief — max 20 leden",
      cta: "Aanvraag Inner Circle",
    },
  ];

  const featureComparison = [
    {
      category: "AI Coaching & Video's",
      features: [
        { name: "AI coaching", pro: "Onbeperkt", founder: "Onbeperkt", innerCircle: "Onbeperkt" },
        { name: "Video platform (4 fasen, 54 technieken)", pro: true, founder: true, innerCircle: true },
        { name: "Transcript analyse", pro: true, founder: true, innerCircle: true },
        { name: "Persoonlijk dashboard & feedback", pro: true, founder: true, innerCircle: true },
        { name: "Exports & rapportages", pro: true, founder: true, innerCircle: true },
      ],
    },
    {
      category: "Live Sessies & Community",
      features: [
        { name: "Live sessies met Hugo", pro: false, founder: true, innerCircle: true },
        { name: "Founder community toegang", pro: false, founder: true, innerCircle: true },
      ],
    },
    {
      category: "Exclusieve Coaching",
      features: [
        { name: "1-op-1 coaching met Hugo", pro: false, founder: false, innerCircle: true },
        { name: "Directe lijn met Hugo", pro: false, founder: false, innerCircle: true },
        { name: "Custom scenario's op maat", pro: false, founder: false, innerCircle: true },
      ],
    },
    {
      category: "Support",
      features: [
        { name: "Email support", pro: true, founder: true, innerCircle: true },
        { name: "Priority support", pro: false, founder: true, innerCircle: true },
      ],
    },
  ];

  return (
    <div className="bg-hh-bg min-h-screen" data-theme="light">
      <StickyHeader currentPage="pricing" navigate={handleNavigate} />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-12 sm:pb-16 text-center">
        <h1 className="mb-4 text-[28px] leading-[36px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px] px-4">
          Vroeger: €2.000 per halve dag. Nu: vanaf €49/maand onbeperkt.
        </h1>
        <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] lg:text-[18px] lg:leading-[26px] text-hh-muted max-w-2xl mx-auto mb-8 sm:mb-12 px-4">
          Live met Hugo kost €2.000 per halve dag voor een kleine groep. Met de AI-salescoach, dagelijkse live sessies of exclusieve 1-op-1 coaching — kies het plan dat bij je past.
        </p>

        <div className="flex items-center justify-center gap-3 mb-8 sm:mb-12">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
            const period = "/maand";
            const isLoading = loadingTier === plan.tier;
            
            return (
              <PricingTier
                key={plan.name}
                name={plan.name}
                price={price}
                period={period}
                priceNote={isYearly && plan.yearlyNote ? plan.yearlyNote : undefined}
                subtitleNote={plan.subtitleNote}
                features={plan.features}
                cta={isLoading ? "Laden..." : plan.cta}
                highlighted={plan.highlighted}
                premium={plan.premium}
                badge={plan.badge}
                onCtaClick={() => handleCheckout(plan.tier)}
              />
            );
          })}
        </div>
      </section>

      <section className="bg-gradient-to-r from-hh-primary/5 via-hh-primary/10 to-hh-primary/5 border-y border-hh-primary/20 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[24px] sm:text-[28px] lg:text-[32px] leading-[1.4] text-hh-text italic font-medium">
            "{getDailyQuote().text}"
          </p>
          <p className="text-[14px] sm:text-[16px] text-hh-muted mt-3">
            — Hugo Herbots
          </p>
        </div>
      </section>

      <section className="bg-hh-ui-50 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-center">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-hh-primary/10 flex items-center justify-center mb-3">
                <Shield className="w-6 h-6 text-hh-primary" />
              </div>
              <h3 className="text-[16px] leading-[24px] font-medium text-hh-text mb-1">
                GDPR Compliant
              </h3>
              <p className="text-[14px] leading-[20px] text-hh-muted">
                Jouw data is veilig
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-hh-success/10 flex items-center justify-center mb-3">
                <Lock className="w-6 h-6 text-hh-success" />
              </div>
              <h3 className="text-[16px] leading-[24px] font-medium text-hh-text mb-1">
                SSL Encrypted
              </h3>
              <p className="text-[14px] leading-[20px] text-hh-muted">
                Beveiligde verbinding
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-hh-warn/10 flex items-center justify-center mb-3">
                <Zap className="w-6 h-6 text-hh-warn" />
              </div>
              <h3 className="text-[16px] leading-[24px] font-medium text-hh-text mb-1">
                Instant Setup
              </h3>
              <p className="text-[14px] leading-[20px] text-hh-muted">
                Start binnen 2 minuten
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 bg-hh-ui-50">
        <div className="text-center mb-8 sm:mb-12 px-4">
          <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 mb-4 text-[12px] sm:text-[14px]">
            Bekijk de app
          </Badge>
          <h2 className="mb-4 text-[24px] leading-[32px] sm:text-[28px] sm:leading-[36px] lg:text-[32px] lg:leading-[40px]">
            Alles wat je nodig hebt om te groeien
          </h2>
          <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] lg:text-[18px] lg:leading-[26px] text-hh-muted max-w-2xl mx-auto">
            Van role-plays met Hugo's avatar tot team analytics — alles is gebouwd voor real-world sales success.
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12">
          <Card className="p-6 rounded-[16px] shadow-hh-md border-hh-border overflow-hidden">
            <div className="mb-4 rounded-lg overflow-hidden">
              <BrowserMockup
                imageSrc={roleplayScreenshot}
                imageAlt="Role-play sessie met Hugo"
              />
            </div>
            <h3 className="mb-2">Train met Hugo's AI avatar</h3>
            <p className="text-hh-muted">
              Real-time feedback tijdens gesprekken. Oefen elke dag kort en zie direct verbeterpunten.
            </p>
          </Card>

          <Card className="p-6 rounded-[16px] shadow-hh-md border-hh-border overflow-hidden">
            <div className="mb-4 rounded-lg overflow-hidden">
              <BrowserMockup
                imageSrc={analyticsScreenshot}
                imageAlt="Analytics dashboard"
              />
            </div>
            <h3 className="mb-2">Meet je groei per techniek</h3>
            <p className="text-hh-muted">
              Zie welke technieken je al beheerst en waar je nog aan moet werken — met teamoverzicht.
            </p>
          </Card>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="mb-4">
            Vergelijk alle features
          </h2>
          <p className="text-[18px] leading-[26px] text-hh-muted">
            Zie precies wat je krijgt per plan — eerlijk en transparant
          </p>
        </div>

        <Card className="rounded-[16px] shadow-hh-md border-hh-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Feature</TableHead>
                <TableHead className="text-center">Pro</TableHead>
                <TableHead className="text-center bg-hh-warn/5">Founder</TableHead>
                <TableHead className="text-center">Inner Circle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {featureComparison.map((category, categoryIdx) => (
                <React.Fragment key={category.category}>
                  <TableRow className="bg-hh-ui-50">
                    <TableCell
                      colSpan={4}
                      className="font-semibold text-hh-text"
                    >
                      {category.category}
                    </TableCell>
                  </TableRow>
                  {category.features.map((feature, idx) => (
                    <TableRow key={`${category.category}-${feature.name}-${idx}`}>
                      <TableCell className="text-hh-text">
                        {feature.name}
                      </TableCell>
                      <TableCell className="text-center">
                        {typeof feature.pro === "boolean" ? (
                          feature.pro ? (
                            <Check className="w-5 h-5 text-hh-success mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-hh-muted mx-auto" />
                          )
                        ) : (
                          <span className="text-hh-text">{feature.pro}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center bg-hh-warn/5">
                        {typeof feature.founder === "boolean" ? (
                          feature.founder ? (
                            <Check className="w-5 h-5 text-hh-success mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-hh-muted mx-auto" />
                          )
                        ) : (
                          <span className="text-hh-text">{feature.founder}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {typeof feature.innerCircle === "boolean" ? (
                          feature.innerCircle ? (
                            <Check className="w-5 h-5 text-hh-success mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-hh-muted mx-auto" />
                          )
                        ) : (
                          <span className="text-hh-text">{feature.innerCircle}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="bg-hh-ui-50 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="mb-8 text-center">
            Veelgestelde vragen
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "Hoe werkt Hugo's AI-salescoach?",
                a: "Je oefent gesprekken met mijn avatar. Na elke sessie krijg je directe feedback op 54 technieken — net als bij live training.",
              },
              {
                q: "Krijg ik live training?",
                a: "Ja. Dagelijks (ma–vr) 45–60 min + Q&A. Opnames zijn binnen 2 uur beschikbaar met chapters.",
              },
              {
                q: "Kan ik eigen scenario's toevoegen?",
                a: "Ja, voor Inner Circle. Upload cases, bezwaren en context — wij passen de training daarop aan.",
              },
              {
                q: "Is er een gratis trial?",
                a: "Ja. 14 dagen volledig proberen, zonder creditcard.",
              },
              {
                q: "Wat is het verschil maand vs. jaar?",
                a: "Jaarlijks betalen geeft 50% korting op elk plan. Pro: €49/mnd, Founder: €249/mnd, Inner Circle: €1.249/mnd — allemaal gefactureerd jaarlijks. Maandelijks betalen is het dubbele.",
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

      <section className="max-w-7xl mx-auto px-6 py-20">
        <Card className="p-12 rounded-[24px] shadow-hh-lg border-hh-primary bg-gradient-to-r from-hh-primary/5 to-transparent text-center">
          <h2 className="mb-4">
            Train elke dag. Win elke week. Met Hugo.
          </h2>
          <p className="text-[18px] leading-[26px] text-hh-muted mb-8 max-w-2xl mx-auto">
            14 dagen volledig proberen. Geen creditcard, geen risico. Als het niet werkt, is het gratis.
          </p>
          <Button 
            size="lg" 
            variant="ink" 
            className="gap-2"
            onClick={() => handleCheckout("pro")}
            disabled={loadingTier === "pro"}
          >
            {loadingTier === "pro" ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Laden...</>
            ) : (
              <>Start gratis met Hugo <ArrowRight className="w-4 h-4" /></>
            )}
          </Button>
        </Card>
      </section>

      <footer className="border-t border-hh-border py-12">
        <div className="max-w-7xl mx-auto px-6 text-center text-[14px] leading-[20px] text-hh-muted">
          © 2025 HugoHerbots.ai. Alle rechten voorbehouden.
        </div>
      </footer>
    </div>
  );
}
