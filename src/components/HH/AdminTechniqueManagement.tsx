import {
  Award,
  Search,
  MoreVertical,
  Eye,
  Play,
  Video,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Grid3X3,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  X,
  Plus,
  Save,
  Target,
  HelpCircle,
  Lightbulb,
  Clock,
  Wrench,
  ListOrdered,
  MessageSquare,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useMobileViewMode } from "../../hooks/useMobileViewMode";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { AutoResizeTextarea } from "../ui/auto-resize-textarea";
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
import { EPIC_TECHNIQUES, getTechniquesByPhase, getPhaseLabel, getTechniqueByNumber } from "../../data/epicTechniques";
import { ScrollArea } from "../ui/scroll-area";
import { DetailsSheet, TechniqueContent } from './DetailsSheet';

interface AdminTechniqueManagementProps {
  navigate?: (page: string) => void;
}

type SortField = 'code' | 'name' | 'videos' | 'roleplays' | 'avgScore' | 'completion' | 'status';
type SortDirection = 'asc' | 'desc';

export function AdminTechniqueManagement({ navigate }: AdminTechniqueManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFase, setActiveFase] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useMobileViewMode('grid', 'list');
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [detailsTechnique, setDetailsTechnique] = useState<string | null>(null);
  const [editingTechnique, setEditingTechnique] = useState<string | null>(null);
  const [editedTechniqueData, setEditedTechniqueData] = useState<any>(null);

  // Generate mock statistics for each technique
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

  // Convert EPIC techniques to admin format - all phases combined
  const allTechnieken = [
    ...getTechniquesByPhase("0").map((tech, idx) => ({
      id: idx,
      code: tech.nummer,
      name: tech.naam,
      fase: "0",
      ...generateMockStats(tech.nummer),
    })),
    ...getTechniquesByPhase("1").map((tech, idx) => ({
      id: idx + 50,
      code: tech.nummer,
      name: tech.naam,
      fase: "1",
      ...generateMockStats(tech.nummer),
    })),
    ...getTechniquesByPhase("2").map((tech, idx) => ({
      id: idx + 100,
      code: tech.nummer,
      name: tech.naam,
      fase: "2",
      ...generateMockStats(tech.nummer),
    })),
    ...getTechniquesByPhase("3").map((tech, idx) => ({
      id: idx + 200,
      code: tech.nummer,
      name: tech.naam,
      fase: "3",
      ...generateMockStats(tech.nummer),
    })),
    ...getTechniquesByPhase("4").map((tech, idx) => ({
      id: idx + 300,
      code: tech.nummer,
      name: tech.naam,
      fase: "4",
      ...generateMockStats(tech.nummer),
    })),
  ];

  // Handle save technique for Config Review
  const handleSaveTechnique = () => {
    console.log('handleSaveTechnique called');
    console.log('editingTechnique:', editingTechnique);
    console.log('editedTechniqueData:', editedTechniqueData);
    
    if (!editingTechnique || !editedTechniqueData) {
      console.log('Early return - missing data');
      return;
    }
    
    const originalTech = getTechniqueByNumber(editingTechnique);
    console.log('originalTech:', originalTech);
    
    // Create a fully merged object preserving all original fields plus edits
    const mergedTechnique = {
      ...originalTech,
      ...editedTechniqueData,
      // Ensure nummer and fase are preserved from original
      nummer: originalTech?.nummer,
      fase: originalTech?.fase,
    };
    console.log('mergedTechnique:', mergedTechnique);
    
    const pendingChanges = JSON.parse(localStorage.getItem('pendingConfigReview') || '[]');
    pendingChanges.push({
      type: 'technique',
      id: editingTechnique,
      original: originalTech,
      edited: mergedTechnique,
      timestamp: new Date().toISOString()
    });
    console.log('Saving to localStorage:', pendingChanges);
    localStorage.setItem('pendingConfigReview', JSON.stringify(pendingChanges));
    console.log('Saved successfully');
    toast.success('Wijziging opgeslagen voor review');
    setEditingTechnique(null);
    setEditedTechniqueData(null);
  };

  // Initialize edit data when editing starts
  const startEditing = (techniqueCode: string) => {
    const tech = getTechniqueByNumber(techniqueCode);
    if (tech) {
      setEditedTechniqueData({
        naam: tech.naam || '',
        doel: tech.doel || '',
        wat: tech.wat || '',
        waarom: tech.waarom || '',
        wanneer: tech.wanneer || '',
        hoe: tech.hoe || '',
        stappenplan: tech.stappenplan || [],
        voorbeeld: tech.voorbeeld || [],
        tags: tech.tags || [],
        themas: tech.themas || [],
        context_requirements: tech.context_requirements || [],
        verkoper_intentie: tech.verkoper_intentie || [],
      });
      setEditingTechnique(techniqueCode);
    }
  };

  // Helper function to update array fields
  const updateArrayField = (field: string, index: number, value: string) => {
    setEditedTechniqueData((prev: any) => ({
      ...prev,
      [field]: prev[field].map((item: string, i: number) => i === index ? value : item)
    }));
  };

  const addArrayItem = (field: string) => {
    setEditedTechniqueData((prev: any) => ({
      ...prev,
      [field]: [...(prev[field] || []), '']
    }));
  };

  const removeArrayItem = (field: string, index: number) => {
    setEditedTechniqueData((prev: any) => ({
      ...prev,
      [field]: prev[field].filter((_: any, i: number) => i !== index)
    }));
  };

  // Sorting function
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  // Filter and sort techniques
  const filteredTechnieken = allTechnieken
    .filter(t => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!t.name.toLowerCase().includes(query) && !t.code.toLowerCase().includes(query)) {
          return false;
        }
      }
      // Fase filter
      if (activeFase !== "all" && t.fase !== activeFase) {
        return false;
      }
      // Status filter
      if (filterStatus !== "all" && t.status.toLowerCase() !== filterStatus) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'code':
          // Sort by technique number (e.g., 1.1, 1.2, 2.1)
          const aParts = a.code.split('.').map(Number);
          const bParts = b.code.split('.').map(Number);
          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aVal = aParts[i] || 0;
            const bVal = bParts[i] || 0;
            if (aVal !== bVal) {
              comparison = aVal - bVal;
              break;
            }
          }
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'videos':
          comparison = a.videos - b.videos;
          break;
        case 'roleplays':
          comparison = a.roleplays - b.roleplays;
          break;
        case 'avgScore':
          comparison = a.avgScore - b.avgScore;
          break;
        case 'completion':
          comparison = a.completion - b.completion;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Calculate KPI stats
  const totalTechnieken = allTechnieken.length;
  const activeTechnieken = allTechnieken.filter(t => t.status === "Actief").length;
  const avgScore = Math.round(allTechnieken.reduce((sum, t) => sum + t.avgScore, 0) / allTechnieken.length);
  const needsImprovement = allTechnieken.filter(t => t.avgScore < 75).length;

  return (
    <AdminLayout currentPage="admin-techniques" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
            E.P.I.C. Technieken
          </h1>
          <p className="text-[16px] leading-[24px] text-hh-muted">
            {totalTechnieken} E.P.I.C. technieken verdeeld over 5 fases
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)' }}>
                <Award className="w-5 h-5" style={{ color: '#9333ea' }} />
              </div>
              <Badge variant="outline" className="text-[11px] px-2 py-0.5" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                +5%
              </Badge>
            </div>
            <p className="text-[13px] leading-[18px] text-hh-muted">
              Totaal Technieken
            </p>
            <p className="text-[28px] sm:text-[32px] leading-[36px] sm:leading-[40px] text-hh-text">
              {totalTechnieken}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <CheckCircle className="w-5 h-5" style={{ color: '#10b981' }} />
              </div>
              <Badge variant="outline" className="text-[11px] px-2 py-0.5" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                +12%
              </Badge>
            </div>
            <p className="text-[13px] leading-[18px] text-hh-muted">
              Actieve Technieken
            </p>
            <p className="text-[28px] sm:text-[32px] leading-[36px] sm:leading-[40px] text-hh-text">
              {activeTechnieken}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)' }}>
                <BarChart3 className="w-5 h-5" style={{ color: '#9333ea' }} />
              </div>
              <Badge variant="outline" className="text-[11px] px-2 py-0.5" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                +8%
              </Badge>
            </div>
            <p className="text-[13px] leading-[18px] text-hh-muted">
              Gem. Score
            </p>
            <p className="text-[28px] sm:text-[32px] leading-[36px] sm:leading-[40px] text-hh-text">
              {avgScore}%
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <TrendingUp className="w-5 h-5" style={{ color: '#10b981' }} />
              </div>
              <Badge variant="outline" className="text-[11px] px-2 py-0.5" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                +4.2%
              </Badge>
            </div>
            <p className="text-[13px] leading-[18px] text-hh-muted">
              Trend Score
            </p>
            <p className="text-[28px] sm:text-[32px] leading-[36px] sm:leading-[40px] text-hh-text">
              {needsImprovement}
            </p>
          </Card>
        </div>

        {/* Search & Filters Bar */}
        <Card className="p-4 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
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
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Fase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Fases</SelectItem>
                <SelectItem value="0">Fase 0 - Pre-contactfase</SelectItem>
                <SelectItem value="1">Fase 1 - Openingsfase</SelectItem>
                <SelectItem value="2">Fase 2 - Ontdekkingsfase</SelectItem>
                <SelectItem value="3">Fase 3 - Aanbevelingsfase</SelectItem>
                <SelectItem value="4">Fase 4 - Beslissingsfase</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="actief">Actief</SelectItem>
                <SelectItem value="inactief">Inactief</SelectItem>
              </SelectContent>
            </Select>
            
            {/* View Toggle */}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={`${
                  viewMode === "list" 
                    ? "text-white" 
                    : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"
                }`}
                style={viewMode === "list" ? { backgroundColor: '#9333ea' } : undefined}
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`${
                  viewMode === "grid" 
                    ? "text-white" 
                    : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"
                }`}
                style={viewMode === "grid" ? { backgroundColor: '#9333ea' } : undefined}
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Technieken Grid View */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTechnieken.map((techniek) => (
              <div 
                key={techniek.code}
                className="group bg-hh-bg rounded-xl border border-hh-border shadow-sm hover:shadow-lg transition-all cursor-pointer relative overflow-hidden"
                style={{ '--hover-border-color': 'rgba(147, 51, 234, 0.3)' } as React.CSSProperties}
              >
                <div className="p-4" onClick={() => setDetailsTechnique(techniek.code)}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[12px] font-mono font-semibold" style={{ backgroundColor: 'rgba(147, 51, 234, 0.15)', color: '#3d6080' }}>
                      {techniek.code}
                    </span>
                    <Badge variant="outline" className="text-[10px]" style={techniek.status === 'Actief' ? { backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' } : { backgroundColor: 'rgba(139, 149, 165, 0.1)', color: '#8B95A5' }}>
                      {techniek.status}
                    </Badge>
                  </div>
                  <h3 className="text-hh-text font-semibold text-[14px] leading-tight mb-2 line-clamp-2">
                    {techniek.name}
                  </h3>
                  <div className="flex items-center gap-4 text-[12px] text-hh-muted mb-3">
                    <span className="flex items-center gap-1">
                      <Video className="w-3.5 h-3.5" style={{ color: '#9333ea' }} />
                      {techniek.videos} video's
                    </span>
                    <span className="flex items-center gap-1">
                      <Play className="w-3.5 h-3.5 text-blue-500" />
                      {techniek.roleplays} role-plays
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-hh-muted">Score: <span className="font-medium" style={{ color: '#10b981' }}>{techniek.avgScore}%</span></span>
                    <span className="text-hh-muted">Compl: {techniek.completion}%</span>
                  </div>
                </div>
                <div className="border-t border-hh-border bg-hh-ui-50/50 px-4 py-2 flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-8 text-[11px]"
                    style={{ color: '#9333ea' }}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      localStorage.setItem('filterTechniek', techniek.code);
                      navigate?.("admin-videos");
                    }}
                  >
                    <Video className="w-3 h-3 mr-1" />
                    Video's
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-8 text-[11px] text-blue-600 hover:bg-hh-ui-50 hover:text-blue-500"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      setDetailsTechnique(techniek.code);
                    }}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Technieken Table */}
        {viewMode === "list" && (
        <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-hh-ui-50">
                <tr>
                  <th 
                    className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text transition-colors"
                    onClick={() => handleSort('code')}
                  >
                    <span className="flex items-center">
                      #
                      {getSortIcon('code')}
                    </span>
                  </th>
                  <th 
                    className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <span className="flex items-center">
                      Techniek
                      {getSortIcon('name')}
                    </span>
                  </th>
                  <th 
                    className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text transition-colors"
                    onClick={() => handleSort('videos')}
                  >
                    <span className="flex items-center justify-end">
                      Video's
                      {getSortIcon('videos')}
                    </span>
                  </th>
                  <th 
                    className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text transition-colors"
                    onClick={() => handleSort('roleplays')}
                  >
                    <span className="flex items-center justify-end">
                      Role-Plays
                      {getSortIcon('roleplays')}
                    </span>
                  </th>
                  <th 
                    className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text transition-colors"
                    onClick={() => handleSort('avgScore')}
                  >
                    <span className="flex items-center justify-end">
                      Avg Score
                      {getSortIcon('avgScore')}
                    </span>
                  </th>
                  <th 
                    className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text transition-colors"
                    onClick={() => handleSort('completion')}
                  >
                    <span className="flex items-center justify-end">
                      Completion
                      {getSortIcon('completion')}
                    </span>
                  </th>
                  <th 
                    className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:text-hh-text transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <span className="flex items-center">
                      Status
                      {getSortIcon('status')}
                    </span>
                  </th>
                  <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTechnieken.map((techniek) => (
                      <tr
                        key={techniek.id}
                        className="border-t border-hh-border hover:bg-hh-ui-50 transition-colors cursor-pointer"
                        onClick={() => setDetailsTechnique(techniek.code)}
                      >
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className="text-[11px] font-mono"
                            style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', borderColor: 'rgba(147, 51, 234, 0.2)' }}
                          >
                            {techniek.code}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                            {techniek.name}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1 text-[14px] leading-[20px] text-hh-text">
                            <Video className="w-3.5 h-3.5" style={{ color: '#9333ea' }} />
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
                          <span className="text-[14px] leading-[20px] font-medium" style={{ color: '#10b981' }}>
                            {techniek.avgScore}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-[14px] leading-[20px] text-hh-text">
                            {techniek.completion}%
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className="text-[11px]" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                            {techniek.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetailsTechnique(techniek.code)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Bekijk details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate?.("admin-videos")}>
                                <Video className="w-4 h-4 mr-2" />
                                Bekijk Video's
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate?.("admin-transcripts")}>
                                <Play className="w-4 h-4 mr-2" />
                                Bekijk Role-Plays
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <TrendingUp className="w-4 h-4 mr-2" />
                                Analytics
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

      {/* Technique Details Sheet */}
      {(() => {
        const tech = detailsTechnique ? getTechniqueByNumber(detailsTechnique) : null;
        return (
          <DetailsSheet
            open={!!detailsTechnique}
            onOpenChange={(open: boolean) => !open && setDetailsTechnique(null)}
            variant="admin"
            badges={
              tech?.nummer && (
                <Badge 
                  className="font-mono text-sm px-3 py-1" 
                  style={{ backgroundColor: 'rgba(147, 51, 234, 0.15)', color: '#9333ea', borderColor: 'rgba(147, 51, 234, 0.3)' }}
                >
                  {tech.nummer}
                </Badge>
              )
            }
            title={tech?.naam || 'Techniek niet gevonden'}
            subtitle={
              <span className="flex items-center gap-3 flex-wrap">
                <span>Fase: <strong>{tech?.fase}</strong></span>
                {tech?.tags && tech.tags.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {tech.tags.map((tag: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </span>
                )}
              </span>
            }
            footer={
              <>
                <Button variant="outline" onClick={() => setDetailsTechnique(null)}>
                  Sluiten
                </Button>
                <Button 
                  className="text-white hover:opacity-90"
                  style={{ backgroundColor: '#9333ea' }}
                  onClick={() => {
                    if (detailsTechnique) {
                      startEditing(detailsTechnique);
                      setDetailsTechnique(null);
                    }
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Bewerken
                </Button>
              </>
            }
          >
            <TechniqueContent technique={tech || null} variant="admin" />
          </DetailsSheet>
        );
      })()}

      {/* Edit Technique Sheet */}
      <DetailsSheet
        open={!!editingTechnique}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setEditingTechnique(null);
            setEditedTechniqueData(null);
          }
        }}
        variant="admin"
        badges={
          editingTechnique && (
            <Badge 
              className="font-mono text-sm px-3 py-1" 
              style={{ backgroundColor: 'rgba(147, 51, 234, 0.15)', color: '#9333ea', borderColor: 'rgba(147, 51, 234, 0.3)' }}
            >
              {editingTechnique}
            </Badge>
          )
        }
        title={
          editedTechniqueData ? (
            <Input
              value={editedTechniqueData.naam}
              onChange={(e) => setEditedTechniqueData({...editedTechniqueData, naam: e.target.value})}
              className="text-xl font-semibold border-2 focus-visible:ring-[#9333ea] focus-visible:border-[#9333ea]"
              placeholder="Techniek naam"
            />
          ) : 'Techniek Bewerken'
        }
        subtitle={
          <span className="flex items-center gap-3 text-[13px]">
            <span>Fase: <strong>{getTechniqueByNumber(editingTechnique || '')?.fase}</strong></span>
            <span className="text-xs text-hh-muted">(Nummer en Fase zijn niet bewerkbaar)</span>
          </span>
        }
        footer={
          <>
            <Button variant="outline" onClick={() => {
              setEditingTechnique(null);
              setEditedTechniqueData(null);
            }}>
              Annuleren
            </Button>
            <Button 
              className="text-white hover:opacity-90 gap-2"
              style={{ backgroundColor: '#9333ea' }}
              onClick={handleSaveTechnique}
            >
              <Save className="w-4 h-4" />
              Opslaan naar Review
            </Button>
          </>
        }
      >
        {editedTechniqueData && (
          <div className="space-y-6">
            {/* Doel Section - Main purple card like video Samenvatting */}
            <div className="p-4 rounded-lg border" style={{ backgroundColor: 'rgba(147, 51, 234, 0.05)', borderColor: 'rgba(147, 51, 234, 0.15)' }}>
              <div className="flex items-start gap-2 mb-2">
                <Target className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#9333ea' }} />
                <h3 className="text-[13px] font-semibold text-hh-text">Doel</h3>
              </div>
              <AutoResizeTextarea
                value={editedTechniqueData.doel}
                onChange={(e) => setEditedTechniqueData({...editedTechniqueData, doel: e.target.value})}
                className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                placeholder="Doel van de techniek..."
                minHeight={60}
                maxHeight={200}
              />
            </div>

            {/* Wat Section */}
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <HelpCircle className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Wat</h3>
              </div>
              <AutoResizeTextarea
                value={editedTechniqueData.wat}
                onChange={(e) => setEditedTechniqueData({...editedTechniqueData, wat: e.target.value})}
                className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                placeholder="Wat is de techniek..."
                minHeight={60}
                maxHeight={200}
              />
            </div>

            {/* Waarom Section */}
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Waarom</h3>
              </div>
              <AutoResizeTextarea
                value={editedTechniqueData.waarom}
                onChange={(e) => setEditedTechniqueData({...editedTechniqueData, waarom: e.target.value})}
                className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                placeholder="Waarom deze techniek gebruiken..."
                minHeight={60}
                maxHeight={200}
              />
            </div>

            {/* Wanneer Section */}
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <Clock className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Wanneer</h3>
              </div>
              <AutoResizeTextarea
                value={editedTechniqueData.wanneer}
                onChange={(e) => setEditedTechniqueData({...editedTechniqueData, wanneer: e.target.value})}
                className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                placeholder="Wanneer de techniek toepassen..."
                minHeight={60}
                maxHeight={200}
              />
            </div>

            {/* Hoe Section */}
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <Wrench className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Hoe</h3>
              </div>
              <AutoResizeTextarea
                value={editedTechniqueData.hoe}
                onChange={(e) => setEditedTechniqueData({...editedTechniqueData, hoe: e.target.value})}
                className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                placeholder="Hoe de techniek toepassen..."
                minHeight={80}
                maxHeight={300}
              />
            </div>

            {/* Stappenplan Section */}
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <ListOrdered className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Stappenplan</h3>
                <span className="text-[11px] text-hh-muted">(1 stap per regel)</span>
              </div>
              <AutoResizeTextarea
                value={(editedTechniqueData.stappenplan || []).join('\n')}
                onChange={(e) => setEditedTechniqueData({
                  ...editedTechniqueData, 
                  stappenplan: e.target.value.split('\n').filter((s: string) => s.trim())
                })}
                className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                placeholder="Stap 1&#10;Stap 2&#10;Stap 3..."
                minHeight={80}
                maxHeight={300}
              />
            </div>

            {/* Voorbeelden Section */}
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Voorbeelden</h3>
                <span className="text-[11px] text-hh-muted">(1 voorbeeld per regel)</span>
              </div>
              <AutoResizeTextarea
                value={(editedTechniqueData.voorbeeld || []).join('\n')}
                onChange={(e) => setEditedTechniqueData({
                  ...editedTechniqueData, 
                  voorbeeld: e.target.value.split('\n').filter((s: string) => s.trim())
                })}
                className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                placeholder="Voorbeeld 1&#10;Voorbeeld 2..."
                minHeight={80}
                maxHeight={300}
              />
            </div>

            {/* Tags Section */}
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <Tag className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Tags</h3>
                <span className="text-[11px] text-hh-muted">(1 tag per regel)</span>
              </div>
              <AutoResizeTextarea
                value={(editedTechniqueData.tags || []).join('\n')}
                onChange={(e) => setEditedTechniqueData({
                  ...editedTechniqueData, 
                  tags: e.target.value.split('\n').filter((s: string) => s.trim())
                })}
                className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                placeholder="tag1&#10;tag2&#10;tag3..."
                minHeight={60}
                maxHeight={200}
              />
            </div>

            {/* Thema's Section */}
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Thema's</h3>
                <span className="text-[11px] text-hh-muted">(1 thema per regel)</span>
              </div>
              <AutoResizeTextarea
                value={(editedTechniqueData.themas || []).join('\n')}
                onChange={(e) => setEditedTechniqueData({
                  ...editedTechniqueData, 
                  themas: e.target.value.split('\n').filter((s: string) => s.trim())
                })}
                className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                placeholder="thema1&#10;thema2..."
                minHeight={60}
                maxHeight={200}
              />
            </div>

            {/* Context Requirements Section */}
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Context Vereisten</h3>
                <span className="text-[11px] text-hh-muted">(1 vereiste per regel)</span>
              </div>
              <AutoResizeTextarea
                value={(editedTechniqueData.context_requirements || []).join('\n')}
                onChange={(e) => setEditedTechniqueData({
                  ...editedTechniqueData, 
                  context_requirements: e.target.value.split('\n').filter((s: string) => s.trim())
                })}
                className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                placeholder="vereiste1&#10;vereiste2..."
                minHeight={60}
                maxHeight={200}
              />
            </div>

            {/* Verkoper Intentie Section */}
            <div className="p-4 rounded-lg bg-hh-ui-50 border border-hh-border">
              <div className="flex items-start gap-2 mb-2">
                <Award className="w-4 h-4 text-hh-muted mt-0.5 flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-hh-text">Verkoper Intentie</h3>
                <span className="text-[11px] text-hh-muted">(1 intentie per regel)</span>
              </div>
              <AutoResizeTextarea
                value={(editedTechniqueData.verkoper_intentie || []).join('\n')}
                onChange={(e) => setEditedTechniqueData({
                  ...editedTechniqueData, 
                  verkoper_intentie: e.target.value.split('\n').filter((s: string) => s.trim())
                })}
                className="w-full text-[13px] leading-[20px] p-3 border rounded-md bg-hh-bg focus:ring-2 focus:ring-[#9333ea] focus:border-[#9333ea]"
                placeholder="intentie1&#10;intentie2..."
                minHeight={60}
                maxHeight={300}
              />
            </div>
          </div>
        )}
      </DetailsSheet>
    </AdminLayout>
  );
}