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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Search,
  List,
  LayoutGrid,
  Play,
  Star,
  Clock,
  Users,
  TrendingUp,
  MoreVertical,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { getAllTechnieken, getFaseNaam } from "../../data/technieken-service";
import { getCodeBadgeColors } from "../../utils/phaseColors";

interface RolePlayOverviewProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
}

interface Scenario {
  id: number;
  title: string;
  description: string;
  category: string;
  fase: string;
  techniqueNumbers: string[];
  tags: string[];
  duration: string;
  plays: number;
  avgScore: number;
  isFavorite: boolean;
  difficulty: "Beginner" | "Gemiddeld" | "Gevorderd";
}

export function RolePlayOverview({ navigate, isAdmin }: RolePlayOverviewProps) {
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [sortField, setSortField] = useState<"title" | "plays" | "score" | null>("plays");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const scenarios: Scenario[] = useMemo(() => {
    const allTechnieken = getAllTechnieken().filter(t => !t.is_fase);
    const seedFromString = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
      }
      return Math.abs(hash);
    };

    const categories = ["Discovery", "Objections", "Closing", "Opening", "Value Selling"];
    const difficulties: ("Beginner" | "Gemiddeld" | "Gevorderd")[] = ["Beginner", "Gemiddeld", "Gevorderd"];
    const tagOptions = [
      ["E.P.I.C", "Discovery", "Active Listening"],
      ["Objection Handling", "Value Selling", "Urgency"],
      ["Discovery", "Stakeholder Management", "E.P.I.C"],
      ["Closing", "Negotiation", "Trust Building"],
      ["Opening", "Rapport", "First Impressions"],
    ];

    const scenarioTemplates = [
      { title: "Discovery call - SaaS enterprise", desc: "Oefen E.P.I.C vragen met een CTO van een enterprise SaaS bedrijf. Focus op technische en businesswaarde." },
      { title: "Budget bezwaar - Prijsonderhandeling", desc: '"Het budget is op voor dit kwartaal" — leer waarde te tonen en urgentie te creëren zonder discount.' },
      { title: "Multi-stakeholder meeting", desc: "Gesprek met CFO, CTO en Head of Sales tegelijk. Elke stakeholder heeft andere prioriteiten." },
      { title: "Cold call - IT Manager", desc: "Een koude bel naar een IT Manager. Bouw rapport en kwalificeer de lead in 5 minuten." },
      { title: "Demo follow-up", desc: "De prospect heeft een demo gehad maar reageert niet meer. Win het gesprek terug." },
      { title: "Contract renewal", desc: "Een bestaande klant wil niet verlengen. Ontdek waarom en los het op." },
    ];

    return scenarioTemplates.map((template, idx) => {
      const seed = seedFromString(template.title);
      const techIdx = seed % allTechnieken.length;
      const tech = allTechnieken[techIdx];
      
      return {
        id: idx + 1,
        title: template.title,
        description: template.desc,
        category: categories[seed % categories.length],
        fase: getFaseNaam(tech?.fase || "2"),
        techniqueNumbers: [tech?.nummer || "2.1.1", allTechnieken[(techIdx + 1) % allTechnieken.length]?.nummer || "2.1.2"],
        tags: tagOptions[seed % tagOptions.length],
        duration: `${6 + (seed % 10)}-${10 + (seed % 8)} min`,
        plays: 100 + (seed % 1200),
        avgScore: 60 + (seed % 30),
        isFavorite: seed % 3 === 0,
        difficulty: difficulties[seed % difficulties.length],
      };
    });
  }, []);

  const handleSort = (field: "title" | "plays" | "score") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "title" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortField !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-hh-muted/40" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-hh-ink" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-hh-ink" />
    );
  };

  const filteredScenarios = scenarios.filter((scenario) => {
    const matchesSearch = searchQuery === "" ||
      scenario.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === "all" || scenario.category === categoryFilter;
    const matchesDifficulty = difficultyFilter === "all" || scenario.difficulty.toLowerCase() === difficultyFilter;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const sortedScenarios = [...filteredScenarios].sort((a, b) => {
    if (!sortField) return 0;
    let comparison = 0;
    switch (sortField) {
      case "title":
        comparison = a.title.localeCompare(b.title);
        break;
      case "plays":
        comparison = a.plays - b.plays;
        break;
      case "score":
        comparison = a.avgScore - b.avgScore;
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const totalPlays = scenarios.reduce((sum, s) => sum + s.plays, 0);
  const avgScore = Math.round(scenarios.reduce((sum, s) => sum + s.avgScore, 0) / scenarios.length);
  const favorites = scenarios.filter(s => s.isFavorite).length;

  return (
    <AppLayout currentPage="roleplay" navigate={navigate} isAdmin={isAdmin}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Scenario bibliotheek
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              {scenarios.length} scenario's — van discovery tot closing
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-ink/10 flex items-center justify-center">
                <Play className="w-4 h-4 sm:w-5 sm:h-5 text-hh-ink" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-hh-success/10 text-hh-success border-hh-success/20"
              >
                +12
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Scenario's
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {scenarios.length}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-hh-primary" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-hh-success/10 text-hh-success border-hh-success/20"
              >
                +234
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Totaal gespeeld
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {totalPlays.toLocaleString()}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-success/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-hh-success" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-hh-success/10 text-hh-success border-hh-success/20"
              >
                +5%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Gem. Score
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {avgScore}%
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Star className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Favorieten
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {favorites}
            </p>
          </Card>
        </div>

        {/* Filters & Search */}
        <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek scenario's..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Alle categorieën" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle categorieën</SelectItem>
                <SelectItem value="Discovery">Discovery</SelectItem>
                <SelectItem value="Objections">Objections</SelectItem>
                <SelectItem value="Closing">Closing</SelectItem>
                <SelectItem value="Opening">Opening</SelectItem>
                <SelectItem value="Value Selling">Value Selling</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Alle niveaus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle niveaus</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="gemiddeld">Gemiddeld</SelectItem>
                <SelectItem value="gevorderd">Gevorderd</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={`${
                  viewMode === "list" 
                    ? "bg-hh-primary text-white hover:bg-hh-primary/90" 
                    : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"
                }`}
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`${
                  viewMode === "grid" 
                    ? "bg-hh-primary text-white hover:bg-hh-primary/90" 
                    : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"
                }`}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>


        {/* Grid View (Default) */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedScenarios.map((scenario) => (
              <Card
                key={scenario.id}
                className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden hover:shadow-hh-md hover:border-hh-ink/30 transition-all"
              >
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <Badge
                      variant="outline"
                      className="text-[11px] bg-hh-ink/10 text-hh-ink border-hh-ink/20"
                    >
                      {scenario.category}
                    </Badge>
                    {scenario.isFavorite && (
                      <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                    )}
                  </div>

                  <div>
                    <h3 className="text-[18px] leading-[24px] text-hh-text font-semibold mb-2">
                      {scenario.title}
                    </h3>
                    <p className="text-[14px] leading-[20px] text-hh-muted line-clamp-2">
                      {scenario.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {scenario.tags.map((tag, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-[11px] bg-hh-ui-50 text-hh-muted border-hh-border"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[13px] text-hh-muted pt-3 border-t border-hh-border">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>{scenario.duration}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      <span>{scenario.plays.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" />
                      <span>{scenario.avgScore}% avg</span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="w-4 h-4 mr-2" />
                          Bekijk details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate?.("roleplay")}>
                          <Play className="w-4 h-4 mr-2" />
                          Start oefening
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hh-ui-50">
                  <tr>
                    <th 
                      className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-text font-semibold cursor-pointer hover:bg-hh-ui-100 transition-colors select-none"
                      onClick={() => handleSort("title")}
                    >
                      <div className="flex items-center gap-1.5">
                        Scenario
                        <SortIcon column="title" />
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-text font-semibold">
                      Categorie
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-text font-semibold">
                      Niveau
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-text font-semibold">
                      Duur
                    </th>
                    <th 
                      className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-text font-semibold cursor-pointer hover:bg-hh-ui-100 transition-colors select-none"
                      onClick={() => handleSort("plays")}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        Gespeeld
                        <SortIcon column="plays" />
                      </div>
                    </th>
                    <th 
                      className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-text font-semibold cursor-pointer hover:bg-hh-ui-100 transition-colors select-none"
                      onClick={() => handleSort("score")}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        Gem. Score
                        <SortIcon column="score" />
                      </div>
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-text font-semibold">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedScenarios.map((scenario, index) => (
                    <tr
                      key={scenario.id}
                      className={`border-t border-hh-border hover:bg-hh-ui-50 transition-colors cursor-pointer ${
                        index % 2 === 0 ? "bg-hh-bg" : "bg-hh-ui-50/30"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {scenario.isFavorite && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                          <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                            {scenario.title}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="text-[11px] bg-hh-ink/10 text-hh-ink border-hh-ink/20"
                        >
                          {scenario.category}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="text-[11px] bg-hh-primary/10 text-hh-primary border-hh-primary/20"
                        >
                          {scenario.difficulty}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-[14px] text-hh-muted">
                        {scenario.duration}
                      </td>
                      <td className="py-3 px-4 text-right text-[14px] text-hh-text">
                        {scenario.plays.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-[14px] leading-[20px] text-hh-success font-medium">
                          {scenario.avgScore}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              Bekijk details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate?.("roleplay")}>
                              <Play className="w-4 h-4 mr-2" />
                              Start oefening
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
