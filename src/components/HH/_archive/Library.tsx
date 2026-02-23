import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { EPICSalesFlow } from "./EPICSalesFlow";
import {
  Search,
  Filter,
  TrendingUp,
  Clock,
  Users,
  Star,
  Plus,
  Play,
  Trash2,
  X,
  BookOpen,
  Grid3x3,
  List,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { useState } from "react";

type ScenarioCategory = "all" | "discovery" | "objections" | "closing" | "custom";
type ScenarioLevel = "all" | "beginner" | "intermediate" | "advanced";
type ViewMode = "grid" | "list";
type SortField = "title" | "category" | "level" | "duration" | "completions" | "avgScore";
type SortDirection = "asc" | "desc" | null;

interface Scenario {
  id: string;
  title: string;
  category: string;
  level: string;
  duration: string;
  description: string;
  techniques: string[];
  completions: number;
  avgScore: number;
  isCustom?: boolean;
  isFeatured?: boolean;
}

interface LibraryProps {
  navigate?: (page: string) => void;
}

export function Library({ navigate }: LibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<ScenarioCategory>("all");
  const [level, setLevel] = useState<ScenarioLevel>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const scenarios: Scenario[] = [
    {
      id: "1",
      title: "Discovery call - SaaS enterprise",
      category: "Discovery",
      level: "Intermediate",
      duration: "8-10 min",
      description: "Oefen E.P.I.C vragen met een CTO van een enterprise SaaS bedrijf. Focus op technische en businesswaarde.",
      techniques: ["E.P.I.C", "Discovery", "Active Listening"],
      completions: 1247,
      avgScore: 78,
      isFeatured: true,
    },
    {
      id: "2",
      title: "Budget bezwaar - Prijsonderhandeling",
      category: "Objections",
      level: "Advanced",
      duration: "6-8 min",
      description: '"Het budget is op voor dit kwartaal" — leer waarde te tonen en urgentie te creëren zonder discount.',
      techniques: ["Objection Handling", "Value Selling", "Urgency"],
      completions: 892,
      avgScore: 72,
      isFeatured: true,
    },
    {
      id: "3",
      title: "Cold call - SMB owner",
      category: "Discovery",
      level: "Beginner",
      duration: "5-7 min",
      description: "Eerste contact met een drukke eigenaar van een klein bedrijf. Krijg binnen 2 minuten interesse.",
      techniques: ["Discovery", "Value Proposition", "Next Steps"],
      completions: 2134,
      avgScore: 81,
    },
    {
      id: "4",
      title: "Closing - Finale beslissing",
      category: "Closing",
      level: "Advanced",
      duration: "10-12 min",
      description: "Help de prospect de knoop doorhakken. Ze twijfelen tussen jou en concurrent — maak het verschil.",
      techniques: ["Closing", "Decision Making", "Next Steps"],
      completions: 564,
      avgScore: 69,
    },
    {
      id: "5",
      title: "Concurrentiebezwaar - We hebben al X",
      category: "Objections",
      level: "Intermediate",
      duration: "7-9 min",
      description: '"We werken al met concurrent X en zijn tevreden" — leer switchen mogelijk te maken zonder afkraken.',
      techniques: ["Objection Handling", "Challenger", "Differentiation"],
      completions: 1056,
      avgScore: 75,
    },
    {
      id: "6",
      title: "Multi-stakeholder meeting",
      category: "Discovery",
      level: "Advanced",
      duration: "12-15 min",
      description: "Gesprek met CFO, CTO en Head of Sales tegelijk. Elke stakeholder heeft andere prioriteiten.",
      techniques: ["Discovery", "Stakeholder Management", "E.P.I.C"],
      completions: 412,
      avgScore: 67,
      isFeatured: true,
    },
  ];

  const filteredScenarios = scenarios.filter((scenario) => {
    const matchesSearch =
      searchQuery === "" ||
      scenario.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory =
      category === "all" || scenario.category.toLowerCase() === category;
    
    const matchesLevel =
      level === "all" || scenario.level.toLowerCase() === level;

    return matchesSearch && matchesCategory && matchesLevel;
  });

  // Sort scenarios
  const sortedScenarios = [...filteredScenarios].sort((a, b) => {
    if (!sortField || !sortDirection) return 0;

    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    // Handle duration comparison (convert to minutes)
    if (sortField === "duration") {
      const getDurationMinutes = (dur: string) => {
        const match = dur.match(/(\d+)-(\d+)/);
        if (match) {
          return (parseInt(match[1]) + parseInt(match[2])) / 2;
        }
        return 0;
      };
      aValue = getDurationMinutes(a.duration);
      bValue = getDurationMinutes(b.duration);
    }

    // String comparison
    if (typeof aValue === "string") {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const featuredScenarios = sortedScenarios.filter((s) => s.isFeatured);
  const regularScenarios = sortedScenarios.filter((s) => !s.isFeatured);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <AppLayout currentPage="library" navigate={navigate}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="mb-2 text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[48px] lg:leading-[56px] font-normal">
              Scenario bibliotheek
            </h1>
            <p className="text-[14px] leading-[22px] sm:text-[16px] sm:leading-[24px] text-hh-muted">
              {filteredScenarios.length} scenario's — van discovery tot closing
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* View toggle */}
            <div className="flex items-center gap-1 p-1 bg-hh-ui-100 rounded-lg">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="h-8 w-8 p-0"
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="h-8 w-8 p-0"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            <Button 
              className="gap-2 flex-1 sm:flex-initial"
              onClick={() => navigate?.("builder")}
            >
              <Plus className="w-4 h-4" /> Maak custom scenario
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <Card className="p-4 sm:p-6 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek scenario's..."
                className="pl-10 bg-hh-ui-50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={category} onValueChange={(v) => setCategory(v as ScenarioCategory)}>
              <SelectTrigger>
                <SelectValue placeholder="Categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle categorieën</SelectItem>
                <SelectItem value="discovery">Discovery</SelectItem>
                <SelectItem value="objections">Objections</SelectItem>
                <SelectItem value="closing">Closing</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={(v) => setLevel(v as ScenarioLevel)}>
              <SelectTrigger>
                <SelectValue placeholder="Niveau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle niveaus</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Grid View */}
        {viewMode === "grid" && (
          <>
            {/* Featured Scenarios */}
            {featuredScenarios.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-hh-warn" />
                  <h3 className="text-[20px] leading-[28px] text-hh-text">
                    Aanbevolen door Hugo
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {featuredScenarios.map((scenario) => (
                    <ScenarioCard key={scenario.id} scenario={scenario} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}

            {/* All Scenarios */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-hh-primary" />
                <h3 className="text-[18px] leading-[26px] sm:text-[20px] sm:leading-[28px] text-hh-text">
                  Alle scenario's
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {regularScenarios.map((scenario) => (
                  <ScenarioCard key={scenario.id} scenario={scenario} navigate={navigate} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* List View */}
        {viewMode === "list" && filteredScenarios.length > 0 && (
          <div className="space-y-4">
            <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-hh-ui-50 border-b border-hh-border text-[14px] text-hh-muted">
                <button
                  onClick={() => handleSort("title")}
                  className="col-span-4 flex items-center gap-2 hover:text-hh-text transition-colors text-left"
                >
                  <span>Naam</span>
                  {sortField === "title" && sortDirection === "asc" && <ArrowUp className="w-3 h-3" />}
                  {sortField === "title" && sortDirection === "desc" && <ArrowDown className="w-3 h-3" />}
                  {sortField !== "title" && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                </button>
                <button
                  onClick={() => handleSort("category")}
                  className="col-span-2 flex items-center gap-2 hover:text-hh-text transition-colors text-left"
                >
                  <span>Categorie</span>
                  {sortField === "category" && sortDirection === "asc" && <ArrowUp className="w-3 h-3" />}
                  {sortField === "category" && sortDirection === "desc" && <ArrowDown className="w-3 h-3" />}
                  {sortField !== "category" && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                </button>
                <button
                  onClick={() => handleSort("level")}
                  className="col-span-2 flex items-center gap-2 hover:text-hh-text transition-colors text-left"
                >
                  <span>Niveau</span>
                  {sortField === "level" && sortDirection === "asc" && <ArrowUp className="w-3 h-3" />}
                  {sortField === "level" && sortDirection === "desc" && <ArrowDown className="w-3 h-3" />}
                  {sortField !== "level" && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                </button>
                <button
                  onClick={() => handleSort("duration")}
                  className="col-span-1 flex items-center gap-2 hover:text-hh-text transition-colors text-left"
                >
                  <span>Duur</span>
                  {sortField === "duration" && sortDirection === "asc" && <ArrowUp className="w-3 h-3" />}
                  {sortField === "duration" && sortDirection === "desc" && <ArrowDown className="w-3 h-3" />}
                  {sortField !== "duration" && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                </button>
                <button
                  onClick={() => handleSort("completions")}
                  className="col-span-1 flex items-center gap-2 hover:text-hh-text transition-colors text-left"
                >
                  <span>Tries</span>
                  {sortField === "completions" && sortDirection === "asc" && <ArrowUp className="w-3 h-3" />}
                  {sortField === "completions" && sortDirection === "desc" && <ArrowDown className="w-3 h-3" />}
                  {sortField !== "completions" && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                </button>
                <button
                  onClick={() => handleSort("avgScore")}
                  className="col-span-1 flex items-center gap-2 hover:text-hh-text transition-colors text-left"
                >
                  <span>Score</span>
                  {sortField === "avgScore" && sortDirection === "asc" && <ArrowUp className="w-3 h-3" />}
                  {sortField === "avgScore" && sortDirection === "desc" && <ArrowDown className="w-3 h-3" />}
                  {sortField !== "avgScore" && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                </button>
                <div className="col-span-1"></div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-hh-border">
                {sortedScenarios.map((scenario) => (
                  <ScenarioListRow key={scenario.id} scenario={scenario} navigate={navigate} />
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Empty state */}
        {filteredScenarios.length === 0 && (
          <Card className="p-12 rounded-[16px] shadow-hh-sm border-hh-border text-center">
            <Search className="w-12 h-12 text-hh-muted mx-auto mb-4" />
            <h3 className="text-[20px] leading-[28px] text-hh-text mb-2">
              Geen matches
            </h3>
            <p className="text-[16px] leading-[24px] text-hh-muted mb-6">
              Reset filters of bouw je eigen scenario — precies op jouw situatie
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setCategory("all");
                  setLevel("all");
                  setSearchQuery("");
                }}
              >
                Reset filters
              </Button>
              <Button onClick={() => navigate?.("builder")}>
                Maak custom scenario
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function ScenarioCard({ scenario, navigate }: { scenario: Scenario; navigate?: (page: string) => void }) {
  return (
    <Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-hh-md transition-all group cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <Badge variant="outline" className="text-[12px]">
          {scenario.category}
        </Badge>
        {scenario.isFeatured && (
          <Star className="w-4 h-4 text-hh-warn fill-hh-warn" />
        )}
      </div>

      <h3 className="text-[18px] leading-[26px] text-hh-text mb-2">
        {scenario.title}
      </h3>

      <p className="text-[14px] leading-[20px] text-hh-muted mb-4">
        {scenario.description}
      </p>

      {/* Techniques */}
      <div className="flex flex-wrap gap-1 mb-4">
        {scenario.techniques.map((tech, idx) => (
          <Badge
            key={idx}
            variant="secondary"
            className="text-[10px] bg-hh-ui-100"
          >
            {tech}
          </Badge>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 text-[14px] leading-[20px] text-hh-muted">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{scenario.duration}</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          <span>{scenario.completions}</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          <span>{scenario.avgScore}% avg</span>
        </div>
      </div>

      {/* Level badge */}
      <div className="flex items-center justify-between">
        <Badge
          className={
            scenario.level === "Beginner"
              ? "bg-hh-success/10 text-hh-success border-hh-success/20"
              : scenario.level === "Intermediate"
              ? "bg-hh-warn/10 text-hh-warn border-hh-warn/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }
        >
          {scenario.level}
        </Badge>
        <Button 
          size="sm" 
          className="gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => navigate?.("roleplays")}
        >
          <Play className="w-3 h-3" /> Start
        </Button>
      </div>
    </Card>
  );
}

function ScenarioListRow({ scenario, navigate }: { scenario: Scenario; navigate?: (page: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 p-4 hover:bg-hh-ui-50 transition-colors group cursor-pointer">
      {/* Mobile layout */}
      <div className="md:hidden space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[16px] leading-[24px] text-hh-text">
                {scenario.title}
              </h3>
              {scenario.isFeatured && (
                <Star className="w-3 h-3 text-hh-warn fill-hh-warn flex-shrink-0" />
              )}
            </div>
            <p className="text-[14px] leading-[20px] text-hh-muted line-clamp-2">
              {scenario.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[12px]">
            {scenario.category}
          </Badge>
          <Badge
            className={
              scenario.level === "Beginner"
                ? "bg-hh-success/10 text-hh-success border-hh-success/20 text-[12px]"
                : scenario.level === "Intermediate"
                ? "bg-hh-warn/10 text-hh-warn border-hh-warn/20 text-[12px]"
                : "bg-destructive/10 text-destructive border-destructive/20 text-[12px]"
            }
          >
            {scenario.level}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-[14px] text-hh-muted">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{scenario.duration}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{scenario.completions}</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>{scenario.avgScore}%</span>
            </div>
          </div>
          <Button 
            size="sm" 
            className="gap-2 h-8"
            onClick={() => navigate?.("roleplays")}
          >
            <Play className="w-3 h-3" /> Start
          </Button>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:contents">
        {/* Title */}
        <div className="col-span-4 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] leading-[24px] text-hh-text truncate">
              {scenario.title}
            </h3>
            <p className="text-[14px] leading-[20px] text-hh-muted truncate">
              {scenario.description}
            </p>
          </div>
          {scenario.isFeatured && (
            <Star className="w-3 h-3 text-hh-warn fill-hh-warn flex-shrink-0" />
          )}
        </div>

        {/* Category */}
        <div className="col-span-2 flex items-center">
          <Badge variant="outline" className="text-[12px]">
            {scenario.category}
          </Badge>
        </div>

        {/* Level */}
        <div className="col-span-2 flex items-center">
          <Badge
            className={
              scenario.level === "Beginner"
                ? "bg-hh-success/10 text-hh-success border-hh-success/20 text-[12px]"
                : scenario.level === "Intermediate"
                ? "bg-hh-warn/10 text-hh-warn border-hh-warn/20 text-[12px]"
                : "bg-destructive/10 text-destructive border-destructive/20 text-[12px]"
            }
          >
            {scenario.level}
          </Badge>
        </div>

        {/* Duration */}
        <div className="col-span-1 flex items-center text-[14px] text-hh-muted">
          {scenario.duration}
        </div>

        {/* Completions */}
        <div className="col-span-1 flex items-center text-[14px] text-hh-muted">
          {scenario.completions}
        </div>

        {/* Avg Score */}
        <div className="col-span-1 flex items-center text-[14px] text-hh-muted">
          {scenario.avgScore}%
        </div>

        {/* Action */}
        <div className="col-span-1 flex items-center justify-end">
          <Button 
            size="sm" 
            className="gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => navigate?.("roleplays")}
          >
            <Play className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}