import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import {
  Play,
  CheckCircle2,
  Lock,
  Clock,
  TrendingUp,
  MessageSquare,
  Video as VideoIcon,
  Search,
  Calendar,
  ArrowRight,
  Filter,
  X,
  BarChart,
  Target,
  Lightbulb,
  Radio,
} from "lucide-react";
import { useState } from "react";

interface SessionHistory {
  id: string;
  datum: string;
  tijd: string;
  type: "video" | "chat" | "roleplay";
  duration: string;
  score?: number;
}

interface TechniqueDetail {
  id: string;
  name: string;
  nummer: string;
  fase: string;
  faseNaam: string;
  status: "completed" | "current" | "upcoming" | "locked";
  duration: string;
  description: string;
  doList: string[];
  dontList: string[];
  sessieHistory: SessionHistory[];
  totalAttempts: number;
  avgScore: number;
  lastPlayed?: string;
  unlockRequirement?: string;
}

interface OverviewProgressProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
}

export function OverviewProgress({ navigate, isAdmin = false }: OverviewProgressProps) {
  const [selectedFase, setSelectedFase] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTechnique, setSelectedTechnique] = useState<TechniqueDetail | null>(null);

  // All techniques in flat structure
  const allTechniques: TechniqueDetail[] = [
    // Voorbereiding (-1)
    {
      id: "-1.1",
      name: "Mindset van een winnaar",
      nummer: "-1.1",
      fase: "-1",
      faseNaam: "Voorbereiding",
      status: "completed",
      duration: "8 min",
      description: "De juiste mindset is de basis van succesvolle sales — leer hoe je jezelf mentaal voorbereidt op elke deal.",
      doList: ["Start met positieve affirmaties", "Visualiseer succesvolle gesprekken", "Accepteer dat niet elke deal binnenkomt"],
      dontList: ["Begin aan een gesprek met negatieve gedachten", "Neem afwijzing persoonlijk", "Vergelijk jezelf met anderen"],
      sessieHistory: [
        { id: "s1", datum: "10 nov 2024", tijd: "09:15", type: "video", duration: "08:42", score: 95 },
      ],
      totalAttempts: 4,
      avgScore: 92,
      lastPlayed: "10 nov 2024",
    },
    {
      id: "-1.2",
      name: "Professionele voorbereiding",
      nummer: "-1.2",
      fase: "-1",
      faseNaam: "Voorbereiding",
      status: "completed",
      duration: "12 min",
      description: "Goede voorbereiding is het halve werk — research, planning en strategie voor elk gesprek.",
      doList: ["Onderzoek het bedrijf grondig", "Bereid je vragen voor", "Ken je USP's uit je hoofd"],
      dontList: ["Ga onvoorbereid een gesprek in", "Vertrouw enkel op improvisatie", "Negeer de context van de klant"],
      sessieHistory: [
        { id: "s2", datum: "11 nov 2024", tijd: "14:20", type: "chat", duration: "12:15", score: 88 },
      ],
      totalAttempts: 3,
      avgScore: 86,
      lastPlayed: "11 nov 2024",
    },
    {
      id: "-1.3",
      name: "Je eerste 30 seconden",
      nummer: "-1.3",
      fase: "-1",
      faseNaam: "Voorbereiding",
      status: "completed",
      duration: "6 min",
      description: "De eerste indruk is cruciaal — leer hoe je direct vertrouwen en respect afdwingt.",
      doList: ["Maak oogcontact", "Gebruik een stevige handdruk", "Glimlach authentiek"],
      dontList: ["Kijk naar de grond", "Begin met excuses", "Wees te informeel"],
      sessieHistory: [],
      totalAttempts: 1,
      avgScore: 75,
      lastPlayed: "09 nov 2024",
    },

    // Openingsfase (1)
    {
      id: "1.1",
      name: "Koopklimaat creëren",
      nummer: "1.1",
      fase: "1",
      faseNaam: "Openingsfase",
      status: "completed",
      duration: "10 min",
      description: "Creëer een warme, professionele sfeer waarin de klant zich op zijn gemak voelt.",
      doList: ["Wees authentiek", "Toon interesse", "Gebruik small talk strategisch"],
      dontList: ["Forceer een gesprek", "Praat alleen over jezelf", "Negeer non-verbale signalen"],
      sessieHistory: [
        { id: "s3", datum: "14 nov 2024", tijd: "14:32", type: "video", duration: "12:45", score: 87 },
        { id: "s4", datum: "12 nov 2024", tijd: "10:15", type: "chat", duration: "08:20", score: 92 },
        { id: "s5", datum: "10 nov 2024", tijd: "16:00", type: "roleplay", duration: "10:10", score: 84 },
      ],
      totalAttempts: 12,
      avgScore: 85,
      lastPlayed: "14 nov 2024",
    },
    {
      id: "1.2",
      name: "Gentleman's agreement",
      nummer: "1.2",
      fase: "1",
      faseNaam: "Openingsfase",
      status: "completed",
      duration: "7 min",
      description: "Maak duidelijke afspraken over het verloop van het gesprek.",
      doList: ["Wees transparant", "Vraag toestemming", "Stel tijdverwachtingen"],
      dontList: ["Neem aan dat alles OK is", "Spring direct naar verkopen"],
      sessieHistory: [
        { id: "s6", datum: "13 nov 2024", tijd: "16:20", type: "roleplay", duration: "05:30", score: 78 },
        { id: "s7", datum: "11 nov 2024", tijd: "11:45", type: "video", duration: "07:15", score: 82 },
      ],
      totalAttempts: 8,
      avgScore: 81,
      lastPlayed: "13 nov 2024",
    },
    {
      id: "1.3",
      name: "Firmavoorstelling + reference story",
      nummer: "1.3",
      fase: "1",
      faseNaam: "Openingsfase",
      status: "completed",
      duration: "14 min",
      description: "Introduceer je bedrijf met een krachtige reference story die aansluit bij de klant.",
      doList: ["Gebruik concrete resultaten", "Kies relevante case", "Houd het kort"],
      dontList: ["Vertel je hele geschiedenis", "Focus op features", "Maak het generiek"],
      sessieHistory: [
        { id: "s8", datum: "12 nov 2024", tijd: "09:30", type: "chat", duration: "14:50", score: 76 },
      ],
      totalAttempts: 3,
      avgScore: 72,
      lastPlayed: "12 nov 2024",
    },
    {
      id: "1.4",
      name: "Instapvraag",
      nummer: "1.4",
      fase: "1",
      faseNaam: "Openingsfase",
      status: "completed",
      duration: "5 min",
      description: "Start de ontdekking met een sterke openingsvraag.",
      doList: ["Maak het open-ended", "Laat klant praten", "Toon nieuwsgierigheid"],
      dontList: ["Stel ja/nee vragen", "Onderbreek te snel"],
      sessieHistory: [
        { id: "s9", datum: "15 nov 2024", tijd: "09:45", type: "chat", duration: "06:15", score: 89 },
      ],
      totalAttempts: 6,
      avgScore: 84,
      lastPlayed: "15 nov 2024",
    },

    // Ontdekkingsfase (2)
    {
      id: "2.1.1",
      name: "Feitgerichte vragen",
      nummer: "2.1.1",
      fase: "2",
      faseNaam: "Ontdekkingsfase",
      status: "completed",
      duration: "9 min",
      description: "Verzamel concrete feiten over de situatie van de klant.",
      doList: ["Vraag naar cijfers", "Noteer details", "Blijf objectief"],
      dontList: ["Interpreteer te snel", "Spring naar oplossingen"],
      sessieHistory: [
        { id: "s10", datum: "16 nov 2024", tijd: "11:00", type: "video", duration: "14:20", score: 91 },
        { id: "s11", datum: "14 nov 2024", tijd: "15:30", type: "roleplay", duration: "09:45", score: 87 },
      ],
      totalAttempts: 9,
      avgScore: 88,
      lastPlayed: "16 nov 2024",
    },
    {
      id: "2.1.2",
      name: "Meningsgerichte vragen (open vragen)",
      nummer: "2.1.2",
      fase: "2",
      faseNaam: "Ontdekkingsfase",
      status: "completed",
      duration: "11 min",
      description: "Ontdek de meningen, zorgen en prioriteiten van de klant.",
      doList: ["Luister actief", "Stel waarom-vragen", "Laat stiltes bestaan"],
      dontList: ["Vul antwoorden in", "Ga in discussie"],
      sessieHistory: [
        { id: "s12", datum: "15 nov 2024", tijd: "14:30", type: "chat", duration: "11:45", score: 86 },
      ],
      totalAttempts: 11,
      avgScore: 83,
      lastPlayed: "15 nov 2024",
    },
    {
      id: "2.1.3",
      name: "Feitgerichte vragen onder alternatieve vorm",
      nummer: "2.1.3",
      fase: "2",
      faseNaam: "Ontdekkingsfase",
      status: "current",
      duration: "8 min",
      description: "Krijg feitelijke info zonder direct confronterend te zijn.",
      doList: ["Wees creatief", "Gebruik indirecte routes", "Blijf vriendelijk"],
      dontList: ["Wees manipulatief", "Verlies het doel"],
      sessieHistory: [
        { id: "s13", datum: "17 nov 2024", tijd: "10:15", type: "roleplay", duration: "08:30", score: 79 },
        { id: "s14", datum: "16 nov 2024", tijd: "13:20", type: "video", duration: "07:55", score: 74 },
      ],
      totalAttempts: 5,
      avgScore: 76,
      lastPlayed: "17 nov 2024",
    },
    {
      id: "2.1.4",
      name: "Ter zijde schuiven",
      nummer: "2.1.4",
      fase: "2",
      faseNaam: "Ontdekkingsfase",
      status: "upcoming",
      duration: "7 min",
      description: "Handel bezwaren en vragen tactisch af om het gesprek te verdiepen.",
      doList: ["Erken de vraag", "Parkeer tactisch", "Kom er later op terug"],
      dontList: ["Negeer de vraag", "Wees afwijzend"],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi 2.1.3 met minimaal 80%",
    },
    {
      id: "2.1.5",
      name: "Pingpong techniek",
      nummer: "2.1.5",
      fase: "2",
      faseNaam: "Ontdekkingsfase",
      status: "upcoming",
      duration: "6 min",
      description: "Gebruik vragen om vragen te beantwoorden en controle te behouden.",
      doList: ["Kaats terug met vraag", "Behoud controle", "Stay curious"],
      dontList: ["Geef direct antwoorden", "Verlies de flow"],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi 2.1.4",
    },
    {
      id: "2.1.6",
      name: "Actief en empathisch luisteren",
      nummer: "2.1.6",
      fase: "2",
      faseNaam: "Ontdekkingsfase",
      status: "upcoming",
      duration: "13 min",
      description: "Toon dat je echt luistert en begrijpt wat de klant bedoelt.",
      doList: ["Parafraseer", "Toon empathie", "Maak notities"],
      dontList: ["Onderbreek", "Denk aan je antwoord tijdens luisteren"],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi 2.1.5",
    },
    {
      id: "2.1.7",
      name: "LEAD questioning (storytelling)",
      nummer: "2.1.7",
      fase: "2",
      faseNaam: "Ontdekkingsfase",
      status: "upcoming",
      duration: "15 min",
      description: "Laat de klant hun situatie vertellen als een verhaal.",
      doList: ["Laat klant praten", "Vraag naar details", "Bouw timeline"],
      dontList: ["Onderbreek het verhaal", "Spring naar conclusies"],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi 2.1.6",
    },
    {
      id: "2.1.8",
      name: "Lock questioning",
      nummer: "2.1.8",
      fase: "2",
      faseNaam: "Ontdekkingsfase",
      status: "upcoming",
      duration: "10 min",
      description: "Bevestig en 'lock' belangrijke informatie die je hebt verzameld.",
      doList: ["Vat samen", "Vraag bevestiging", "Documenteer"],
      dontList: ["Neem aan zonder te checken", "Ga verder zonder lock"],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi 2.1.7",
    },

    // Aanbevelingsfase (3)
    {
      id: "3.1",
      name: "Empathie tonen",
      nummer: "3.1",
      fase: "3",
      faseNaam: "Aanbevelingsfase",
      status: "locked",
      duration: "8 min",
      description: "Toon dat je de situatie van de klant begrijpt voordat je een oplossing biedt.",
      doList: [],
      dontList: [],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi fase 2 volledig",
    },
    {
      id: "3.2",
      name: "Oplossing",
      nummer: "3.2",
      fase: "3",
      faseNaam: "Aanbevelingsfase",
      status: "locked",
      duration: "11 min",
      description: "Presenteer je oplossing op maat van de klant.",
      doList: [],
      dontList: [],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi 3.1",
    },
    {
      id: "3.3",
      name: "Voordeel",
      nummer: "3.3",
      fase: "3",
      faseNaam: "Aanbevelingsfase",
      status: "locked",
      duration: "9 min",
      description: "Vertaal features naar concrete voordelen.",
      doList: [],
      dontList: [],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi 3.2",
    },
    {
      id: "3.4",
      name: "Baat",
      nummer: "3.4",
      fase: "3",
      faseNaam: "Aanbevelingsfase",
      status: "locked",
      duration: "12 min",
      description: "Laat de klant de persoonlijke baat inzien.",
      doList: [],
      dontList: [],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi 3.3",
    },
    {
      id: "3.5",
      name: "Mening vragen",
      nummer: "3.5",
      fase: "3",
      faseNaam: "Aanbevelingsfase",
      status: "locked",
      duration: "7 min",
      description: "Check of je voorstel aansluit bij de klant.",
      doList: [],
      dontList: [],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi 3.4",
    },

    // Beslissingsfase (4)
    {
      id: "4.1",
      name: "Proefafsluiting",
      nummer: "4.1",
      fase: "4",
      faseNaam: "Beslissingsfase",
      status: "locked",
      duration: "10 min",
      description: "Test of de klant klaar is voor een beslissing.",
      doList: [],
      dontList: [],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi fase 3 volledig",
    },
    {
      id: "4.2.1",
      name: "Klant stelt vragen",
      nummer: "4.2.1",
      fase: "4",
      faseNaam: "Beslissingsfase",
      status: "locked",
      duration: "9 min",
      description: "Beantwoord vragen effectief en gebruik ze als verkoopkans.",
      doList: [],
      dontList: [],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi 4.1",
    },
    {
      id: "4.2.2",
      name: "Twijfels",
      nummer: "4.2.2",
      fase: "4",
      faseNaam: "Beslissingsfase",
      status: "locked",
      duration: "11 min",
      description: "Adresseer twijfels zonder defensief te worden.",
      doList: [],
      dontList: [],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi 4.2.1",
    },
    {
      id: "4.2.3",
      name: "Poging tot uitstel",
      nummer: "4.2.3",
      fase: "4",
      faseNaam: "Beslissingsfase",
      status: "locked",
      duration: "13 min",
      description: "Handel uitsteltactieken af en creëer urgentie.",
      doList: [],
      dontList: [],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi 4.2.2",
    },
    {
      id: "4.2.4",
      name: "Bezwaren",
      nummer: "4.2.4",
      fase: "4",
      faseNaam: "Beslissingsfase",
      status: "locked",
      duration: "16 min",
      description: "Transformeer bezwaren naar verkoop opportuniteiten.",
      doList: [],
      dontList: [],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi 4.2.3",
    },
    {
      id: "4.2.5",
      name: "Angst / Bezorgdheden",
      nummer: "4.2.5",
      fase: "4",
      faseNaam: "Beslissingsfase",
      status: "locked",
      duration: "12 min",
      description: "Neem angsten weg met empathie en bewijs.",
      doList: [],
      dontList: [],
      sessieHistory: [],
      totalAttempts: 0,
      avgScore: 0,
      unlockRequirement: "Voltooi 4.2.4",
    },
  ];

  // Calculate overall stats
  const totalTechniques = allTechniques.length;
  const completedTechniques = allTechniques.filter((t) => t.status === "completed").length;
  const overallProgress = Math.round((completedTechniques / totalTechniques) * 100);

  const totalSessions = allTechniques.reduce((acc, t) => acc + t.totalAttempts, 0);

  const techniquesWithScore = allTechniques.filter((t) => t.totalAttempts > 0);
  const avgOverallScore = techniquesWithScore.length
    ? Math.round(
        techniquesWithScore.reduce((acc, t) => acc + t.avgScore, 0) / techniquesWithScore.length
      )
    : 0;

  // Filter techniques
  const filteredTechniques = allTechniques.filter((technique) => {
    const matchesFase = selectedFase === "all" || technique.fase === selectedFase;
    const matchesStatus = selectedStatus === "all" || technique.status === selectedStatus;
    const matchesSearch =
      searchQuery === "" ||
      technique.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      technique.nummer.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFase && matchesStatus && matchesSearch;
  });

  const openDetails = (technique: TechniqueDetail) => {
    setSelectedTechnique(technique);
    setDetailsOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-hh-success" />;
      case "current":
        return (
          <div className="w-5 h-5 rounded-full bg-hh-primary flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          </div>
        );
      case "upcoming":
        return <div className="w-5 h-5 rounded-full border-2 border-hh-ui-200" />;
      case "locked":
        return <Lock className="w-5 h-5 text-hh-muted" />;
      default:
        return null;
    }
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-hh-success/10 text-hh-success border-hh-success/20";
    if (score >= 60) return "bg-hh-warn/10 text-hh-warn border-hh-warn/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  return (
    <AppLayout currentPage="overviewprogress" navigate={navigate} isAdmin={isAdmin}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="mb-2 text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px]">
            Technieken Bibliotheek
          </h1>
          <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
            Train elke techniek met video cursus, rollenspel of live coaching
          </p>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[14px] text-hh-muted">Voortgang</p>
              <CheckCircle2 className="w-4 h-4 text-hh-success" />
            </div>
            <p className="text-[32px] leading-[40px] text-hh-text mb-1">{overallProgress}%</p>
            <p className="text-[12px] text-hh-muted">
              {completedTechniques} / {totalTechniques} technieken voltooid
            </p>
          </Card>

          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[14px] text-hh-muted">Totaal sessies</p>
              <Play className="w-4 h-4 text-hh-primary" />
            </div>
            <p className="text-[32px] leading-[40px] text-hh-text mb-1">{totalSessions}</p>
            <p className="text-[12px] text-hh-muted">Alle technieken samen</p>
          </Card>

          <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[14px] text-hh-muted">Gemiddelde score</p>
              <TrendingUp className="w-4 h-4 text-hh-warn" />
            </div>
            <p className="text-[32px] leading-[40px] text-hh-text mb-1">{avgOverallScore}%</p>
            <p className="text-[12px] text-hh-muted">Over alle voltooide sessies</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek technieken..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-hh-muted hover:text-hh-text"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <Select value={selectedFase} onValueChange={setSelectedFase}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Alle fasen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle fasen</SelectItem>
              <SelectItem value="-1">Voorbereiding</SelectItem>
              <SelectItem value="1">Openingsfase</SelectItem>
              <SelectItem value="2">Ontdekkingsfase</SelectItem>
              <SelectItem value="3">Aanbevelingsfase</SelectItem>
              <SelectItem value="4">Beslissingsfase</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Alle statussen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle statussen</SelectItem>
              <SelectItem value="completed">Voltooid</SelectItem>
              <SelectItem value="current">Bezig</SelectItem>
              <SelectItem value="upcoming">Nog te doen</SelectItem>
              <SelectItem value="locked">Vergrendeld</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <div className="flex items-center gap-2 text-[14px] text-hh-muted">
          <Filter className="w-4 h-4" />
          {filteredTechniques.length} {filteredTechniques.length === 1 ? "techniek" : "technieken"}
        </div>

        {/* Techniques List */}
        <div className="space-y-3">
          {filteredTechniques.map((technique) => (
            <Card
              key={technique.id}
              className={`p-4 rounded-[16px] shadow-hh-sm border transition-all cursor-pointer hover:shadow-hh-md ${
                technique.status === "current"
                  ? "border-hh-primary bg-hh-primary/5"
                  : "border-hh-border hover:border-hh-primary/30"
              } ${technique.status === "locked" ? "opacity-60 cursor-not-allowed" : ""}`}
              onClick={() => technique.status !== "locked" && openDetails(technique)}
            >
              <div className="flex items-start gap-3">
                {/* Status Icon */}
                <div className="flex-shrink-0 mt-1">{getStatusIcon(technique.status)}</div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-teal-100 text-teal-600 border-0 text-[10px] flex-shrink-0 rounded-full px-2">
                          {technique.nummer}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-hh-ui-100 flex-shrink-0"
                        >
                          {technique.faseNaam}
                        </Badge>
                        {technique.status === "current" && (
                          <Badge className="text-[10px] bg-hh-primary/10 text-hh-primary border-hh-primary/20">
                            Nu bezig
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-[16px] leading-[24px] text-hh-text">{technique.name}</h3>
                    </div>
                  </div>

                  {/* Stats */}
                  {technique.status !== "locked" && (
                    <div className="flex flex-wrap items-center gap-3 text-[13px] text-hh-muted mb-3">
                      {technique.totalAttempts > 0 ? (
                        <>
                          <div className="flex items-center gap-1">
                            <Play className="w-3 h-3" />
                            {technique.totalAttempts} sessies
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {technique.avgScore}% gemiddeld
                          </div>
                          {technique.lastPlayed && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Laatste: {technique.lastPlayed}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-hh-muted italic">Nog niet geoefend</div>
                      )}
                    </div>
                  )}

                  {/* Unlock requirement for locked/upcoming */}
                  {(technique.status === "locked" || technique.status === "upcoming") &&
                    technique.unlockRequirement && (
                      <div className="mb-3 p-2 bg-hh-ui-50 rounded-lg text-[12px] text-hh-muted flex items-center gap-2">
                        <Lock className="w-3 h-3 flex-shrink-0" />
                        {technique.unlockRequirement}
                      </div>
                    )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-[13px] h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate?.("roleplays");
                      }}
                      disabled={technique.status === "locked"}
                    >
                      <Play className="w-3.5 h-3.5" /> Rollenspel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-[13px] h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate?.("videos");
                      }}
                      disabled={technique.status === "locked"}
                    >
                      <VideoIcon className="w-3.5 h-3.5" /> Video cursus
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-[13px] h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate?.("live");
                      }}
                      disabled={technique.status === "locked"}
                    >
                      <Radio className="w-3.5 h-3.5" /> Live coaching
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {filteredTechniques.length === 0 && (
            <Card className="p-12 rounded-[16px] shadow-hh-sm border-hh-border text-center">
              <Search className="w-12 h-12 text-hh-muted mx-auto mb-4" />
              <h3 className="text-[18px] leading-[26px] text-hh-text mb-2">
                Geen technieken gevonden
              </h3>
              <p className="text-[14px] text-hh-muted mb-4">
                Pas je filters aan of probeer een andere zoekopdracht
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFase("all");
                  setSelectedStatus("all");
                  setSearchQuery("");
                }}
              >
                Reset filters
              </Button>
            </Card>
          )}
        </div>

        {/* Hugo's Tip */}
        <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border bg-hh-ui-50">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-5 h-5 text-hh-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-[18px] leading-[26px] text-hh-text">
                Tip van Hugo
              </h3>
              <p className="text-[16px] leading-[24px] text-hh-muted">
                "Je bent nu bezig met techniek 2.1.3. Focus op de alternatieve vraagvormen — mensen geven makkelijker info als je indirect vraagt. Oefen 3x deze week om het te automatiseren."
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => navigate?.("roleplays")}
              >
                Start oefensessie
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Details Slide-out Panel - COMPLETELY REDESIGNED */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {selectedTechnique && (
            <div className="h-full flex flex-col">
              {/* Header Section - Fixed */}
              <div className="p-6 border-b border-hh-border bg-hh-bg">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-teal-100 text-teal-600 border-0 text-[10px] rounded-full px-2">
                        {selectedTechnique.nummer}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] bg-hh-ui-100">
                        {selectedTechnique.faseNaam}
                      </Badge>
                    </div>
                    <h2 className="text-[24px] leading-[32px] text-hh-text">
                      {selectedTechnique.name}
                    </h2>
                  </div>
                  <button
                    onClick={() => setDetailsOpen(false)}
                    className="text-hh-muted hover:text-hh-text p-2 rounded-lg hover:bg-hh-ui-50 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-[14px] leading-[22px] text-hh-muted">
                  {selectedTechnique.description}
                </p>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-6">
                  {/* Stats Cards */}
                  {selectedTechnique.totalAttempts > 0 && (
                    <div>
                      <h3 className="text-[16px] leading-[24px] text-hh-text mb-3 flex items-center gap-2">
                        <BarChart className="w-4 h-4 text-hh-primary" />
                        Prestaties
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <Card className="p-4 text-center bg-hh-ui-50 border-hh-border">
                          <Play className="w-5 h-5 text-hh-primary mx-auto mb-2" />
                          <p className="text-[24px] leading-[32px] text-hh-text">
                            {selectedTechnique.totalAttempts}
                          </p>
                          <p className="text-[12px] text-hh-muted">Sessies</p>
                        </Card>
                        <Card className="p-4 text-center bg-hh-ui-50 border-hh-border">
                          <Target className="w-5 h-5 text-hh-success mx-auto mb-2" />
                          <p className="text-[24px] leading-[32px] text-hh-text">
                            {selectedTechnique.avgScore}%
                          </p>
                          <p className="text-[12px] text-hh-muted">Gemiddelde</p>
                        </Card>
                        <Card className="p-4 text-center bg-hh-ui-50 border-hh-border">
                          <Calendar className="w-5 h-5 text-hh-warn mx-auto mb-2" />
                          <p className="text-[12px] leading-[16px] text-hh-text mt-2">
                            {selectedTechnique.lastPlayed || "-"}
                          </p>
                          <p className="text-[12px] text-hh-muted">Laatst</p>
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* Do's and Don'ts - Side by Side */}
                  {selectedTechnique.doList.length > 0 && selectedTechnique.dontList.length > 0 && (
                    <div>
                      <h3 className="text-[16px] leading-[24px] text-hh-text mb-3">
                        Do's & Don'ts
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Do's */}
                        <Card className="p-4 bg-hh-success/5 border-hh-success/20">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="w-4 h-4 text-hh-success" />
                            <h4 className="text-[14px] text-hh-success">Do's</h4>
                          </div>
                          <ul className="space-y-2">
                            {selectedTechnique.doList.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-[13px] text-hh-text">
                                <span className="text-hh-success mt-1">✓</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </Card>

                        {/* Don'ts */}
                        <Card className="p-4 bg-destructive/5 border-destructive/20">
                          <div className="flex items-center gap-2 mb-3">
                            <X className="w-4 h-4 text-destructive" />
                            <h4 className="text-[14px] text-destructive">Don'ts</h4>
                          </div>
                          <ul className="space-y-2">
                            {selectedTechnique.dontList.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-[13px] text-hh-text">
                                <span className="text-destructive mt-1">✕</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* Session History */}
                  {selectedTechnique.sessieHistory.length > 0 && (
                    <div>
                      <h3 className="text-[16px] leading-[24px] text-hh-text mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-hh-primary" />
                        Sessie geschiedenis ({selectedTechnique.sessieHistory.length})
                      </h3>
                      <div className="space-y-2">
                        {selectedTechnique.sessieHistory.map((session) => (
                          <Card
                            key={session.id}
                            className="p-4 border-hh-border hover:border-hh-primary/30 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div
                                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                    session.type === "video"
                                      ? "bg-hh-primary/10"
                                      : session.type === "chat"
                                      ? "bg-hh-warn/10"
                                      : "bg-hh-success/10"
                                  }`}
                                >
                                  {session.type === "video" ? (
                                    <VideoIcon className="w-5 h-5 text-hh-primary" />
                                  ) : session.type === "chat" ? (
                                    <MessageSquare className="w-5 h-5 text-hh-warn" />
                                  ) : (
                                    <Play className="w-5 h-5 text-hh-success" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="text-[14px] text-hh-text">
                                    {session.datum} • {session.tijd}
                                  </p>
                                  <p className="text-[12px] text-hh-muted">{session.duration}</p>
                                </div>
                              </div>
                              {session.score && (
                                <Badge className={getScoreBadgeColor(session.score)}>
                                  {session.score}%
                                </Badge>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State for Sessions */}
                  {selectedTechnique.sessieHistory.length === 0 &&
                    selectedTechnique.status !== "locked" && (
                      <Card className="p-8 text-center border-dashed border-2 border-hh-border bg-hh-ui-50">
                        <Clock className="w-12 h-12 text-hh-muted mx-auto mb-3" />
                        <h4 className="text-[16px] text-hh-text mb-2">Nog geen sessies</h4>
                        <p className="text-[14px] text-hh-muted">
                          Start nu met een video, chat of roleplay om je voortgang te zien
                        </p>
                      </Card>
                    )}
                </div>
              </div>

              {/* Action Footer - Fixed */}
              <div className="p-6 border-t border-hh-border bg-hh-ui-50">
                <h3 className="text-[14px] text-hh-text mb-3">Start een sessie</h3>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={() => {
                      setDetailsOpen(false);
                      navigate?.("roleplays");
                    }}
                    className="gap-2 flex-col h-auto py-3"
                    disabled={selectedTechnique.status === "locked"}
                  >
                    <Play className="w-5 h-5" />
                    <span className="text-[12px]">Rollenspel</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailsOpen(false);
                      navigate?.("videos");
                    }}
                    className="gap-2 flex-col h-auto py-3"
                    disabled={selectedTechnique.status === "locked"}
                  >
                    <VideoIcon className="w-5 h-5" />
                    <span className="text-[12px]">Video cursus</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailsOpen(false);
                      navigate?.("live");
                    }}
                    className="gap-2 flex-col h-auto py-3"
                    disabled={selectedTechnique.status === "locked"}
                  >
                    <Radio className="w-5 h-5" />
                    <span className="text-[12px]">Live coaching</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}