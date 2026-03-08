// NOTE: KPI cards en video counts gebruiken mock data (generateMockStats)
// Echte data wordt later gekoppeld via user_progress en videos tabellen

import { useState, useEffect } from "react";
import { useMobileViewMode } from "../../hooks/useMobileViewMode";
import { AppLayout } from "./AppLayout";
import { HeroBanner } from "./HeroBanner";
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
  const [viewMode] = useMobileViewMode("grid", "list");
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
    const urlParams = new URLSearchParams(window.location.search);
    const devTechnique = urlParams.get('detail');
    const storedTechniqueNumber = devTechnique || localStorage.getItem('selectedTechniqueNumber');
    if (storedTechniqueNumber) {
      if (!devTechnique) localStorage.removeItem('selectedTechniqueNumber');
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

  // TODO: fetch real stats from conversation_analyses + videos tables
  const getStats = () => ({
    videos: 0,
    roleplays: 0,
    avgScore: 0,
    completion: 0,
    status: "Actief" as const,
  });

  const technieken = {
    "fase-0": getTechniekenByFase("0", true).map((tech, idx) => ({
      id: idx + 1,
      code: tech.nummer,
      name: tech.naam,
      is_fase: tech.is_fase,
      ...getStats(),
    })),
    "fase-1": getTechniekenByFase("1", true).map((tech, idx) => ({
      id: idx + 10,
      code: tech.nummer,
      name: tech.naam,
      is_fase: tech.is_fase,
      ...getStats(),
    })),
    "fase-2": getTechniekenByFase("2", true).map((tech, idx) => ({
      id: idx + 20,
      code: tech.nummer,
      name: tech.naam,
      is_fase: tech.is_fase,
      ...getStats(),
    })),
    "fase-3": getTechniekenByFase("3", true).map((tech, idx) => ({
      id: idx + 40,
      code: tech.nummer,
      name: tech.naam,
      is_fase: tech.is_fase,
      ...getStats(),
    })),
    "fase-4": getTechniekenByFase("4", true).map((tech, idx) => ({
      id: idx + 50,
      code: tech.nummer,
      name: tech.naam,
      is_fase: tech.is_fase,
      ...getStats(),
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
      <div className="p-3 sm:p-4 lg:p-6 space-y-6">
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
              <div className="w-6 h-6 rounded-full bg-hh-success/10 flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-hh-success" />
              </div>
              <div>
                <p className="text-[10px] text-hh-muted leading-none">Voortgang</p>
                <p className="text-[14px] font-semibold text-hh-ink leading-tight">12%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Banner */}
        <HeroBanner
          image="/images/Hugo-Herbots-WEB-0281.JPG"
          badge={{ icon: <Award className="w-3 h-3 mr-1" />, label: "54 E.P.I.C. TECHNIQUE" }}
          title="Master de Sales Cyclus"
          subtitle="Ontdek alle technieken van de 5 fases en word een top verkoper."
          primaryAction={{
            label: "Talk to Hugo",
            icon: <MessageCircle className="w-4 h-4" />,
            onClick: () => navigate?.("talk-to-hugo"),
          }}
          secondaryAction={{
            label: "Bekijk Video's",
            icon: <Play className="w-4 h-4" />,
            onClick: () => navigate?.("videos"),
          }}
        />

        {/* Search, View Toggle & Filters Card */}
        <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek technieken..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={activeFase} onValueChange={setActiveFase}>
              <SelectTrigger className="w-full sm:w-[160px]">
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
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Alle Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="actief">Actief</SelectItem>
                <SelectItem value="concept">Concept</SelectItem>
                <SelectItem value="archief">Archief</SelectItem>
              </SelectContent>
            </Select>
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
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-hh-success/15 text-hh-success text-[12px] font-mono font-semibold flex-shrink-0">
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
                <Badge className={`text-[9px] px-1.5 py-0 flex-shrink-0 ${techniek.status === 'Actief' ? 'bg-hh-success/10 text-hh-success dark:text-hh-success' : techniek.status === 'Concept' ? 'bg-hh-warning/10 text-hh-warning dark:text-hh-warning' : 'bg-hh-ui-50 text-hh-muted'} border-0`}>
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
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-hh-success/15 text-hh-success text-[12px] font-mono font-semibold">
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
                          <Play className="w-3.5 h-3.5 text-hh-primary" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 pb-8">
            {filteredTechnieken.map((techniek) => {
              const HUGO_IMAGES = [
                '/images/Hugo-Herbots-WEB-0081.JPG', '/images/Hugo-Herbots-WEB-0102.JPG',
                '/images/Hugo-Herbots-WEB-0115.JPG', '/images/Hugo-Herbots-WEB-0116.JPG',
                '/images/Hugo-Herbots-WEB-0119.JPG', '/images/Hugo-Herbots-WEB-0123.JPG',
                '/images/Hugo-Herbots-WEB-0173.JPG', '/images/Hugo-Herbots-WEB-0197.JPG',
                '/images/Hugo-Herbots-WEB-0244.JPG', '/images/Hugo-Herbots-WEB-0251-2.JPG',
                '/images/Hugo-Herbots-WEB-0251.JPG', '/images/Hugo-Herbots-WEB-0281.JPG',
                '/images/Hugo-Herbots-WEB-0303.JPG', '/images/Hugo-Herbots-WEB-0309.JPG',
                '/images/Hugo-Herbots-WEB-0342.JPG', '/images/Hugo-Herbots-WEB-0350-2.JPG',
                '/images/Hugo-Herbots-WEB-0350.JPG', '/images/Hugo-Herbots-WEB-0365.JPG',
                '/images/Hugo-Herbots-WEB-0368.JPG', '/images/Hugo-Herbots-WEB-0399.JPG',
                '/images/Hugo-Herbots-WEB-0404.JPG', '/images/Hugo-Herbots-WEB-0416-2.JPG',
                '/images/Hugo-Herbots-WEB-0416.JPG', '/images/Hugo-Herbots-WEB-0433.JPG',
                '/images/Hugo-Herbots-WEB-0444.JPG', '/images/Hugo-Herbots-WEB-0461.JPG',
                '/images/Hugo-Herbots-WEB-0476.JPG', '/images/Hugo-Herbots-WEB-0536.JPG',
                '/images/Hugo-Herbots-WEB-0555.JPG', '/images/Hugo-Herbots-WEB-0566.JPG',
                '/images/Hugo-Herbots-WEB-0576.JPG', '/images/Hugo-Herbots-WEB-0580.JPG',
                '/images/Hugo-Herbots-WEB-0606.JPG', '/images/Hugo-Herbots-WEB-0628.JPG',
                '/images/Hugo-Herbots-WEB-0649.JPG', '/images/Hugo-Herbots-WEB-0663.JPG',
                '/images/Hugo-Herbots-WEB-0676.JPG', '/images/Hugo-Herbots-WEB-0680.JPG',
                '/images/Hugo-Herbots-WEB-0688.JPG', '/images/Hugo-Herbots-WEB-0701.JPG',
                '/images/Hugo-Herbots-WEB-0705.JPG', '/images/Hugo-Herbots-WEB-0726.JPG',
                '/images/Hugo-Herbots-WEB-0732.JPG', '/images/Hugo-Herbots-WEB-0749.JPG',
                '/images/Hugo-Herbots-WEB-0761.JPG', '/images/Hugo-Herbots-WEB-0789.JPG',
                '/images/Hugo-Herbots-WEB-0827.JPG', '/images/Hugo-Herbots-WEB-0839.JPG',
                '/images/Hugo-Herbots-WEB-0844.JPG', '/images/Hugo-Herbots-WEB-0861.JPG',
                '/images/Hugo-Herbots-WEB-0939.JPG', '/images/Hugo-Herbots-WEB-0962.JPG',
                '/images/Hugo-Herbots-WEB-0968.JPG', '/images/Hugo-Herbots-WEB-1011.JPG',
              ];
              const getCardImage = (code: string) => {
                let hash = 0;
                for (let i = 0; i < code.length; i++) hash = ((hash << 5) - hash + code.charCodeAt(i)) | 0;
                return HUGO_IMAGES[Math.abs(hash) % HUGO_IMAGES.length];
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
                  <img
                    src={getCardImage(techniek.code)}
                    alt={techniek.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
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
                        title="Talk to Hugo"
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
            nummer: selectedTechnique.nummer,
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
    </AppLayout>
  );
}
