import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Logo } from "./Logo";
import { StickyHeader } from "./StickyHeader";
import { getQuotesByContext } from "../../data/hugoQuotes";
import {
  Users,
  Award,
  TrendingUp,
  Heart,
  ArrowRight,
  Quote,
  Play,
} from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import hugoPortrait from "figma:asset/9fadffbf5efd08d95548ac3acedf2a4c54db789e.png";
import hugoWalking from "figma:asset/3303da6db66b7132ebc5f2f6276712c9a0fd485e.png";
import hugoWorking from "figma:asset/ffe328d4703b02e265880fd122f17bde74ebfa9d.png";

type Page = "landing" | "pricing" | "about" | "login" | "signup" | "preview" | "onboarding" | "dashboard" | "roleplay" | "library" | "builder" | "sessions" | "analytics" | "settings";

interface AboutProps {
  navigate?: (page: Page) => void;
}

export function About({ navigate }: AboutProps) {
  const handleNavigate = (page: Page) => {
    if (navigate) navigate(page);
  };

  return (
    <div className="bg-hh-bg min-h-screen">
      {/* Sticky Header */}
      <StickyHeader currentPage="about" navigate={handleNavigate} />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-12 sm:pb-16">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div>
            <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 mb-4 text-[12px] sm:text-[14px]">
              40 jaar salestraining
            </Badge>
            <h1 className="mb-4 text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px]">
              Ik ben Hugo Herbots. En dit is mijn laatste hoofdstuk.
            </h1>
            <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] lg:text-[18px] lg:leading-[26px] text-hh-muted mb-4 sm:mb-6">
              40 jaar lang heb ik teams getraind in de kunst van verkopen. Meer
              dan 20.000 mensen leerden dat sales niet draait om slimme
              praatjes, maar om psychologie. Om mensen.
            </p>
            <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] lg:text-[18px] lg:leading-[26px] text-hh-muted mb-6">
              Nu, in het laatste hoofdstuk van mijn leven, maak ik alles wat ik
              weet beschikbaar voor iedereen. Niet alleen voor de elite die
              €1.500 per halve dag betaalt. Maar voor elke salesprof die beter
              wil worden.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button size="lg" variant="ink" className="gap-2 w-full sm:w-auto" onClick={() => handleNavigate("preview")}>
                Train met Hugo <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto" onClick={() => handleNavigate("login")}>
                Inloggen
              </Button>
            </div>
          </div>
          <div className="relative">
            <Card className="aspect-[3/4] rounded-[24px] shadow-hh-lg border-hh-border overflow-hidden">
              <img 
                src={hugoPortrait} 
                alt="Hugo Herbots - 40 jaar salestraining ervaring"
                className="w-full h-full object-cover"
              />
            </Card>
            {/* Quote overlay */}
            <Card className="absolute bottom-6 left-6 right-6 p-4 bg-hh-bg/95 backdrop-blur-sm border-hh-border shadow-hh-md">
              <p className="text-[18px] leading-[26px] text-hh-text italic mb-2">
                "{getQuotesByContext("mindset")[0].text}"
              </p>
              <p className="text-[14px] leading-[20px] text-hh-muted">
                — Hugo Herbots
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-hh-ink py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 text-center">
            {[
              { number: "40", label: "Jaar salestraining", suffix: "+" },
              { number: "20K", label: "Getrainde professionals", suffix: "+" },
              { number: "€1.5K", label: "Live halve dag training", suffix: "" },
              { number: "5", label: "Fasen • 25 technieken", suffix: "" },
            ].map((stat, idx) => (
              <div key={idx}>
                <p className="text-white mb-2">
                  <span className="text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px]">
                    {stat.number}
                  </span>
                  <span className="text-[24px] leading-[32px] sm:text-[28px] sm:leading-[36px] lg:text-[32px] lg:leading-[40px] text-hh-ui-300">
                    {stat.suffix}
                  </span>
                </p>
                <p className="text-[12px] leading-[18px] sm:text-[14px] sm:leading-[20px] lg:text-[16px] lg:leading-[24px] text-hh-ui-300">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="space-y-8">
          <div>
            <h2 className="mb-4">Het verhaal</h2>
            <p className="text-[18px] leading-[26px] text-hh-muted">
              Mijn carrière begon in de jaren '80. Toen was sales nog een
              ambacht — geen apps, geen CRM's, gewoon jij en de klant. Ik
              leerde dat deals niet gewonnen worden met PowerPoints, maar met
              het stellen van de juiste vragen op het juiste moment.
            </p>
          </div>

          <Card className="p-8 rounded-[16px] shadow-hh-md border-hh-border bg-hh-ui-50">
            <div className="flex gap-4">
              <Quote className="w-8 h-8 text-hh-primary flex-shrink-0" />
              <div>
                <p className="text-[18px] leading-[26px] text-hh-text italic mb-3">
                  "{getQuotesByContext("listening")[0].text}"
                </p>
                <p className="text-[14px] leading-[20px] text-hh-muted">
                  — Hugo Herbots
                </p>
              </div>
            </div>
          </Card>

          <div>
            <h3 className="mb-3">
              Van exclusief naar toegankelijk
            </h3>
            <p className="text-[18px] leading-[26px] text-hh-muted mb-4">
              De laatste jaren werkte ik exclusief voor 12 bedrijven. €1.500 per halve dag, 
              groepen van 6-10 mensen, intensieve sessies.
            </p>
            <p className="text-[18px] leading-[26px] text-hh-muted mb-4">
              Als het wél werkt, is het magisch — ik heb honderden verkopers doorheen 
              de jaren formidabele carrières zien uitbouwen.
            </p>
            <p className="text-[18px] leading-[26px] text-hh-muted mb-4">
              Maar in alle eerlijkheid? Slechts 1 op de 10 werd een echte topverkoper.
            </p>
            <p className="text-[18px] leading-[26px] text-hh-muted mb-4">
              Waarom? Omdat ik hen aan de hand van slides uitlegde hoe je verkoopt. 
              Je leert ook niet golfen door ernaar te kijken — je moet het doen.
            </p>
            <p className="text-[18px] leading-[26px] text-hh-muted">
              En economisch was één-op-één training onverantwoord — welk bedrijf betaalt 
              €1.500 per halve dag voor individuele coaching?
            </p>
          </div>

          <div>
            <h3 className="mb-3">
              Waarom nu? Waarom AI?
            </h3>
            <p className="text-[18px] leading-[26px] text-hh-muted mb-4">
              Nu kan het anders. Dankzij AI train je met mij — niet één keer per week in een 
              groep, maar elke dag, privé. Van thuis, van de zetel, veilig. Met directe 
              feedback zoals ik dat live zou geven. Vanaf €149 per maand.
            </p>
            <p className="text-[18px] leading-[26px] text-hh-muted">
              Ik ben nu in het laatste hoofdstuk van mijn leven. 40 jaar verfijnde 
              scripts, 25 technieken, 20.000+ sessies — ik wil niet dat deze kennis 
              verdwijnt.
            </p>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="bg-hh-ui-50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="mb-4">
              Mijn filosofie: People buy people
            </h2>
            <p className="text-[18px] leading-[26px] text-hh-muted max-w-2xl mx-auto">
              De kern van sales is 50 jaar onveranderd. Je verkoopt geen
              producten — je helpt mensen kiezen.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Heart,
                title: "Menselijke psychologie",
                desc: "Sales draait om emotie, niet logica. Mensen kopen met hun hart en rechtvaardigen met hun hoofd.",
              },
              {
                icon: TrendingUp,
                title: "Bewezen technieken",
                desc: "Geen trendy buzzwords. Alleen methodes die 40 jaar lang werken, verfijnd door 20.000+ sessies.",
              },
              {
                icon: Users,
                title: "Eerlijk en direct",
                desc: "Geen trucjes of manipulatie. Gewoon eerlijk helpen de juiste keuze maken — dat is genoeg.",
              },
            ].map((item, idx) => (
              <Card
                key={idx}
                className="p-6 rounded-[16px] shadow-hh-sm border-hh-border text-center"
              >
                <div className="w-12 h-12 rounded-full bg-hh-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-6 h-6 text-hh-primary" />
                </div>
                <h3 className="text-[20px] leading-[28px] text-hh-text mb-2">
                  {item.title}
                </h3>
                <p className="text-[16px] leading-[24px] text-hh-muted">
                  {item.desc}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Hugo in actie - Boardroom photo */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
            <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 mb-4">
              Live training
            </Badge>
            <h2 className="mb-4">
              Zo train ik — persoonlijk, eerlijk, resultaatgericht
            </h2>
            <p className="text-[18px] leading-[26px] text-hh-muted mb-4">
              40 jaar. 20.000+ live sessies. 500+ bedrijven. Elke
              sessie is hands-on, met directe feedback en concrete oefeningen. Geen
              theorie — alleen wat werkt.
            </p>
            <p className="text-[18px] leading-[26px] text-hh-muted mb-6">
              Nu krijg je diezelfde aanpak — maar dan 24/7 beschikbaar. Mijn
              AI-avatar traint je precies zoals ik dat zou doen: eerlijk, direct en
              met focus op resultaat.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "€1.500", desc: "Per halve dag live" },
                { label: "€149", desc: "Per maand onbeperkt" },
              ].map((item, idx) => (
                <Card key={idx} className="p-4 border-hh-border text-center">
                  <p className="text-[32px] leading-[40px] text-hh-primary mb-1">
                    {item.label}
                  </p>
                  <p className="text-[14px] leading-[20px] text-hh-muted">
                    {item.desc}
                  </p>
                </Card>
              ))}
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <Card className="rounded-[24px] shadow-hh-lg border-hh-border overflow-hidden">
              <img
                src={hugoWorking}
                alt="Hugo Herbots tijdens persoonlijke training sessie"
                className="w-full h-full object-cover"
              />
            </Card>
          </div>
        </div>
      </section>

      {/* New Section - Hugo's Journey */}
      <section className="bg-hh-ui-50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-1 lg:order-1">
              <Card className="rounded-[24px] shadow-hh-lg border-hh-border overflow-hidden aspect-[4/3]">
                <img
                  src={hugoWalking}
                  alt="Hugo Herbots - 40 jaar ervaring in salestraining"
                  className="w-full h-full object-cover"
                />
              </Card>
            </div>
            <div className="order-2 lg:order-2">
              <h2 className="mb-4">
                40 jaar lopen. Nu tijd om te delen.
              </h2>
              <p className="text-[18px] leading-[26px] text-hh-muted mb-4">
                Ik heb duizenden boardrooms gelopen. Duizenden deals zien sluiten en mislukken. 
                Wat ik leerde? Sales is geen trucje. Het is psychologie. Het is timing. 
                Het is luisteren.
              </p>
              <p className="text-[18px] leading-[26px] text-hh-muted mb-6">
                Deze kennis verdient het om blijvend beschikbaar te zijn. Voor iedereen 
                die bereid is om te leren, te oefenen en beter te worden. Niet alleen voor 
                degenen die €2.000 per sessie kunnen betalen.
              </p>
              <Button size="lg" variant="ink" className="gap-2" onClick={() => handleNavigate("preview")}>
                Ontdek de methode <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="mb-4">
            De methode: 4 fasen, 25 technieken
          </h2>
          <p className="text-[18px] leading-[26px] text-hh-muted max-w-2xl mx-auto">
            Elke deal doorloopt vijf fases. Ik train je op alle technieken die
            je nodig hebt om elke fase te winnen.
          </p>
        </div>

        {/* Hugo's Sales Wisdom - Quote Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {getQuotesByContext("technique").slice(0, 3).map((quote, idx) => (
            <Card key={idx} className="p-6 rounded-[16px] shadow-hh-sm border-hh-primary/20 bg-hh-primary/5">
              <Quote className="w-6 h-6 text-hh-primary mb-3" />
              <p className="text-[16px] leading-[24px] text-hh-text italic">
                "{quote.text}"
              </p>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {[
            {
              phase: "Fase 0",
              title: "Pre-contact (Desktop research)",
              desc: "Desktop research, SWOT analyse, CRM check, One Minute Manager voorbereiding. Kom goed voorbereid aan tafel.",
              techniques: ["Desktop research", "SWOT analyse", "CRM analyse", "One Minute Manager"],
            },
            {
              phase: "Fase 1",
              title: "Openingsfase",
              desc: "Creëer het juiste koopklimaat. Start met een gentleman's agreement en een sterke firmavoorstelling. Stel de perfecte instapvraag.",
              techniques: ["Koopklimaat creëren", "Gentleman's agreement", "Firmavoorstelling", "Instapvraag"],
            },
            {
              phase: "Fase 2",
              title: "Ontdekkingsfase",
              desc: "Stel feitgerichte én meningsgerichte vragen. Luister actief en empathisch. Gebruik pingpong en LEAD questioning om dieper te graven.",
              techniques: [
                "Feitgerichte vragen",
                "Open vragen",
                "Actief luisteren",
                "Pingpong techniek",
                "LEAD questioning"
              ],
            },
            {
              phase: "Fase 3",
              title: "Aanbevelingsfase",
              desc: "Toon empathie, presenteer oplossing, voordeel én baat. Vraag mening onder alternatieve vorm.",
              techniques: ["Empathie tonen", "Oplossing", "Voordeel", "Baat", "Mening vragen"],
            },
            {
              phase: "Fase 4",
              title: "Beslissingsfase",
              desc: "Proefafsluiting, handle vragen/bezwaren/twijfels met rust en vertrouwen. Omarm angst en bezorgdheden.",
              techniques: ["Proefafsluiting", "Klant stelt vragen", "Bezwaren", "Twijfels", "Angst/Bezorgdheden"],
            },
          ].map((item, idx) => (
            <Card
              key={idx}
              className="p-6 rounded-[16px] shadow-hh-md border-hh-border"
            >
              <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 mb-3">
                {item.phase}
              </Badge>
              <h3 className="text-[24px] leading-[32px] text-hh-text mb-2">
                {item.title}
              </h3>
              <p className="text-[16px] leading-[24px] text-hh-muted mb-4">
                {item.desc}
              </p>
              <div className="flex flex-wrap gap-2">
                {item.techniques.map((tech, techIdx) => (
                  <Badge
                    key={techIdx}
                    variant="outline"
                    className="text-[12px]"
                  >
                    {tech}
                  </Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Recognition */}
      <section className="bg-hh-ui-50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="mb-4">Erkenning</h2>
            <p className="text-[18px] leading-[26px] text-hh-muted max-w-2xl mx-auto">
              40 jaar training spreekt voor zich — maar deze impact maakt me
              trots
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Award,
                stat: "30-50%",
                label: "Gemiddelde conversie stijging",
                desc: "Bij teams die mijn methode toepassen",
              },
              {
                icon: Users,
                stat: "20.000+",
                label: "Getrainde professionals",
                desc: "Van SDR tot VP Sales, B2B en B2C",
              },
              {
                icon: TrendingUp,
                stat: "500+",
                label: "Bedrijven getraind",
                desc: "Van scale-ups tot Fortune 500",
              },
            ].map((item, idx) => (
              <Card
                key={idx}
                className="p-6 rounded-[16px] shadow-hh-sm border-hh-border text-center"
              >
                <div className="w-12 h-12 rounded-full bg-hh-success/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-6 h-6 text-hh-success" />
                </div>
                <p className="text-[40px] leading-[48px] text-hh-text mb-1">
                  {item.stat}
                </p>
                <p className="text-[18px] leading-[26px] text-hh-text mb-2">
                  {item.label}
                </p>
                <p className="text-[14px] leading-[20px] text-hh-muted">
                  {item.desc}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-hh-ink py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-white mb-4">
            Train met mij. Elke dag. Voor altijd.
          </h2>
          <p className="text-[18px] leading-[26px] text-hh-ui-300 mb-8">
            40 jaar kennis, nu beschikbaar voor de prijs van één lunch per
            maand. Probeer 14 dagen gratis.
          </p>
          <Button size="lg" variant="ink" onClick={() => handleNavigate("preview")}>
            Start gratis met Hugo <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-hh-border py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Logo variant="horizontal" className="text-hh-ink mb-4 text-[18px]" />
              <p className="text-[14px] leading-[20px] text-hh-muted">
                AI-salescoach door Hugo Herbots
              </p>
            </div>
            <div>
              <h4 className="text-[16px] leading-[24px] text-hh-text mb-3">
                Product
              </h4>
              <ul className="space-y-2 text-[14px] leading-[20px] text-hh-muted">
                <li>
                  <a href="#">Prijzen</a>
                </li>
                <li>
                  <a href="#">Features</a>
                </li>
                <li>
                  <a href="#">Bekijk demo met Hugo</a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-[16px] leading-[24px] text-hh-text mb-3">
                Bedrijf
              </h4>
              <ul className="space-y-2 text-[14px] leading-[20px] text-hh-muted">
                <li>
                  <a href="#">Over Hugo</a>
                </li>
                <li>
                  <a href="#">Contact</a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-[16px] leading-[24px] text-hh-text mb-3">
                Legal
              </h4>
              <ul className="space-y-2 text-[14px] leading-[20px] text-hh-muted">
                <li>
                  <a href="#">Privacy</a>
                </li>
                <li>
                  <a href="#">Terms</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="text-center text-[14px] leading-[20px] text-hh-muted pt-8 border-t border-hh-border">
            © 2025 HugoHerbots.ai. Alle rechten voorbehouden.
          </div>
        </div>
      </footer>
    </div>
  );
}