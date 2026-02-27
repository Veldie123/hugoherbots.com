import { useState, useMemo } from "react";
import { useMobileViewMode } from "../../hooks/useMobileViewMode";
import { AppLayout } from "./AppLayout";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Download,
  FileText,
  Video,
  BookOpen,
  Star,
  Search,
  List,
  LayoutGrid,
  FolderOpen,
  TrendingUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Eye,
} from "lucide-react";
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

interface ResourcesProps {
  navigate?: (page: string) => void;
  isAdmin?: boolean;
  onboardingMode?: boolean;
}

interface Resource {
  id: number;
  type: "PDF" | "Video" | "Spreadsheet";
  title: string;
  description: string;
  size: string;
  downloads: number;
  featured: boolean;
  category: string;
}

export function Resources({ navigate, isAdmin, onboardingMode }: ResourcesProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useMobileViewMode("grid", "list");
  const [sortBy, setSortBy] = useState<"title" | "downloads" | "size">("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const resources: Resource[] = useMemo(() => [
    {
      id: 1,
      type: "PDF",
      title: "EPIC Methodologie - Complete Gids",
      description: "Volledige uitleg van de 4 fasen en 25 technieken van Hugo's EPIC sales methode",
      size: "2.4 MB",
      downloads: 1247,
      featured: true,
      category: "Methodologie",
    },
    {
      id: 2,
      type: "PDF",
      title: "Techniek Referentie Kaarten",
      description: "Printbare kaarten met alle 25 technieken — handig tijdens je gesprekken",
      size: "1.8 MB",
      downloads: 892,
      featured: true,
      category: "Technieken",
    },
    {
      id: 3,
      type: "Video",
      title: "Hugo's Masterclass - Ontdekkingsfase",
      description: "60 minuten diepgaande training over de kunst van het stellen van de juiste vragen",
      size: "245 MB",
      downloads: 634,
      featured: false,
      category: "Video cursus",
    },
    {
      id: 4,
      type: "PDF",
      title: "Bezwaar Behandeling Framework",
      description: "Complete handleiding voor het omgaan met de 5 meest voorkomende bezwaren",
      size: "1.2 MB",
      downloads: 1108,
      featured: false,
      category: "Technieken",
    },
    {
      id: 5,
      type: "PDF",
      title: "Sales Gesprek Template",
      description: "Gestructureerde template voor het voorbereiden van je sales gesprekken",
      size: "0.8 MB",
      downloads: 1456,
      featured: false,
      category: "Templates",
    },
    {
      id: 6,
      type: "Spreadsheet",
      title: "KPI Tracking Dashboard",
      description: "Excel template om je sales metrics en voortgang bij te houden",
      size: "0.5 MB",
      downloads: 723,
      featured: false,
      category: "Analytics",
    },
    {
      id: 7,
      type: "PDF",
      title: "ICP Definitie Workbook",
      description: "Werkboek om je Ideal Customer Profile scherp te krijgen",
      size: "1.1 MB",
      downloads: 589,
      featured: false,
      category: "Strategie",
    },
    {
      id: 8,
      type: "Video",
      title: "Role-Play Best Practices",
      description: "15 minuten training over hoe je het meeste uit je oefensessies haalt",
      size: "78 MB",
      downloads: 445,
      featured: false,
      category: "Training",
    },
  ], []);

  const handleSort = (column: "title" | "downloads" | "size") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder(column === "title" ? "asc" : "desc");
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

  const getIcon = (type: string) => {
    switch (type) {
      case "PDF":
        return <FileText className="w-5 h-5" />;
      case "Video":
        return <Video className="w-5 h-5" />;
      case "Spreadsheet":
        return <FileText className="w-5 h-5" />;
      default:
        return <BookOpen className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "PDF":
        return "bg-hh-destructive/10 text-hh-destructive";
      case "Video":
        return "bg-hh-primary/10 text-hh-primary";
      case "Spreadsheet":
        return "bg-hh-success/10 text-hh-success";
      default:
        return "bg-hh-muted/10 text-hh-muted";
    }
  };

  const filteredResources = resources.filter((resource) =>
    resource.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (filterCategory === "all" || resource.category === filterCategory) &&
    (filterType === "all" || resource.type === filterType)
  );

  const sortedResources = [...filteredResources].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "title":
        comparison = a.title.localeCompare(b.title);
        break;
      case "downloads":
        comparison = a.downloads - b.downloads;
        break;
      case "size":
        const sizeA = parseFloat(a.size);
        const sizeB = parseFloat(b.size);
        comparison = sizeA - sizeB;
        break;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const totalResources = resources.length;
  const totalDownloads = resources.reduce((sum, r) => sum + r.downloads, 0);
  const categories = [...new Set(resources.map(r => r.category))];
  const featuredCount = resources.filter(r => r.featured).length;

  return (
    <AppLayout
      currentPage="resources"
      navigate={navigate}
      isAdmin={isAdmin}
      onboardingMode={onboardingMode}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-[40px] text-hh-text mb-2">
              Resources & Downloads
            </h1>
            <p className="text-[16px] leading-[24px] text-hh-muted">
              Handige materialen en tools om je sales skills naar een hoger niveau te tillen
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-ink/10 flex items-center justify-center">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-hh-ink" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-hh-success/10 text-hh-success border-hh-success/20"
              >
                +2
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Totaal Resources
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {totalResources}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
                <Download className="w-4 h-4 sm:w-5 sm:h-5 text-hh-primary" />
              </div>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 bg-hh-success/10 text-hh-success border-hh-success/20"
              >
                +15%
              </Badge>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Downloads deze maand
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {totalDownloads.toLocaleString()}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-ink/10 flex items-center justify-center">
                <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5 text-hh-ink" />
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Categorieën
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {categories.length}
            </p>
          </Card>

          <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-hh-warn/10 flex items-center justify-center">
                <Star className="w-4 h-4 sm:w-5 sm:h-5 text-hh-warn" />
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] text-hh-muted mb-1 sm:mb-2">
              Featured Items
            </p>
            <p className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] text-hh-ink">
              {featuredCount}
            </p>
          </Card>
        </div>

        <Card className="p-4 sm:p-5 rounded-[16px] shadow-hh-sm border-hh-border">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hh-muted" />
              <Input
                placeholder="Zoek resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Alle Categorieën" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Categorieën</SelectItem>
                <SelectItem value="Methodologie">Methodologie</SelectItem>
                <SelectItem value="Technieken">Technieken</SelectItem>
                <SelectItem value="Templates">Templates</SelectItem>
                <SelectItem value="Video cursus">Video cursus</SelectItem>
                <SelectItem value="Analytics">Analytics</SelectItem>
                <SelectItem value="Strategie">Strategie</SelectItem>
                <SelectItem value="Training">Training</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Alle Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Types</SelectItem>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="Video">Video</SelectItem>
                <SelectItem value="Spreadsheet">Spreadsheet</SelectItem>
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

        {viewMode === "list" && (
          <Card className="rounded-[16px] shadow-hh-sm border-hh-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hh-ui-50 border-b border-hh-border">
                  <tr>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Type
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:bg-hh-ui-100 transition-colors select-none"
                      onClick={() => handleSort("title")}
                    >
                      <div className="flex items-center gap-1.5">
                        Naam
                        <SortIcon column="title" />
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Categorie
                    </th>
                    <th 
                      className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:bg-hh-ui-100 transition-colors select-none"
                      onClick={() => handleSort("size")}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        Grootte
                        <SortIcon column="size" />
                      </div>
                    </th>
                    <th 
                      className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium cursor-pointer hover:bg-hh-ui-100 transition-colors select-none"
                      onClick={() => handleSort("downloads")}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        Downloads
                        <SortIcon column="downloads" />
                      </div>
                    </th>
                    <th className="text-right py-3 px-4 text-[13px] leading-[18px] text-hh-muted font-medium">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResources.map((resource, index) => (
                    <tr
                      key={resource.id}
                      className={`border-t border-hh-border hover:bg-hh-ui-50 transition-colors ${
                        index % 2 === 0 ? "bg-card" : "bg-hh-ui-50/30"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className={`w-8 h-8 rounded-lg ${getTypeColor(resource.type)} flex items-center justify-center`}>
                          {getIcon(resource.type)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] leading-[20px] text-hh-text font-medium">
                            {resource.title}
                          </p>
                          {resource.featured && (
                            <Star className="w-4 h-4 text-hh-warn fill-hh-warn flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-[12px] leading-[16px] text-hh-muted mt-0.5 line-clamp-1">
                          {resource.description}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[11px] bg-hh-ink/5 text-hh-ink border-hh-ink/20">
                          {resource.category}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-[14px] leading-[20px] text-hh-text">
                          {resource.size}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-[14px] leading-[20px] text-hh-text">
                          {resource.downloads.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            size="sm" 
                            className="bg-hh-ink text-white hover:bg-hh-ink/90 h-8 px-3"
                          >
                            <Download className="w-4 h-4 mr-1.5" />
                            Download
                          </Button>
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
                              <DropdownMenuItem>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedResources.map((resource) => (
              <Card 
                key={resource.id} 
                className={`p-4 rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-hh-md hover:border-hh-ink/30 transition-all ${
                  resource.featured ? "border-hh-warn/30 bg-gradient-to-br from-hh-warn/5 to-transparent" : ""
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-lg ${getTypeColor(resource.type)} flex items-center justify-center`}>
                      {getIcon(resource.type)}
                    </div>
                    <div className="flex items-center gap-2">
                      {resource.featured && (
                        <Star className="w-4 h-4 text-hh-warn fill-hh-warn" />
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            Bekijk details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div>
                    <Badge variant="outline" className="text-[10px] bg-hh-ink/5 text-hh-ink border-hh-ink/20 mb-2">
                      {resource.category}
                    </Badge>
                    <h3 className="text-[14px] leading-[20px] text-hh-text font-medium">
                      {resource.title}
                    </h3>
                    <p className="text-[12px] leading-[16px] text-hh-muted mt-1 line-clamp-2">
                      {resource.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[12px] text-hh-muted">
                    <span>{resource.size}</span>
                    <span>{resource.downloads.toLocaleString()} downloads</span>
                  </div>

                  <Button 
                    className="w-full bg-hh-ink text-white hover:bg-hh-ink/90"
                    size="sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
