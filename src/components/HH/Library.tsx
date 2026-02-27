import { useState } from "react";
import { useMobileViewMode } from "@/hooks/useMobileViewMode";
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
  TrendingUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Eye,
  Video,
  Target,
  Radio,
  FileText,
  Library as LibraryIcon,
} from "lucide-react";
import { allContent, type ContentItem } from "../../data/content-items";

type ContentType = "all" | "video" | "scenario" | "live" | "document";
type ViewMode = "grid" | "list";
type SortField = "title" | "views" | "date" | null;
type SortDirection = "asc" | "desc";

interface LibraryProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
}

export function Library({ navigate, isAdmin }: LibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<ContentType>("all");
  const [filterFase, setFilterFase] = useState("all");
  const [viewMode, setViewMode] = useMobileViewMode("grid", "grid");
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const stats = [
    { label: "Total Content", value: allContent.length, icon: LibraryIcon, color: "hh-ink", trend: "up", change: "+10%" },
    { label: "Video's", value: allContent.filter((c) => c.type === "video").length, icon: Video, color: "hh-ink", trend: "up", change: "+5%" },
    { label: "Scenario's", value: allContent.filter((c) => c.type === "scenario").length, icon: Target, color: "hh-primary", trend: "down", change: "-2%" },
    { label: "Live Sessies", value: allContent.filter((c) => c.type === "live").length, icon: Radio, color: "red", trend: "up", change: "+3%" },
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case "video":
        return "bg-hh-ink/10 text-hh-ink";
      case "scenario":
        return "bg-hh-primary/10 text-hh-primary";
      case "live":
        return "bg-red-600/10 text-red-600";
      case "document":
        return "bg-green-600/10 text-green-600";
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
      <ArrowUp className="w-3 h-3 text-hh-ink" />
    ) : (
      <ArrowDown className="w-3 h-3 text-hh-ink" />
    );
  };

  return (
    <AppLayout currentPage="library" navigate={navigate} isAdmin={isAdmin}>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Content Library
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              {filteredContent.length} items — Unified overzicht van alle content types
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const bgColor = stat.color === "hh-ink" ? "bg-hh-ink/10" : 
                           stat.color === "hh-primary" ? "bg-hh-primary/10" :
                           stat.color === "red" ? "bg-red-600/10" : "bg-green-600/10";
            const iconColor = stat.color === "hh-ink" ? "text-hh-ink" : 
                             stat.color === "hh-primary" ? "text-hh-primary" :
                             stat.color === "red" ? "text-red-600" : "text-green-600";
            const trendColor = stat.trend === "up" ? "bg-hh-success/10 text-hh-success border-hh-success/20" :
                              stat.trend === "down" ? "bg-hh-error/10 text-hh-error border-hh-error/20" :
                              "bg-hh-muted/10 text-hh-muted border-hh-muted/20";
            return (
              <Card
                key={stat.label}
                className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border"
              >
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${bgColor} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
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

        <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek content..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select value={filterType} onValueChange={(v: string) => setFilterType(v as ContentType)}>
              <SelectTrigger className="w-full sm:w-[180px]">
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
              <SelectTrigger className="w-full sm:w-[180px]">
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
        </Card>

        {viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedContent.length === 0 ? (
              <Card className="col-span-full p-8 rounded-[16px] border-hh-border text-center">
                <LibraryIcon className="w-12 h-12 text-hh-muted mx-auto mb-3" />
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
                      <div className="flex items-start justify-between">
                        <div className={`w-10 h-10 rounded-xl ${getTypeColor(content.type)} flex items-center justify-center`}>
                          <Icon className="w-5 h-5" />
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
                              Bekijk details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate?.("roleplay")}>
                              <Play className="w-4 h-4 mr-2" />
                              Start oefening
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div>
                        <h3 className="text-[16px] leading-[22px] text-hh-text font-semibold mb-1">
                          {content.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[11px] ${getTypeColor(content.type)}`}>
                            {getTypeLabel(content.type)}
                          </Badge>
                          <Badge variant="outline" className="text-[11px] bg-hh-primary/10 text-hh-primary border-hh-primary/20">
                            {content.fase}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[13px] text-hh-muted pt-2 border-t border-hh-border">
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{content.views} views</span>
                        </div>
                        <div className="flex items-center gap-1 text-hh-success">
                          <TrendingUp className="w-4 h-4" />
                          <span>{content.engagement}%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[12px] text-hh-muted">{content.uploadDate}</span>
                        <Badge
                          className={`text-[11px] ${
                            content.status === "Gepubliceerd"
                              ? "bg-hh-success/10 text-hh-success border-hh-success/20"
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
          <div className="rounded-[16px] border border-hh-border overflow-hidden bg-hh-bg">
            <table className="w-full">
              <thead className="bg-hh-ui-50 border-b border-hh-border">
                <tr>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] text-hh-muted font-medium w-20">
                    #
                  </th>
                  <th
                    className="text-left px-4 py-3 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:bg-hh-ui-100 transition-colors"
                    onClick={() => handleSort("title")}
                  >
                    <div className="flex items-center gap-2">
                      Titel
                      <SortIcon field="title" />
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Fase
                  </th>
                  <th
                    className="text-right px-4 py-3 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:bg-hh-ui-100 transition-colors"
                    onClick={() => handleSort("views")}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Views
                      <SortIcon field="views" />
                    </div>
                  </th>
                  <th className="text-right px-4 py-3 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Engagement
                  </th>
                  <th className="text-left px-4 py-3 text-[13px] leading-[18px] text-hh-muted font-medium">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-[13px] leading-[18px] text-hh-muted font-medium">
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
                      className={`border-b border-hh-border last:border-0 hover:bg-hh-ui-50 transition-colors ${
                        index % 2 === 0 ? "bg-hh-bg" : "bg-hh-ui-50/30"
                      }`}
                    >
                      <td className="px-4 py-3">
                        {content.techniqueNumber && (
                          <div className="w-10 h-10 rounded-lg bg-hh-ink/10 text-hh-ink flex items-center justify-center text-[13px] font-semibold">
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
                          <div className={`w-8 h-8 rounded-lg ${getTypeColor(content.type)} flex items-center justify-center`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <Badge variant="outline" className="text-[11px] bg-slate-100 text-slate-600 border-slate-300">
                            {getTypeLabel(content.type)}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="text-[11px] bg-hh-primary/10 text-hh-primary border-hh-primary/20"
                        >
                          {content.fase}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-[14px] text-hh-success font-medium">
                        {content.views}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 text-hh-success">
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-[14px] font-medium">{content.engagement}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`text-[11px] ${
                            content.status === "Gepubliceerd"
                              ? "bg-hh-success/10 text-hh-success border-hh-success/20"
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredContent.length === 0 && viewMode === "list" && (
          <Card className="p-8 rounded-[16px] border-hh-border text-center">
            <LibraryIcon className="w-12 h-12 text-hh-muted mx-auto mb-3" />
            <p className="text-[16px] text-hh-muted">
              Geen content gevonden
            </p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
