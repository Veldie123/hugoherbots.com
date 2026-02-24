import {
  Library,
  Search,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Video,
  Target,
  Radio,
  FileText,
  Image as ImageIcon,
  Play,
  TrendingUp,
  List,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { allContent } from "../../data/content-items";
import { CustomCheckbox } from "../ui/custom-checkbox";
import { useState } from "react";
import { useMobileViewMode } from "../../hooks/useMobileViewMode";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
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

interface AdminContentLibraryProps {
  navigate?: (page: string) => void;
}

type SortField = "title" | "views" | "date" | null;
type SortDirection = "asc" | "desc";

export function AdminContentLibrary({ navigate }: AdminContentLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterFase, setFilterFase] = useState("all");
  const [viewMode, setViewMode] = useMobileViewMode("grid", "list");
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const selectionMode = selectedIds.length > 0;

  const toggleSelectId = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredContent.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredContent.map(item => item.id));
    }
  };

  const stats = [
    { label: "Total Content", value: allContent.length, icon: Library, color: "steelblue", trend: "up", change: "+10%" },
    { label: "Video's", value: allContent.filter((c) => c.type === "video").length, icon: Video, color: "steelblue", trend: "up", change: "+5%" },
    { label: "Scenario's", value: allContent.filter((c) => c.type === "scenario").length, icon: Target, color: "blue", trend: "down", change: "-2%" },
    { label: "Live Sessies", value: allContent.filter((c) => c.type === "live").length, icon: Radio, color: "red", trend: "up", change: "+3%" },
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case "video":
        return "steelblue-bg";
      case "scenario":
        return "bg-blue-600/10 text-blue-600";
      case "live":
        return "bg-red-600/10 text-red-600";
      case "document":
        return "bg-emerald-500/10 text-emerald-500";
      default:
        return "bg-hh-muted/10 text-hh-muted";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "video":
        return "Video";
      case "scenario":
        return "Scenario";
      case "live":
        return "Live";
      case "document":
        return "Document";
      default:
        return type;
    }
  };

  // Filter logic
  const filteredContent = allContent.filter((content) => {
    const matchesSearch =
      searchQuery === "" ||
      content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      content.fase.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || content.type === filterType;
    const matchesFase = (() => {
      if (filterFase === "all") return true;
      const faseLower = content.fase.toLowerCase();
      const faseMap: Record<string, string[]> = {
        'voorbereiding': ['voorbereiding', 'pre-contact', 'pre'],
        'opening': ['opening'],
        'ontdekking': ['ontdekking'],
        'aanbeveling': ['aanbeveling'],
        'beslissing': ['beslissing'],
      };
      const keywords = faseMap[filterFase] || [];
      return keywords.some(keyword => faseLower.includes(keyword));
    })();
    return matchesSearch && matchesType && matchesFase;
  });

  // Sort logic
  const sortedContent = [...filteredContent].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case "title":
        comparison = a.title.localeCompare(b.title);
        break;
      case "views":
        comparison = a.views - b.views;
        break;
      case "date":
        comparison = a.uploadDate.localeCompare(b.uploadDate);
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-hh-muted" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3" style={{ color: "#9333ea" }} />
    ) : (
      <ArrowDown className="w-3 h-3" style={{ color: "#9333ea" }} />
    );
  };

  return (
    <AdminLayout currentPage="admin-content" navigate={navigate}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="max-w-[50%]">
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Content Library
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Unified overzicht van alle content types
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline">Export</span>
            </Button>
            <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700">
              <Upload className="w-4 h-4" />
              <span className="hidden lg:inline">Upload Content</span>
              <span className="lg:hidden">Upload</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const bgColor = stat.color === "steelblue" ? "steelblue-bg" : 
                           stat.color === "blue" ? "bg-blue-600/10" :
                           stat.color === "red" ? "bg-red-600/10" : "bg-emerald-500/10";
            const iconColor = stat.color === "steelblue" ? "steelblue-text" : 
                             stat.color === "blue" ? "text-blue-600" :
                             stat.color === "red" ? "text-red-600" : "text-emerald-500";
            const trendColor = stat.trend === "up" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                              stat.trend === "down" ? "bg-hh-error/10 text-hh-error border-hh-error/20" :
                              "bg-hh-muted/10 text-hh-muted border-hh-muted/20";
            return (
              <Card
                key={stat.label}
                className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border"
              >
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <div 
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${stat.color === "steelblue" ? "" : bgColor}`}
                  style={stat.color === "steelblue" ? { 
                    backgroundColor: "rgba(147, 51, 234, 0.1)"
                  } : undefined}
                >
                    <Icon 
                      className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color === "steelblue" ? "" : iconColor}`}
                      style={stat.color === "steelblue" ? { 
                        color: "#9333ea"
                      } : undefined}
                    />
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 ${trendColor}`}
                  >
                    <TrendingUp className="w-3 h-3 mr-0.5" />
                    {stat.change}
                  </Badge>
                </div>
                <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
                  {stat.label}
                </p>
                <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
                  {stat.value}
                </p>
              </Card>
            );
          })}
        </div>

        {/* Filter Card - Uniform Structure */}
        <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search - Left Side */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filters - Middle */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Alle Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Types</SelectItem>
                <SelectItem value="video">Video's</SelectItem>
                <SelectItem value="scenario">Scenario's</SelectItem>
                <SelectItem value="live">Live Sessies</SelectItem>
                <SelectItem value="document">Documenten</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterFase} onValueChange={setFilterFase}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Alle Fases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Fases</SelectItem>
                <SelectItem value="Voorbereiding">Voorbereiding</SelectItem>
                <SelectItem value="Openingsfase">Openingsfase</SelectItem>
                <SelectItem value="Ontdekkingsfase">Ontdekkingsfase</SelectItem>
                <SelectItem value="Aanbevelingsfase">Aanbevelingsfase</SelectItem>
                <SelectItem value="Beslissingsfase">Beslissingsfase</SelectItem>
              </SelectContent>
            </Select>
            
            {/* View Toggle - Right Side */}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={`${
                  viewMode === "list" 
                    ? "text-white" 
                    : "text-hh-muted hover:text-hh-text hover:bg-hh-ui-50"
                }`}
                style={viewMode === "list" ? {
                  backgroundColor: "#9333ea"
                } : undefined}
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
                style={viewMode === "grid" ? {
                  backgroundColor: "#9333ea"
                } : undefined}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Content - Based on View Mode */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedContent.length === 0 ? (
              <Card className="col-span-full p-8 rounded-[16px] border-hh-border text-center">
                <Library className="w-12 h-12 text-hh-muted mx-auto mb-3" />
                <p className="text-[16px] text-hh-muted">
                  Geen content gevonden
                </p>
              </Card>
            ) : (
              sortedContent.map((content) => {
                const Icon = content.icon;
                return (
                  <Card
                    key={content.id}
                    className="p-4 rounded-[16px] border-hh-border hover:shadow-md transition-shadow"
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div 
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${content.type === "video" ? "" : getTypeColor(content.type)}`}
                          style={content.type === "video" ? {
                            backgroundColor: "rgba(147, 51, 234, 0.1)"
                          } : undefined}
                        >
                          <Icon className="w-5 h-5" style={content.type === "video" ? { color: "#9333ea" } : undefined} />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              Bekijk
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Bewerk
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Play className="w-4 h-4 mr-2" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Verwijder
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Title & Type */}
                      <div>
                        <h3 className="text-[16px] font-semibold text-hh-text mb-1">
                          {content.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[11px]">
                            {getTypeLabel(content.type)}
                          </Badge>
                          <Badge variant="outline" className="text-[11px] bg-blue-500/10 text-blue-600 border-blue-500/20">
                            {content.fase}
                          </Badge>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center justify-between text-[13px] text-hh-muted pt-2 border-t border-hh-border">
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{content.views} views</span>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-500">
                          <TrendingUp className="w-4 h-4" />
                          <span>{content.engagement}%</span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[12px] text-hh-muted">{content.uploadDate}</span>
                        <Badge
                          className={`text-[11px] ${
                            content.status === "Gepubliceerd"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-hh-muted/10 text-hh-muted border-hh-muted/20"
                          }`}
                        >
                          {content.status}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {viewMode === "list" && (
          <div className="rounded-[16px] border border-hh-border overflow-hidden bg-card">
            <table className="w-full">
              <thead className="bg-hh-ui-50 border-b border-hh-border">
                <tr>
                  <th className="text-left px-4 py-3 w-12">
                    {selectionMode && (
                      <CustomCheckbox
                        checked={selectedIds.length === sortedContent.length && sortedContent.length > 0}
                        onChange={toggleSelectAll}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted w-20">
                    #
                  </th>
                  <th
                    className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted cursor-pointer hover:bg-hh-ui-100 transition-colors"
                    onClick={() => handleSort("title")}
                  >
                    <div className="flex items-center gap-2">
                      Titel
                      <SortIcon field="title" />
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Fase
                  </th>
                  <th
                    className="text-right px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted cursor-pointer hover:bg-hh-ui-100 transition-colors"
                    onClick={() => handleSort("views")}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Views
                      <SortIcon field="views" />
                    </div>
                  </th>
                  <th className="text-right px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Engagement
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-[13px] leading-[18px] font-medium text-hh-muted">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedContent.map((content, index) => {
                  const Icon = content.icon;
                  return (
                    <tr
                      key={content.id}
                      onMouseEnter={() => setHoveredRow(content.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className={`border-b border-hh-border last:border-0 hover:bg-hh-ui-50 transition-colors ${
                        index % 2 === 0 ? "bg-card" : "bg-hh-ui-50/30"
                      }`}
                    >
                      <td className="px-4 py-3 w-12" onClick={(e) => e.stopPropagation()}>
                        {(selectionMode || hoveredRow === content.id) ? (
                          <CustomCheckbox
                            checked={selectedIds.includes(content.id)}
                            onChange={() => toggleSelectId(content.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : <div className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3">
                        {content.techniqueNumber && (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[13px] font-semibold" style={{
                            backgroundColor: "rgba(147, 51, 234, 0.15)",
                            color: "#9333ea"
                          }}>
                            {content.techniqueNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[14px] text-hh-text font-medium">
                          {content.title}
                        </p>
                        <p className="text-[12px] text-hh-muted">
                          {content.uploadDate}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div 
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${content.type === "video" ? "" : getTypeColor(content.type)}`}
                            style={content.type === "video" ? {
                              backgroundColor: "rgba(147, 51, 234, 0.1)"
                            } : undefined}
                          >
                            <Icon className="w-4 h-4" style={content.type === "video" ? { color: "#9333ea" } : undefined} />
                          </div>
                          <Badge variant="outline" className="text-[11px] bg-hh-ui-100 text-hh-muted border-hh-border">
                            {getTypeLabel(content.type)}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="text-[11px] bg-blue-600/10 text-blue-600 border-blue-600/20"
                        >
                          {content.fase}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-[14px] text-emerald-500 font-medium">
                        {content.views}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[14px] text-emerald-500 flex items-center justify-end gap-1">
                          {content.engagement}%
                          <TrendingUp className="w-3.5 h-3.5" />
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`text-[11px] ${
                            content.status === "Gepubliceerd"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-hh-muted/10 text-hh-muted border-hh-muted/20"
                          }`}
                        >
                          {content.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              Bekijk
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Bewerk
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Play className="w-4 h-4 mr-2" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Verwijder
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}