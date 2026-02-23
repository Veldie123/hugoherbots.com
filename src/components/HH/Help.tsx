import { useState, useMemo } from "react";
import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Search,
  HelpCircle,
  Video,
  FileText,
  Mail,
  ChevronDown,
  ChevronUp,
  BookOpen,
  MessageSquare,
  ExternalLink,
  PlayCircle,
  Settings,
  Users,
  Calendar,
  Target,
  Headphones,
} from "lucide-react";

interface HelpProps {
  navigate: (page: string) => void;
  isAdmin?: boolean;
}

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: "getting-started" | "techniques" | "account" | "support";
}

const faqData: FAQItem[] = [
  {
    id: 1,
    question: "Wat zijn E.P.I.C technieken en hoe gebruik ik ze?",
    answer: "E.P.I.C staat voor Engageren, Probleemanalyse, Impactverkenning en Commitment. Dit zijn de vier kernfases van het verkoopproces. Elke fase bevat specifieke technieken die je helpen om effectievere gesprekken te voeren. Je kunt de technieken leren via onze videobibliotheek en oefenen met AI-roleplays.",
    category: "techniques",
  },
  {
    id: 2,
    question: "Hoe start ik een roleplay sessie met Hugo AI?",
    answer: "Ga naar het Hugo AI menu in de navigatie en kies een scenario. Je kunt kiezen uit verschillende klantprofielen en situaties. Hugo AI simuleert een realistische klant en geeft je feedback op je verkooptechnieken na afloop van het gesprek.",
    category: "getting-started",
  },
  {
    id: 3,
    question: "Hoe kan ik mijn accountinstellingen wijzigen?",
    answer: "Klik op je profielfoto rechtsboven en selecteer 'Instellingen'. Hier kun je je persoonlijke gegevens aanpassen, je wachtwoord wijzigen, notificatievoorkeuren instellen en je abonnement beheren.",
    category: "account",
  },
  {
    id: 4,
    question: "Waar vind ik de instructievideo's?",
    answer: "Alle instructievideo's zijn te vinden in de Video's sectie in het hoofdmenu. De video's zijn georganiseerd per E.P.I.C fase en techniek. Je kunt video's markeren als favoriet en je voortgang wordt automatisch bijgehouden.",
    category: "techniques",
  },
  {
    id: 5,
    question: "Hoe meld ik me aan voor een webinar?",
    answer: "Ga naar de Webinars pagina via het hoofdmenu. Hier zie je alle aankomende live sessies met Hugo Hemingway. Klik op 'Aanmelden' bij het webinar van je keuze. Je ontvangt een bevestigingsmail met de link om deel te nemen.",
    category: "getting-started",
  },
  {
    id: 6,
    question: "Wat is gespreksanalyse en hoe werkt het?",
    answer: "Met gespreksanalyse kun je opnames van je verkoopgesprekken uploaden. Onze AI analyseert het gesprek en geeft je inzicht in welke E.P.I.C technieken je hebt gebruikt, wat goed ging en waar je kunt verbeteren. Upload je gesprek als MP3, WAV of M4A bestand.",
    category: "techniques",
  },
  {
    id: 7,
    question: "Kan ik mijn team uitnodigen voor het platform?",
    answer: "Als je een team-abonnement hebt, kun je teamleden uitnodigen via Instellingen > Team beheer. Voer de e-mailadressen in van je collega's en zij ontvangen een uitnodiging. Als beheerder kun je ook de voortgang van je team volgen.",
    category: "account",
  },
  {
    id: 8,
    question: "Hoe neem ik contact op met de klantenservice?",
    answer: "Je kunt ons bereiken via het contactformulier onderaan deze pagina, of stuur een e-mail naar support@humecoach.nl. Voor dringende vragen kun je ook bellen naar ons supportnummer. We reageren binnen 24 uur op werkdagen.",
    category: "support",
  },
  {
    id: 9,
    question: "Worden mijn roleplay sessies opgeslagen?",
    answer: "Ja, al je roleplay sessies worden automatisch opgeslagen in je account. Je kunt ze terugvinden onder 'Mijn Sessies' in het dashboard. Hier kun je ook de feedback en scores van eerdere sessies bekijken om je voortgang te volgen.",
    category: "techniques",
  },
  {
    id: 10,
    question: "Hoe werkt het scoresysteem?",
    answer: "Je score wordt berekend op basis van hoe goed je de E.P.I.C technieken toepast tijdens roleplays en gesprekken. De AI beoordeelt aspecten zoals timing, woordkeuze, en gesprekstechniek. Je ziet een totaalscore en scores per techniek.",
    category: "techniques",
  },
  {
    id: 11,
    question: "Kan ik het platform offline gebruiken?",
    answer: "Op dit moment is een internetverbinding vereist om het platform te gebruiken. De AI-functies zoals roleplays en gespreksanalyse vereisen een actieve verbinding. Video's kunnen wel worden bekeken met een beperkte verbinding.",
    category: "support",
  },
  {
    id: 12,
    question: "Hoe kan ik mijn abonnement opzeggen?",
    answer: "Je kunt je abonnement opzeggen via Instellingen > Abonnement > Opzeggen. Je behoudt toegang tot het platform tot het einde van je huidige facturatieperiode. Neem contact op met support als je vragen hebt over opzegging.",
    category: "account",
  },
];

