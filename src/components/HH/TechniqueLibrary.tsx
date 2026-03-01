// NOTE: KPI cards en video counts gebruiken mock data (generateMockStats)
// Echte data wordt later gekoppeld via user_progress en videos tabellen

import { useState, useEffect } from "react";
import { useMobileViewMode } from "../../hooks/useMobileViewMode";
import { AppLayout } from "./AppLayout";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
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
  Video,
  Play,
  Award,
  TrendingUp,
  MoreVertical,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  MessageCircle,
  Radio,
} from "lucide-react";
import { TechniqueDetailsDialog } from "./TechniqueDetailsDialog";
import { PageFooter } from "./PageFooter";
import { getAllTechnieken, getTechniekenByFase } from "../../data/technieken-service";
import { videoApi } from "../../services/videoApi";

interface TechniqueLibraryProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
  onboardingMode?: boolean;
}

export function TechniqueLibrary({ navigate, isAdmin, onboardingMode }: TechniqueLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFase, setActiveFase] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useMobileViewMode("grid", "list");
  const [sortBy, setSortBy] = useState<"code" | "name" | "videos" | "roleplays" | "score">("code");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedTechnique, setSelectedTechnique] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [realVideoCount, setRealVideoCount] = useState<number | null>(null);

  useEffect(() => {
    videoApi.getLibrary('ready').then(videos => {
      setRealVideoCount(videos.length);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const storedTechniqueNumber = localStorage.getItem('selectedTechniqueNumber');
    if (storedTechniqueNumber) {
      localStorage.removeItem('selectedTechniqueNumber');
      const allTechnieken = getAllTechnieken();
      const technique = allTechnieken.find(t => t.nummer === storedTechniqueNumber);
      if (technique) {
        setSelectedTechnique(technique);
        setDetailsDialogOpen(true);
      }
    }
  }, []);

  const handleSort = (column: "code" | "name" | "videos" | "roleplays" | "score") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder(column === "code" || column === "name" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-hh-muted/40" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-hh-ink" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-hh-ink" />
    );
  };

  const generateMockStats = (techniqueNumber: string) => {
    const hash = techniqueNumber.split('.').reduce((acc, num) => acc + parseInt(num || '0', 10), 0);
    return {
      videos: 2 + (hash % 4),
      roleplays: 150 + (hash * 50),
      avgScore: 74 + (hash % 15),
      completion: 79 + (hash % 13),
      status: "Actief" as const,
    };
  };

  const technieken = {
    "fase-0": getTechniekenByFase("0", true).map((tech, idx) => ({
      id: idx + 1,
      code: tech.nummer,
      name: tech.naam,
      is_fase: tech.is_fase,
      ...generateMockStats(tech.nummer),
    })),
    "fase-1": getTechniekenByFase("1", true).map((tech, idx) => ({
      id: idx + 10,
      code: tech.nummer,
      name: tech.naam,
      is_fase: tech.is_fase,
      ...generateMockStats(tech.nummer),
    })),
    "fase-2": getTechniekenByFase("2", true).map((tech, idx) => ({
      id: idx + 20,
      code: tech.nummer,
      name: tech.naam,
      is_fase: tech.is_fase,
      ...generateMockStats(tech.nummer),
    })),
    "fase-3": getTechniekenByFase("3", true).map((tech, idx) => ({
      id: idx + 40,
      code: tech.nummer,
      name: tech.naam,
      is_fase: tech.is_fase,
      ...generateMockStats(tech.nummer),
    })),
    "fase-4": getTechniekenByFase("4", true).map((tech, idx) => ({
      id: idx + 50,
      code: tech.nummer,
      name: tech.naam,
      is_fase: tech.is_fase,
      ...generateMockStats(tech.nummer),
    })),
  };

  const currentTechnieken = activeFase === "all" ? Object.values(technieken).flat() : technieken[activeFase as keyof typeof technieken];

  const sortedTechnieken = [...currentTechnieken].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "code":
        comparison = a.code.localeCompare(b.code);
        break;
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "videos":
        comparison = a.videos - b.videos;
        break;
      case "roleplays":
        comparison = a.roleplays - b.roleplays;
        break;
      case "score":
        comparison = a.avgScore - b.avgScore;
        break;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const filteredTechnieken = sortedTechnieken.filter((tech) =>
    tech.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tech.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout currentPage="techniques" navigate={navigate} isAdmin={isAdmin} onboardingMode={onboardingMode}>
      <div className="p-3 sm:p-4 lg:p-6 space-y-4">
        {/* Header with compact KPI cards on the right */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2">
          <div>
            <h1 className="text-[28px] leading-[36px] text-hh-text mb-1">
              E.P.I.C. TECHNIQUE
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              {Object.values(technieken).reduce((sum, arr) => sum + arr.length, 0)} E.P.I.C. TECHNIQUE verdeeld over 5 fases
            </p>
          </div>
          
          {/* Compact KPI Cards - right aligned */}
          <div className="flex gap-2 flex-wrap lg:flex-nowrap">
            <div className="flex items-center gap-2 px-3 py-2 bg-hh-bg rounded-lg border border-hh-border shadow-sm">
              <div className="w-6 h-6 rounded-full bg-hh-ink/10 flex items-center justify-center">
                <Award className="w-3 h-3 text-hh-ink" />
              </div>
              <div>
                <p className="text-[10px] text-hh-muted leading-none">Technieken</p>
                <p className="text-[14px] font-semibold text-hh-ink leading-tight">{Object.values(technieken).reduce((sum, arr) => sum + arr.length, 0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-hh-bg rounded-lg border border-hh-border shadow-sm">
              <div className="w-6 h-6 rounded-full bg-hh-ink/10 flex items-center justify-center">
                <Video className="w-3 h-3 text-hh-ink" />
              </div>
              <div>
                <p className="text-[10px] text-hh-muted leading-none">Video's</p>
                <p className="text-[14px] font-semibold text-hh-ink leading-tight">{realVideoCount ?? Object.values(technieken).reduce((sum, arr) => sum + arr.reduce((s, t) => s + (t.videos || 0), 0), 0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-hh-bg rounded-lg border border-hh-border shadow-sm">
              <div className="w-6 h-6 rounded-full bg-[#3d9a6e]/10 flex items-center justify-center">
                <TrendingUp className="w-3 h-3" style={{ color: '#3d9a6e' }} />
              </div>
              <div>
                <p className="text-[10px] text-hh-muted leading-none">Voortgang</p>
                <p className="text-[14px] font-semibold text-hh-ink leading-tight">12%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Banner - exact zoals Webinars */}
        <div className="relative overflow-hidden rounded-2xl h-[200px] sm:h-[240px] dark:ring-1 dark:ring-white/10">
          {/* Background Image - Hugo */}
          <img 
            src="/images/Hugo-Herbots-WEB-0281.JPG"
            alt="Hugo Herbots E.P.I.C. TECHNIQUE"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: '50% 30%' }}
          />
          {/* Gradient overlay - dark to light from left */}
          <div className="absolute inset-0 bg-gradient-to-r from-hh-ink via-hh-ink/80 to-transparent" />
          <div className="absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-none" />
          
          {/* Content */}
          <div className="relative h-full flex items-center p-6 sm:p-8">
            <div className="text-white space-y-3 max-w-lg">
              {/* Green accent badge */}
              <Badge className="text-white border-0" style={{ backgroundColor: '#3d9a6e' }}>
                <Award className="w-3 h-3 mr-1" />
                54 E.P.I.C. TECHNIQUE
              </Badge>
              
              <h2 className="text-[24px] sm:text-[32px] font-bold leading-tight">
                Master de Sales Cyclus
              </h2>
              
              <p className="text-white/70 text-[14px] leading-relaxed line-clamp-2">
                Ontdek alle technieken van de 5 fases en word een top verkoper.
              </p>
              
              <div className="flex flex-wrap gap-3 pt-1">
                <button 
                  className="inline-flex items-center gap-2 h-9 px-4 py-2 rounded-md text-sm font-medium text-white border border-white/30 transition-colors cursor-pointer"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.color = '#1C2535'; e.currentTarget.style.borderColor = '#ffffff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                  onFocus={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.color = '#1C2535'; e.currentTarget.style.borderColor = '#ffffff'; }}
                  onBlur={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                  onClick={() => navigate?.("videos")}
                >
                  <Play className="w-4 h-4" />
                  Bekijk Video's
                </button>
                <Button 
                  className="gap-2 border-0"
                  style={{ backgroundColor: '#3d9a6e' }}
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = '#4daa7e'}
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = '#3d9a6e'}
                  onClick={() => navigate?.("talk-to-hugo")}
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat met Hugo
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Search, View Toggle & Filters Card */}
        <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek technieken..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={activeFase} onValueChange={setActiveFase}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Alle Fases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Fases</SelectItem>
                  <SelectItem value="fase-0">Fase 0 - Pre-contactfase</SelectItem>
                  <SelectItem value="fase-1">Fase 1 - Openingsfase</SelectItem>
                  <SelectItem value="fase-2">Fase 2 - Ontdekkingsfase</SelectItem>
                  <SelectItem value="fase-3">Fase 3 - Aanbevelingsfase</SelectItem>
                  <SelectItem value="fase-4">Fase 4 - Beslissingsfase</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="actief">Actief</SelectItem>
                  <SelectItem value="concept">Concept</SelectItem>
                  <SelectItem value="archief">Archief</SelectItem>
                </SelectContent>
              </Select>
              <div className="hidden sm:flex gap-1">
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
          </div>
        </Card>

        {/* Mobile Card List View */}
        {viewMode === "list" && (
          <div className="sm:hidden space-y-2">
            {filteredTechnieken.map((techniek) => (
              <div
                key={`mobile-${techniek.code}-${techniek.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-hh-bg border border-hh-border hover:border-hh-text/20 cursor-pointer transition-colors"
                onClick={() => {
                  const allTech = getAllTechnieken();
                  const fullTech = allTech.find(t => t.nummer === techniek.code);
                  if (fullTech) {
                    setSelectedTechnique({
                      nummer: fullTech.nummer,
                      naam: fullTech.naam,
                      fase: fullTech.fase,
                      tags: fullTech.tags,
                      themas: fullTech.themas,
                      doel: fullTech.doel,
                      wat: fullTech.wat,
                      waarom: fullTech.waarom,
                      wanneer: fullTech.wanneer,
                      hoe: fullTech.hoe,
                      verkoper_intentie: fullTech.verkoper_intentie,
                      context_requirements: fullTech.context_requirements,
                      stappenplan: fullTech.stappenplan,
                      voorbeeld: fullTech.voorbeeld,
                    });
                    setIsEditMode(false);
                    setDetailsDialogOpen(true);
                  }
                }}
              >
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[12px] font-mono font-semibold flex-shrink-0">
                  {techniek.code}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-hh-text leading-tight line-clamp-1">{techniek.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-hh-muted flex items-center gap-0.5"><Video className="w-3 h-3" /> {techniek.videos}</span>
                    <span className="text-[11px] text-hh-muted">•</span>
                    <span className="text-[11px] text-hh-success font-medium">{techniek.avgScore}%</span>
                  </div>
                </div>
                <Badge className={`text-[9px] px-1.5 py-0 flex-shrink-0 ${techniek.status === 'Actief' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : techniek.status === 'Concept' ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' : 'bg-hh-ui-50 text-hh-muted'} border-0`}>
                  {techniek.status}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* List View - Table */}
        {viewMode === "list" && (
          <Card className="hidden sm:block rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hh-ui-50 border-b border-hh-border">
                  <tr>
                    <th 
                      className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:bg-hh-ui-100 transition-colors select-none"
                      onClick={() => handleSort("code")}
                    >
                      <div className="flex items-center gap-1.5">
                        #
                        <SortIcon column="code" />
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:bg-hh-ui-100 transition-colors select-none"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-1.5">
                        Techniek
                        <SortIcon column="name" />
                      </div>
                    </th>
                    <th 
                      className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:bg-hh-ui-100 transition-colors select-none"
                      onClick={() => handleSort("videos")}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        Video's
                        <SortIcon column="videos" />
                      </div>
                    </th>
                    <th 
                      className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:bg-hh-ui-100 transition-colors select-none"
                      onClick={() => handleSort("roleplays")}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        Role-Plays
                        <SortIcon column="roleplays" />
                      </div>
                    </th>
                    <th 
                      className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:bg-hh-ui-100 transition-colors select-none"
                      onClick={() => handleSort("score")}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        Avg Score
                        <SortIcon column="score" />
                      </div>
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Completion
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTechnieken.map((techniek, index) => (
                    <tr
                      key={`${techniek.code}-${techniek.id}`}
                      className={`border-t border-hh-border hover:bg-hh-ui-50 transition-colors cursor-pointer ${
                        index % 2 === 0 ? "bg-hh-bg" : "bg-hh-ui-50/30"
                      }`}
                      onClick={() => {
                        const allTech = getAllTechnieken();
                        const fullTech = allTech.find(t => t.nummer === techniek.code);
                        if (fullTech) {
                          setSelectedTechnique({
                            nummer: fullTech.nummer,
                            naam: fullTech.naam,
                            fase: fullTech.fase,
                            tags: fullTech.tags,
                            themas: fullTech.themas,
                            doel: fullTech.doel,
                            wat: fullTech.wat,
                            waarom: fullTech.waarom,
                            wanneer: fullTech.wanneer,
                            hoe: fullTech.hoe,
                            verkoper_intentie: fullTech.verkoper_intentie,
                            context_requirements: fullTech.context_requirements,
                            stappenplan: fullTech.stappenplan,
                            voorbeeld: fullTech.voorbeeld,
                          });
                          setIsEditMode(false);
                          setDetailsDialogOpen(true);
                        }
                      }}
                    >
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[12px] font-mono font-semibold">
                          {techniek.code}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                          {techniek.name}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1 text-[14px] leading-[20px] text-hh-text">
                          <Video className="w-3.5 h-3.5 text-hh-ink" />
                          {techniek.videos}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1 text-[14px] leading-[20px] text-hh-text">
                          <Play className="w-3.5 h-3.5 text-blue-600" />
                          {techniek.roleplays}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-[14px] leading-[20px] text-hh-success font-medium">
                          {techniek.avgScore}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-[14px] leading-[20px] text-hh-text">
                          {techniek.completion}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className="bg-hh-success/10 text-hh-success border-hh-success/20 text-[11px]">
                          {techniek.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              localStorage.setItem('filterTechniek', techniek.code);
                              localStorage.setItem('autoPlayFirstVideo', 'true');
                              navigate?.("videos");
                            }}>
                              <Video className="w-4 h-4 mr-2" />
                              Bekijk Video's
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate?.("roleplay")}>
                              <Play className="w-4 h-4 mr-2" />
                              Bekijk Role-Plays
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <TrendingUp className="w-4 h-4 mr-2" />
                              Analytics
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const allTech = getAllTechnieken();
                                const fullTech = allTech.find(t => t.nummer === techniek.code);
                                if (fullTech) {
                                  setSelectedTechnique({
                                    nummer: fullTech.nummer,
                                    naam: fullTech.naam,
                                    fase: fullTech.fase,
                                    tags: fullTech.tags,
                                    themas: fullTech.themas,
                                    doel: fullTech.doel,
                                    wat: fullTech.wat,
                                    waarom: fullTech.waarom,
                                    wanneer: fullTech.wanneer,
                                    hoe: fullTech.hoe,
                                    verkoper_intentie: fullTech.verkoper_intentie,
                                    context_requirements: fullTech.context_requirements,
                                    stappenplan: fullTech.stappenplan,
                                    voorbeeld: fullTech.voorbeeld,
                                  });
                                  setIsEditMode(false);
                                  setDetailsDialogOpen(true);
                                }
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Bekijk details
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

        {/* Card View - Netflix-style Grid */}
        {viewMode === "grid" && filteredTechnieken.length === 0 && (
          <div className="text-center py-8 text-hh-muted">
            Geen technieken gevonden
          </div>
        )}
        {viewMode === "grid" && filteredTechnieken.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-8">
            {filteredTechnieken.map((techniek) => {
              const getPhaseImage = (code: string) => {
                const phase = code.split('.')[0];
                const images: Record<string, string> = {
                  '0': '/images/Hugo-Herbots-WEB-0350.JPG',
                  '1': '/images/Hugo-Herbots-WEB-0119.JPG',
                  '2': '/images/Hugo-Herbots-WEB-0244.JPG',
                  '3': '/images/Hugo-Herbots-WEB-0281.JPG',
                  '4': '/images/Hugo-Herbots-WEB-0399.JPG',
                };
                return images[phase] || '/images/Hugo-Herbots-WEB-0350.JPG';
              };
              
              return (
                <div 
                  key={techniek.code}
                  className="group relative rounded-[16px] overflow-hidden cursor-pointer shadow-hh-sm hover:shadow-hh-md transition-all hover:scale-[1.02]"
                  style={{ aspectRatio: '16/10' }}
                  onClick={() => {
                    const allTech = getAllTechnieken();
                    const fullTech = allTech.find(t => t.nummer === techniek.code);
                    if (fullTech) {
                      setSelectedTechnique({
                        nummer: fullTech.nummer,
                        naam: fullTech.naam,
                        fase: fullTech.fase,
                        tags: fullTech.tags,
                        themas: fullTech.themas,
                        doel: fullTech.doel,
                        wat: fullTech.wat,
                        waarom: fullTech.waarom,
                        wanneer: fullTech.wanneer,
                        hoe: fullTech.hoe,
                        verkoper_intentie: fullTech.verkoper_intentie,
                        context_requirements: fullTech.context_requirements,
                        stappenplan: fullTech.stappenplan,
                        voorbeeld: fullTech.voorbeeld,
                      });
                      setDetailsDialogOpen(true);
                    }
                  }}
                >
                  <div 
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundImage: `url(${getPhaseImage(techniek.code)})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  
                  <Badge className="absolute top-3 left-3 bg-teal-500 text-white border-0 text-[11px] font-mono font-semibold px-2.5 py-1 z-10">
                    #{techniek.code}
                  </Badge>
                  
                  {techniek.videos > 0 && (
                    <Badge className="absolute top-3 right-3 bg-black/60 text-white border-0 text-[10px] px-2 py-0.5 z-10">
                      {techniek.videos} video's
                    </Badge>
                  )}
                  
                  <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                    <h3 className="text-white font-semibold text-[15px] leading-tight mb-1.5 drop-shadow-md">
                      {techniek.name}
                    </h3>
                    <div className="flex items-center gap-2 text-white/70 text-[12px]">
                      <span>{techniek.code}</span>
                      <span>•</span>
                      <span>Score: {techniek.avgScore}%</span>
                    </div>
                  </div>
                  
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <div className="flex gap-2">
                      <button
                        className="w-11 h-11 rounded-full bg-white/95 flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          localStorage.setItem('filterTechniek', techniek.code);
                          localStorage.setItem('autoPlayFirstVideo', 'true');
                          navigate?.("videos");
                        }}
                        title="Bekijk video's"
                      >
                        <Play className="w-5 h-5 text-hh-ink ml-0.5" />
                      </button>
                      <button
                        className="w-11 h-11 rounded-full bg-white/95 flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          localStorage.setItem('selectedTechniek', techniek.code);
                          navigate?.("talk-to-hugo");
                        }}
                        title="Chat met HugoAI"
                      >
                        <MessageCircle className="w-5 h-5 text-hh-ink" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Technique Details Dialog */}
      {selectedTechnique && (
        <TechniqueDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          technique={{
            id: selectedTechnique.nummer,
            number: selectedTechnique.nummer,
            naam: selectedTechnique.naam,
            fase: selectedTechnique.fase || "1",
            tags: selectedTechnique.tags,
            doel: selectedTechnique.doel,
            hoe: selectedTechnique.hoe,
            wat: selectedTechnique.wat,
            waarom: selectedTechnique.waarom,
            wanneer: selectedTechnique.wanneer,
            verkoper_intentie: selectedTechnique.verkoper_intentie,
            context_requirements: selectedTechnique.context_requirements,
            stappenplan: selectedTechnique.stappenplan,
            voorbeeld: selectedTechnique.voorbeeld,
          }}
          isEditable={false}
          onSave={() => {
            setDetailsDialogOpen(false);
          }}
        />
      )}
      <PageFooter />
    </AppLayout>
  );
}