const quickLinks = [
  { label: "Aan de slag gids", icon: BookOpen, page: "library" },
  { label: "Video tutorials", icon: PlayCircle, page: "videos" },
  { label: "Start een roleplay", icon: MessageSquare, page: "coaching" },
  { label: "Webinar agenda", icon: Calendar, page: "live" },
  { label: "E.P.I.C technieken", icon: Target, page: "library" },
  { label: "Account instellingen", icon: Settings, page: "settings" },
];

const categoryLabels: Record<string, string> = {
  "all": "Alle categorieën",
  "getting-started": "Aan de slag",
  "techniques": "Technieken",
  "account": "Account",
  "support": "Support",
};

export function Help({ navigate, isAdmin }: HelpProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const filteredFAQs = useMemo(() => {
    return faqData.filter((faq) => {
      const matchesSearch = searchQuery === "" ||
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "all" || faq.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, categoryFilter]);

  const toggleFAQ = (id: number) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "getting-started":
        return (
          <Badge className="bg-hh-ink/10 text-hh-ink border-hh-ink/20 text-[11px]">
            Aan de slag
          </Badge>
        );
      case "techniques":
        return (
          <Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 text-[11px]">
            Technieken
          </Badge>
        );
      case "account":
        return (
          <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 text-[11px]">
            Account
          </Badge>
        );
      case "support":
        return (
          <Badge className="bg-hh-warn/10 text-hh-warn border-hh-warn/20 text-[11px]">
            Support
          </Badge>
        );
      default:
        return null;
    }
  };

  const faqCount = faqData.length;
  const videoTutorialsCount = 45;
  const documentationCount = 28;
  const contactOptionsCount = 3;

  return (
    <AppLayout currentPage="help" navigate={navigate} isAdmin={isAdmin}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Help Center
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Vind antwoorden op je vragen
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-ink/10 flex items-center justify-center">
                <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-hh-ink" />
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              FAQ Artikelen
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-text font-medium">
              {faqCount}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                <Video className="w-4 h-4 sm:w-5 sm:h-5 text-hh-primary" />
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Video Tutorials
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-text font-medium">
              {videoTutorialsCount}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-ink/10 flex items-center justify-center">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-hh-ink" />
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Documentatie
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-text font-medium">
              {documentationCount}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-success/10 flex items-center justify-center">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-hh-success" />
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Contact Opties
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-text font-medium">
              {contactOptionsCount}
            </p>
          </Card>
        </div>

        {/* Search & Filters */}
        <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek in veelgestelde vragen..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Alle categorieën" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle categorieën</SelectItem>
                <SelectItem value="getting-started">Aan de slag</SelectItem>
                <SelectItem value="techniques">Technieken</SelectItem>
                <SelectItem value="account">Account</SelectItem>
                <SelectItem value="support">Support</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* FAQ List - Takes 2 columns */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-[18px] leading-[24px] text-hh-text font-semibold mb-4">
              Veelgestelde vragen ({filteredFAQs.length})
            </h2>
            
            {filteredFAQs.length === 0 ? (
              <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border text-center">
                <HelpCircle className="w-12 h-12 text-hh-muted mx-auto mb-3" />
                <p className="text-hh-muted">Geen vragen gevonden voor "{searchQuery}"</p>
                <Button
                  variant="ghost"
                  className="mt-3 text-hh-ink"
                  onClick={() => {
                    setSearchQuery("");
                    setCategoryFilter("all");
                  }}
                >
                  Filters wissen
                </Button>
              </Card>
            ) : (
              filteredFAQs.map((faq) => (
                <Card
                  key={faq.id}
                  className={`rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden transition-all ${
                    expandedFAQ === faq.id ? "ring-2 ring-hh-ink/20" : ""
                  }`}
                >
                  <button
                    onClick={() => toggleFAQ(faq.id)}
                    className="w-full p-4 sm:p-5 flex items-start justify-between gap-4 text-left hover:bg-hh-ui-50/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getCategoryBadge(faq.category)}
                      </div>
                      <p className="text-[14px] sm:text-[15px] leading-[22px] text-hh-text font-medium">
                        {faq.question}
                      </p>
                    </div>
                    <div className="flex-shrink-0 mt-1">
                      {expandedFAQ === faq.id ? (
                        <ChevronUp className="w-5 h-5 text-hh-ink" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-hh-muted" />
                      )}
                    </div>
                  </button>
                  
                  {expandedFAQ === faq.id && (
                    <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 border-t border-hh-border">
                      <p className="text-[14px] leading-[22px] text-hh-muted pt-4">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Quick Links */}
            <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border">
              <h3 className="text-[16px] leading-[22px] text-hh-text font-semibold mb-4">
                Snelle links
              </h3>
              <div className="space-y-2">
                {quickLinks.map((link, index) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => navigate(link.page)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-hh-ui-50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-full bg-hh-ink/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-hh-ink" />
                      </div>
                      <span className="text-[14px] leading-[20px] text-hh-text group-hover:text-hh-ink transition-colors">
                        {link.label}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-hh-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Contact Support Card */}
            <Card className="p-5 rounded-[16px] shadow-hh-sm border-hh-border bg-gradient-to-br from-hh-ink/5 to-hh-primary/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-hh-ink flex items-center justify-center">
                  <Headphones className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-[16px] leading-[22px] text-hh-text font-semibold">
                    Hulp nodig?
                  </h3>
                  <p className="text-[13px] leading-[18px] text-hh-muted">
                    Ons team staat voor je klaar
                  </p>
                </div>
              </div>
              
              <p className="text-[14px] leading-[22px] text-hh-muted mb-4">
                Kun je het antwoord niet vinden? Neem contact op met ons supportteam. We reageren binnen 24 uur.
              </p>
              
              <div className="space-y-2">
                <Button
                  className="w-full gap-2 bg-hh-ink hover:bg-hh-ink/90 text-white"
                >
                  <Mail className="w-4 h-4" />
                  Stuur een bericht
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 border-hh-ink/20 text-hh-ink hover:bg-hh-ink/5"
                >
                  <Users className="w-4 h-4" />
                  Live chat starten
                </Button>
              </div>
              
              <p className="text-[12px] leading-[16px] text-hh-muted text-center mt-4">
                support@humecoach.nl • Ma-Vr 9:00-17:00
              </p>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
